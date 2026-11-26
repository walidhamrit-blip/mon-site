/**
 * Boutique inline du bot Telegram — orchestration serveur.
 *
 * Ce module branche le catalogue du site (`getDigitalCatalog`) et la caisse
 * du site (`createFazercardsCheckout`) sur le chat Telegram :
 *
 *   Catégories → Produits (avec prix) → Détails & Paiement
 *
 * Chaque clic appelle `editMessageText` sur le MÊME message : la navigation
 * reste fluide et instantanée, sans empiler des bulles. Le rendu (textes,
 * claviers, bornes, diagnostic d'erreur) vit dans `telegram-shop-core.ts`
 * (pur) ; ce module résout les index courts du clavier, écrit l'état du chat,
 * journalise les blocages de caisse et crée la commande.
 *
 * Garde-fous repris du site :
 *  - le prix est TOUJOURS recalculé côté serveur (`createFazercardsCheckout`) ;
 *  - un e-mail réel de livraison est exigé, mémorisé dès validation, affiché
 *    sur la fiche montant et modifiable en un clic ;
 *  - la quantité initiale respecte le plancher de facture crypto (1,50 $) ;
 *  - tout échec nettoie `pending`, propose un bouton WhatsApp pré-rempli +
 *    la fiche web, journalise la cause dans `/admin/telegram` et alerte
 *    l'équipe si l'incident est opérationnel (solde fournisseur, passerelle).
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { digitalOrders, orders } from "@/db/schema";
import { getDigitalCatalog } from "@/lib/digital-store";
import { getFazercardsCatalog } from "@/lib/fazercards-catalog";
import { createFazercardsCheckout, FazercardsOrderError } from "@/lib/fazercards-orders";
import { fazercardsMinOrderUsd } from "@/lib/fazercards";
import { isNowPaymentsError } from "@/lib/nowpayments";
import { resolveFazercardsMaxOrderUsd } from "@/lib/store";
import { resolveLivePayGateConfig } from "@/lib/paygate";
import { payGateReady } from "@/lib/paygate-core";
import { readDigitalOverrides } from "@/lib/digital-overrides";
import {
  shopBrandRegionsView,
  shopBrandsOfKind,
  shopBrandsView,
  shopRegionsOfBrand,
} from "@/lib/telegram-shop-core";
import { resolveFazercardsCheckoutProduct } from "@/lib/digital-overrides-core";
import { siteBaseUrl } from "@/lib/site-url";
import { denominationLabel } from "@/lib/digital-types";
import { orderRefFromText } from "@/lib/telegram-core";
import { formatWatchConfirmation, watchOrderFromTelegram } from "@/lib/telegram-delivery";
import {
  editTelegramMessage,
  getTelegramShopContext,
  notifyTelegramAdmin,
  recordTelegramShopCheckoutEvent,
  sendTelegramMessage,
  setTelegramCheckoutEmail,
  setTelegramShopState,
  type TelegramShopState,
} from "@/lib/telegram";
import {
  classifyShopCheckoutError,
  EMPTY_SHOP_STATE,
  formatShopCheckoutFailureAlert,
  formatShopUsd,
  isCancelShopInput,
  isPlausibleEmail,
  maskShopEmail,
  parseShopCallback,
  shopBelowMinimumView,
  shopCallback,
  shopCategoriesView,
  shopCategoryView,
  shopCheckoutErrorView,
  shopCardSwitchUrl,
  shopCopy,
  shopDenominationView,
  shopEmailPromptView,
  shopInitialQuantity,
  shopPaymentView,
  shopProductView,
  SHOP_KINDS,
  SHOP_MAX_QUANTITY,
  type ShopDenomination,
  type ShopLinks,
  type ShopLocale,
  type ShopProduct,
  type ShopView,
} from "@/lib/telegram-shop-core";

export interface ShopBotContext {
  siteName: string;
  siteUrl: string;
  storeUrl: string;
  whatsapp?: string;
}

export interface ShopActor {
  chatId: string;
  /** Identité Telegram du client — stockée sur la commande pour le suivi. */
  username?: string | null;
  firstName?: string | null;
}

interface PendingCheckout {
  slug: string;
  denomId: string;
  qty: number;
  title: string;
  label: string;
  totalUsd: string;
  promptMessageId?: number | null;
}

interface LastOrderInfo {
  ref: string;
  paymentUrl: string;
  trackingToken: string;
  slug: string;
  title: string;
  label: string;
  totalUsd: string;
  email: string;
  qty: number;
}

/** Délai minimal entre deux factures créées depuis le même chat. */
const CHECKOUT_COOLDOWN_MS = 60_000;

/* ------------------------------ Point d'entrée ----------------------------- */

/** Ouvre la boutique (commandes `/shop`, `/codes` ou bouton 🛒). */
export async function openTelegramShop(
  chatId: string,
  messageId: number | null,
  language: ShopLocale,
  ctx: ShopBotContext,
): Promise<void> {
  const [{ state }, catalog] = await Promise.all([
    loadShopContext(chatId),
    loadCatalog(),
  ]);
  await render(chatId, messageId, shopCategoriesView(catalog, language, shopLinks(ctx)), state);
}

/**
 * Ouvre la boutique directement sur un rayon — arrivée depuis un lien
 * « Continuer sur Telegram » du site (`/start shop-ar-gift_card`).
 * Rayon inconnu → racine de la boutique, jamais une impasse.
 */
export async function openTelegramShopCategory(
  actor: ShopActor,
  kind: string | null,
  language: ShopLocale,
  ctx: ShopBotContext,
): Promise<void> {
  if (!kind || !(SHOP_KINDS as readonly string[]).includes(kind)) {
    await openTelegramShop(actor.chatId, null, language, ctx);
    return;
  }
  const { state } = await loadShopContext(actor.chatId);
  await renderCategory(actor, null, kind, 1, language, ctx, state);
}

/**
 * Traite une callback boutique. Renvoie `false` si `data` n'est pas une
 * callback boutique (le webhook essaie alors le reste de son routage).
 */
export async function handleShopCallback(
  actor: ShopActor,
  messageId: number | null,
  data: string,
  language: ShopLocale,
  ctx: ShopBotContext,
): Promise<boolean> {
  const callback = parseShopCallback(data);
  if (!callback) return false;

  const { state, checkoutEmail } = await loadShopContext(actor.chatId);

  switch (callback.view) {
    case "root":
      await openTelegramShop(actor.chatId, messageId, language, ctx);
      return true;
    case "category":
      await renderCategory(actor, messageId, callback.kind, callback.page, language, ctx, state);
      return true;
    case "brands":
      await renderBrands(actor, messageId, callback.kind, callback.page, language, ctx, state);
      return true;
    case "brand":
      await renderBrandEntry(actor, messageId, callback.index, language, ctx, state);
      return true;
    case "regionPage":
      await renderBrandRegions(actor, messageId, callback.page, language, ctx, state);
      return true;
    case "region":
      await renderBrandProducts(actor, messageId, callback.index, language, ctx, state);
      return true;
    case "regionAll":
      await renderBrandProducts(actor, messageId, null, language, ctx, state);
      return true;
    case "brandProductsPage": {
      const kind = typeof state.kind === "string" ? state.kind : null;
      const brand = typeof state.brand === "string" ? state.brand : null;
      if (!kind || !brand) {
        await openTelegramShop(actor.chatId, messageId, language, ctx);
        return true;
      }
      const catalog = await loadCatalog();
      const region = typeof state.region === "string" ? state.region : null;
      await renderBrandProductList(
        actor, messageId, catalog, kind, brand, region, callback.page, language, ctx, state,
      );
      return true;
    }
    case "product":
      await renderProductByIndex(actor, messageId, callback.index, language, ctx, state);
      return true;
    case "productPage":
      await renderProductBySlug(actor, messageId, callback.page, language, ctx, state);
      return true;
    case "denomination":
      await renderDenominationByIndex(
        actor,
        messageId,
        callback.index,
        language,
        ctx,
        state,
        checkoutEmail,
      );
      return true;
    case "quantity":
      await shiftQuantity(
        actor,
        messageId,
        callback.delta,
        language,
        ctx,
        state,
        checkoutEmail,
      );
      return true;
    case "buy":
      await startBuy(actor, messageId, language, ctx, state, checkoutEmail);
      return true;
    case "buyMin":
      await startBuy(
        actor,
        messageId,
        language,
        ctx,
        { ...state, qty: callback.qty },
        checkoutEmail,
      );
      return true;
    case "email":
      await askEmail(actor, messageId, language, ctx, state);
      return true;
    case "cancel":
      await cancelPending(actor, messageId, language, ctx, state);
      return true;
    case "pay":
      await resendPaymentLink(actor, messageId, language, ctx, state);
      return true;
    case "watch":
      await watchLastOrder(actor, callback.ref, language, ctx);
      return true;
  }
}

/**
 * Message texte reçu alors qu'une caisse attend un e-mail.
 * Renvoie `true` si le texte a été consommé par la boutique.
 */
export async function handleShopEmailInput(
  actor: ShopActor,
  messageId: number | null,
  text: string,
  language: ShopLocale,
  ctx: ShopBotContext,
): Promise<boolean> {
  const { state } = await loadShopContext(actor.chatId);
  const pending = pendingFromState(state);
  if (!pending) return false;

  // Le client tape « إلغاء » / « cancel » au lieu de cliquer sur le bouton.
  if (isCancelShopInput(text)) {
    await dismissPromptKeyboard(actor.chatId, pending);
    await cancelPending(actor, messageId, language, ctx, state);
    return true;
  }

  // Une référence de commande (ex. DGC-…) doit atteindre le suivi, pas être
  // rejetée comme « e-mail invalide ».
  if (orderRefFromText(text)) {
    await setTelegramShopState(actor.chatId, { ...state, pending: null });
    return false;
  }

  if (!isPlausibleEmail(text)) {
    const copy = shopCopy(language);
    await sendOrEdit(actor.chatId, messageId, copy.invalidEmail, [
      [{ text: `✖️ ${copy.cancel}`, callback_data: shopCallback({ view: "cancel" }) }],
    ]);
    return true;
  }

  const normalizedEmail = text.trim().toLowerCase();
  // On mémorise l'e-mail valide AVANT l'appel passerelle : si un garde-fou
  // bloque la commande, le client n'aura jamais à ressaisir son adresse.
  await setTelegramCheckoutEmail(actor.chatId, normalizedEmail);
  await dismissPromptKeyboard(actor.chatId, pending);
  await completeCheckout(actor, messageId, normalizedEmail, language, ctx, state, pending);
  return true;
}

/* -------------------------------- Vues ------------------------------------ */

async function renderCategory(
  actor: ShopActor,
  messageId: number | null,
  kind: string,
  page: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const catalog = await loadCatalog();
  // Cartes cadeaux : hiérarchie TYPE de carte (Steam, PlayStation…) puis
  // RÉGION. Une seule marque → régions directement ; une seule région →
  // liste plate (comportement d'origine des autres familles).
  if (kind === "gift_card") {
    const links = shopLinks(ctx);
    const brands = shopBrandsOfKind(catalog, kind);
    if (brands.length > 1) {
      await render(actor.chatId, messageId, shopBrandsView(catalog, kind, page, language, links), state);
      return;
    }
    if (brands.length === 1) {
      const brand = brands[0].name;
      if (shopRegionsOfBrand(catalog, kind, brand).length > 1) {
        await render(
          actor.chatId,
          messageId,
          shopBrandRegionsView(catalog, kind, brand, page, language, links),
          state,
        );
        return;
      }
    }
  }
  const view = shopCategoryView(catalog, kind, page, language, shopLinks(ctx));
  await render(actor.chatId, messageId, view, state);
}

/** Liste de produits d'une marque cartes cadeaux (région éventuelle). */
async function renderBrandProductList(
  actor: ShopActor,
  messageId: number | null,
  catalog: ShopProduct[],
  kind: string,
  brand: string,
  region: string | null,
  page: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const view = shopCategoryView(catalog, kind, page, language, shopLinks(ctx), {
    brand,
    region,
    regionStep: shopRegionsOfBrand(catalog, kind, brand).length > 1,
  });
  await render(actor.chatId, messageId, view, state);
}

async function renderBrands(
  actor: ShopActor,
  messageId: number | null,
  kind: string,
  page: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const catalog = await loadCatalog();
  const view = shopBrandsView(catalog, kind, page, language, shopLinks(ctx));
  await render(actor.chatId, messageId, view, state);
}

/** Marque choisie : régions si la marque en couvre plusieurs, sinon liste directe. */
async function renderBrandEntry(
  actor: ShopActor,
  messageId: number | null,
  index: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const catalog = await loadCatalog();
  const brands = stringList(state.brands);
  const kind = typeof state.kind === "string" ? state.kind : null;
  const brand = brands[index];
  if (!brand || !kind) {
    // Index périmé (catalogue changé, ancien clavier) : on rouvre la boutique.
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }
  if (shopRegionsOfBrand(catalog, kind, brand).length > 1) {
    await render(
      actor.chatId,
      messageId,
      shopBrandRegionsView(catalog, kind, brand, 1, language, shopLinks(ctx)),
      state,
    );
    return;
  }
  await renderBrandProductList(
    actor, messageId, catalog, kind, brand, null, 1, language, ctx, state,
  );
}

async function renderBrandRegions(
  actor: ShopActor,
  messageId: number | null,
  page: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const catalog = await loadCatalog();
  const kind = typeof state.kind === "string" ? state.kind : null;
  const brand = typeof state.brand === "string" ? state.brand : null;
  if (!kind || !brand) {
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }
  const view = shopBrandRegionsView(catalog, kind, brand, page, language, shopLinks(ctx));
  await render(actor.chatId, messageId, view, state);
}

/** Région choisie (`null` = toutes les régions) : liste des produits filtrée. */
async function renderBrandProducts(
  actor: ShopActor,
  messageId: number | null,
  regionIndex: number | null,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const catalog = await loadCatalog();
  const kind = typeof state.kind === "string" ? state.kind : null;
  const brand = typeof state.brand === "string" ? state.brand : null;
  if (!kind || !brand) {
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }
  const region = regionIndex == null ? null : (stringList(state.regions)[regionIndex] ?? null);
  await renderBrandProductList(
    actor, messageId, catalog, kind, brand, region, 1, language, ctx, state,
  );
}

async function renderProductByIndex(
  actor: ShopActor,
  messageId: number | null,
  index: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const products = stringList(state.products);
  const slug = products[index];
  if (!slug) {
    // Index périmé (catalogue changé, ancien clavier) : on rouvre la boutique.
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }
  await renderProduct(actor, messageId, slug, 1, language, ctx, state);
}

async function renderProductBySlug(
  actor: ShopActor,
  messageId: number | null,
  page: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const slug = typeof state.slug === "string" ? state.slug : null;
  if (!slug) {
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }
  await renderProduct(actor, messageId, slug, page, language, ctx, state);
}

async function renderProduct(
  actor: ShopActor,
  messageId: number | null,
  slug: string,
  page: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const product = await findProduct(slug);
  if (!product) {
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }
  const categoryPage =
    typeof state.categoryPage === "number"
      ? state.categoryPage
      : typeof state.page === "number"
        ? state.page
        : 1;
  // Fiche atteinte depuis la hiérarchie cartes cadeaux : le retour remonte
  // aux régions de la marque (ou à la liste des marques).
  let backData: string | undefined;
  const kind = typeof state.kind === "string" ? state.kind : null;
  const brand = typeof state.brand === "string" ? state.brand : null;
  if (kind && brand) {
    backData = shopCallback(
      shopRegionsOfBrand(await loadCatalog(), kind, brand).length > 1
        ? { view: "regionPage", page: 1 }
        : { view: "brands", kind, page: 1 },
    );
  }
  const view = shopProductView(product, page, language, shopLinks(ctx), categoryPage, backData);
  await render(actor.chatId, messageId, view, state);
}

async function renderDenominationByIndex(
  actor: ShopActor,
  messageId: number | null,
  index: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
  checkoutEmail: string | null,
): Promise<void> {
  const product = typeof state.slug === "string" ? await findProduct(state.slug) : null;
  const denomId = stringList(state.denoms)[index];
  const backPage = typeof state.page === "number" ? state.page : 1;
  if (!product || !denomId) {
    await renderProductBySlug(actor, messageId, backPage, language, ctx, state);
    return;
  }
  const denomination = product.denominations.find((item) => item.id === denomId);
  if (!denomination) {
    await renderProduct(actor, messageId, product.slug, backPage, language, ctx, state);
    return;
  }
  const minUsd = fazercardsMinOrderUsd();
  const initial = shopInitialQuantity(denomination, minUsd);
  const view = shopDenominationView(
    product,
    denomination,
    initial.qty,
    backPage,
    language,
    shopLinks(ctx),
    {
      checkoutEmail,
      minOrderUsd: minUsd,
      autoAdjustedMin: initial.autoAdjusted,
    },
  );
  await render(actor.chatId, messageId, view, state);
}

async function shiftQuantity(
  actor: ShopActor,
  messageId: number | null,
  delta: -1 | 1,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
  checkoutEmail: string | null,
): Promise<void> {
  const product = typeof state.slug === "string" ? await findProduct(state.slug) : null;
  const denomId = typeof state.denomId === "string" ? state.denomId : null;
  const backPage = typeof state.page === "number" ? state.page : 1;
  if (!product || !denomId) {
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }
  const denomination = product.denominations.find((item) => item.id === denomId);
  if (!denomination) {
    await renderProduct(actor, messageId, product.slug, backPage, language, ctx, state);
    return;
  }
  const maxQty = Math.max(
    1,
    Math.min(denomination.maxQuantity ?? SHOP_MAX_QUANTITY, SHOP_MAX_QUANTITY),
  );
  const next = Math.min(Math.max(1, stateQty(state) + delta), maxQty);
  const view = shopDenominationView(
    product,
    denomination,
    next,
    backPage,
    language,
    shopLinks(ctx),
    {
      checkoutEmail,
      minOrderUsd: fazercardsMinOrderUsd(),
    },
  );
  await render(actor.chatId, messageId, view, state);
}

/**
 * Demande explicite d'e-mail (bouton « ✉️ Changer l'e-mail » ou premier achat).
 * Force l'invite même lorsqu'un `checkoutEmail` est déjà enregistré.
 */
async function askEmail(
  actor: ShopActor,
  messageId: number | null,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  let pending = pendingFromState(state);
  if (!pending) {
    const product = typeof state.slug === "string" ? await findProduct(state.slug) : null;
    const denomId = typeof state.denomId === "string" ? state.denomId : null;
    const denomination = product?.denominations.find((item) => item.id === denomId);
    if (!product || !denomination || (denomination.fields?.length ?? 0) > 0) {
      await openTelegramShop(actor.chatId, messageId, language, ctx);
      return;
    }
    pending = pendingFor(product, denomination, stateQty(state), language);
  }

  const minUsd = fazercardsMinOrderUsd();
  if (Number(pending.totalUsd) + 1e-6 < minUsd) {
    const product = await findProduct(pending.slug);
    const denomination = product?.denominations.find((item) => item.id === pending!.denomId);
    if (product && denomination) {
      const backPage = typeof state.page === "number" ? state.page : 1;
      await render(
        actor.chatId,
        messageId,
        shopBelowMinimumView(product, denomination, minUsd, language, shopLinks(ctx), backPage),
        state,
      );
      return;
    }
  }

  const shownId = await render(actor.chatId, messageId, shopEmailPromptView(pending, language));
  await setTelegramShopState(actor.chatId, {
    ...state,
    pending: { ...pending, promptMessageId: shownId },
  });
}

async function cancelPending(
  actor: ShopActor,
  messageId: number | null,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const copy = shopCopy(language);
  const catalog = await loadCatalog();
  const view = shopCategoriesView(catalog, language, shopLinks(ctx));
  await render(
    actor.chatId,
    messageId,
    { ...view, text: `${copy.changedMind}\n\n${view.text}`, state: { pending: null } },
    state,
  );
}

/** Bouton « Acheter » : e-mail connu → facture ; sinon demande d'e-mail. */
async function startBuy(
  actor: ShopActor,
  messageId: number | null,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
  checkoutEmail: string | null,
): Promise<void> {
  const product = typeof state.slug === "string" ? await findProduct(state.slug) : null;
  const denomId = typeof state.denomId === "string" ? state.denomId : null;
  const denomination = product?.denominations.find((item) => item.id === denomId);
  if (!product || !denomination) {
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }

  const backPage = typeof state.page === "number" ? state.page : 1;

  // Champs acheteur requis (identifiant joueur, serveur…) : la fiche web
  // complète est obligatoire — jamais de vente « à l'aveugle » dans le chat.
  if ((denomination.fields?.length ?? 0) > 0) {
    const view = shopDenominationView(
      product,
      denomination,
      stateQty(state),
      backPage,
      language,
      shopLinks(ctx),
      { checkoutEmail },
    );
    await render(actor.chatId, messageId, view, state);
    return;
  }

  const pending = pendingFor(product, denomination, stateQty(state), language);

  // 1) Plancher de facture crypto (ex. 1,50 $) : annoncé AVANT la caisse,
  //    avec un bouton d'achat direct à la quantité minimale.
  const minUsd = fazercardsMinOrderUsd();
  if (Number(pending.totalUsd) + 1e-6 < minUsd) {
    await render(
      actor.chatId,
      messageId,
      shopBelowMinimumView(product, denomination, minUsd, language, shopLinks(ctx), backPage),
      state,
    );
    return;
  }

  // 2) Plafond d'achat automatique (ex. 25 $) : annoncé AVANT la saisie d'e-mail,
  //    avec bouton WhatsApp pré-rempli pour les commandes volumineuses.
  const maxUsd = await resolveFazercardsMaxOrderUsd();
  if (Number(pending.totalUsd) > maxUsd + 1e-6) {
    const view = shopCheckoutErrorView({
      reason: "above_limit",
      locale: language,
      links: shopLinks(ctx),
      pending,
      minOrderUsd: minUsd,
      maxOrderUsd: maxUsd,
    });
    await render(actor.chatId, messageId, view, state);
    return;
  }

  if (checkoutEmail && isPlausibleEmail(checkoutEmail)) {
    await completeCheckout(actor, messageId, checkoutEmail, language, ctx, state, pending);
    return;
  }

  const shownId = await render(actor.chatId, messageId, shopEmailPromptView(pending, language));
  await setTelegramShopState(actor.chatId, {
    ...state,
    pending: { ...pending, promptMessageId: shownId },
  });
}

async function completeCheckout(
  actor: ShopActor,
  messageId: number | null,
  email: string,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
  forcedPending?: PendingCheckout,
): Promise<void> {
  const copy = shopCopy(language);
  const pending = forcedPending ?? pendingFromState(state);
  if (!pending) {
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }

  // Garde-fou anti-spam : une facture NOWPayments par minute et par chat.
  const lastAt = typeof state.lastCheckoutAt === "string" ? Date.parse(state.lastCheckoutAt) : NaN;
  if (Number.isFinite(lastAt) && Date.now() - lastAt < CHECKOUT_COOLDOWN_MS) {
    await setTelegramShopState(actor.chatId, { ...state, pending: null });
    await sendOrEdit(actor.chatId, messageId, copy.cooldown, [
      [{ text: copy.title, callback_data: shopCallback({ view: "root" }) }],
      [{ text: localeMenu(language), callback_data: "menu:home" }],
    ]);
    return;
  }

  const locale = language === "ar" ? ("ar" as const) : ("en" as const);
  try {
    // Caisse du site, route FazerCards — le fournisseur actif du projet
    // (l'ancien fournisseur est retiré : `LEGACY_SUPPLIER_RETIRED`). Le prix
    // est recalculé côté serveur à partir du catalogue fournisseur, exactement
    // comme depuis la boutique web. `paymentMethod: "nowpayments"` : la
    // facture hébergée crypto, chemin principal du bot.
    const catalog = await getFazercardsCatalog();
    const overridesState = await readDigitalOverrides();
    // Conserve l'identifiant canonique `fzr-*` : le slug public peut être
    // personnalisé par les surcharges admin, la livraison route par id.
    const matchedProduct = resolveFazercardsCheckoutProduct(
      catalog.products,
      overridesState,
      pending.slug,
    );
    const canonicalProductId = matchedProduct?.id ?? pending.slug;
    const productsAdapter = {
      findBySlug: (slug: string) => {
        const product =
          slug === canonicalProductId && matchedProduct
            ? matchedProduct
            : resolveFazercardsCheckoutProduct(catalog.products, overridesState, slug);
        if (!product) return null;
        return {
          kind: product.kind,
          categoryId: product.categoryId,
          denominations: product.denominations.map((denomination) => ({
            id: denomination.id,
            label: denomination.label,
            priceUsd: denomination.priceUsd,
            available: denomination.available,
            maxOrderQuantity: denomination.maxOrderQuantity,
            supplierOfferId: denomination.supplierOfferId,
            supplierCostUsd: denomination.supplierCostUsd,
            fields: denomination.fields,
          })),
        };
      },
    };

    const result = await createFazercardsCheckout(
      {
        productId: canonicalProductId,
        denominationId: pending.denomId,
        quantity: pending.qty,
        email,
        name: actor.firstName?.trim() || undefined,
        locale,
        paymentMethod: "nowpayments",
      },
      productsAdapter,
      new Request(siteBaseUrl()),
    );

    // Identité Telegram sur la commande (les deux tables, comme la caisse web
    // le ferait pour ses propres entrées) : suivi + livraison retrouvent le chat.
    await stampTelegramIdentity(result.orderRef, actor);

    await setTelegramCheckoutEmail(actor.chatId, email);
    const view = shopPaymentView({
      ref: result.orderRef,
      title: result.productTitle,
      label: result.denominationLabel,
      qty: result.quantity,
      totalUsd: formatShopUsd(result.totalUsd),
      paymentUrl: result.paymentUrl,
      trackingToken: result.trackingToken,
      cardUrl: await cardSwitchUrlFor(ctx, result.orderRef, result.trackingToken, result.totalUsd),
      slug: pending.slug,
      email,
      locale: language,
      links: shopLinks(ctx),
    });
    await render(actor.chatId, messageId, view, {
      ...state,
      lastCheckoutAt: new Date().toISOString(),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn("[telegram][shop] caisse :", detail);

    const { reason, alertAdmin } = classifyShopCheckoutError({
      errorCode: error instanceof FazercardsOrderError ? error.code : null,
      isNowPayments: isNowPaymentsError(error),
    });
    const maxUsd = await resolveFazercardsMaxOrderUsd().catch(() => 25);
    const errorView = shopCheckoutErrorView({
      reason,
      locale: language,
      links: shopLinks(ctx),
      pending,
      minOrderUsd: fazercardsMinOrderUsd(),
      maxOrderUsd: maxUsd,
    });
    await render(actor.chatId, messageId, errorView, state);

    const actorLabel = formatActorLabel(actor);
    const maskedEmail = maskShopEmail(email);
    await recordTelegramShopCheckoutEvent({
      at: new Date().toISOString(),
      reason,
      alerted: alertAdmin,
      slug: pending.slug,
      title: pending.title,
      label: pending.label,
      qty: pending.qty,
      totalUsd: pending.totalUsd,
      actorLabel,
      maskedEmail,
      detail: detail.slice(0, 240),
    });

    if (alertAdmin) {
      const base = ctx.siteUrl.replace(/\/+$/, "");
      await notifyTelegramAdmin(
        formatShopCheckoutFailureAlert({
          siteName: ctx.siteName,
          reason,
          title: pending.title,
          label: pending.label,
          qty: pending.qty,
          totalUsd: pending.totalUsd,
          actorLabel,
          maskedEmail,
          detail,
        }),
        [
          [
            { text: "🤖 Diagnostic Bot", url: `${base}/admin/telegram` },
            { text: "📦 Solde & Boutique", url: `${base}/admin/digital` },
          ],
        ],
        { parseMode: "HTML", timeoutMs: 4_000 },
      ).catch(() => undefined);
    }
  }
}

/**
 * Retire le bouton « ✖️ الإلغاء » resté sur la bulle d'invite d'e-mail après
 * la réponse texte du client, pour éviter les boutons orphelins dans le chat.
 */
async function dismissPromptKeyboard(
  chatId: string,
  pending: PendingCheckout,
): Promise<void> {
  if (!pending.promptMessageId) return;
  await editTelegramMessage(
    chatId,
    pending.promptMessageId,
    `📦 <b>${escapeInline(pending.title)}</b>\n💳 ${escapeInline(pending.label)}${pending.qty > 1 ? ` · ×${pending.qty}` : ""} · ${formatShopUsd(Number(pending.totalUsd))}`,
    { parseMode: "HTML", keyboard: [] },
  ).catch(() => undefined);
}

function escapeInline(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatActorLabel(actor: ShopActor): string {
  const parts = [
    actor.firstName?.trim() || null,
    actor.username?.trim() ? `@${actor.username.trim().replace(/^@/, "")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : `Chat #${actor.chatId.slice(-6)}`;
}

/**
 * URL de bascule carte pour cette commande — `null` si la passerelle carte
 * est désactivée ou si le montant est sous son minimum (bouton masqué plutôt
 * qu'un clic qui rebondit sans explication).
 */
async function cardSwitchUrlFor(
  ctx: ShopBotContext,
  ref: string,
  token: string,
  totalUsd: number,
): Promise<string | null> {
  try {
    const config = await resolveLivePayGateConfig();
    if (!payGateReady(config) || totalUsd + 1e-6 < config.minOrderUsd) return null;
    return shopCardSwitchUrl(shopLinks(ctx), ref, token);
  } catch {
    return null;
  }
}

/**
 * Écrit `telegram_chat_id` / `telegram_username` sur les deux lignes de la
 * commande (`orders` + `digital_orders`). Best-effort : un échec ne doit
 * jamais invalider une commande déjà créée.
 */
async function stampTelegramIdentity(
  ref: string,
  actor: ShopActor,
): Promise<void> {
  const patch = {
    telegramChatId: actor.chatId,
    telegramUsername: actor.username?.trim() || null,
  };
  try {
    await db.update(orders).set(patch).where(eq(orders.ref, ref));
    await db.update(digitalOrders).set(patch).where(eq(digitalOrders.ref, ref));
  } catch (error) {
    console.warn(
      "[telegram][shop] identité Telegram non apposée :",
      error instanceof Error ? error.message : error,
    );
  }
}

async function resendPaymentLink(
  actor: ShopActor,
  messageId: number | null,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const copy = shopCopy(language);
  const last = lastOrderFromState(state);
  if (!last?.ref || !last.paymentUrl) {
    await sendOrEdit(actor.chatId, messageId, copy.noOrderYet, [
      [{ text: localeMenu(language), callback_data: "menu:home" }],
    ]);
    return;
  }
  const view = shopPaymentView({
    ref: last.ref,
    title: last.title,
    label: last.label,
    qty: last.qty,
    totalUsd: last.totalUsd,
    paymentUrl: last.paymentUrl,
    cardUrl: await cardSwitchUrlFor(
      ctx,
      last.ref,
      last.trackingToken,
      Number(String(last.totalUsd).replace(/[^0-9.]/g, "")) || 0,
    ),
    slug: last.slug,
    email: last.email,
    locale: language,
    links: shopLinks(ctx),
  });
  view.text = `${copy.payAgain}\n\n${view.text}`;
  await render(actor.chatId, messageId, view, state);
}

/**
 * « Recevoir le code dans ce chat » : consentement explicite, par commande.
 *
 * La confirmation part dans un message SÉPARÉ : le message de paiement
 * (facture NOWPayments, boutons 💳 / autres moyens) reste intact — le
 * client peut activer les notifications PUIS payer dans n'importe quel
 * ordre. Éditer la même bulle faisait disparaître le lien de paiement.
 */
async function watchLastOrder(
  actor: ShopActor,
  ref: string,
  language: ShopLocale,
  ctx: ShopBotContext,
): Promise<void> {
  const copy = shopCopy(language);
  const result = await watchOrderFromTelegram(actor.chatId, ref, language);
  if (!result.ok) {
    await sendTelegramMessage(
      actor.chatId,
      result.error === "bot_unavailable" ? copy.unavailable : copy.notFound,
    );
    return;
  }
  const text = result.alreadyWatching
    ? copy.alreadyWatching
    : formatWatchConfirmation(result.ref, language, ctx.siteName);
  await sendTelegramMessage(actor.chatId, text);
}

/* -------------------------------- Outils ---------------------------------- */

async function loadShopContext(
  chatId: string,
): Promise<{ state: TelegramShopState; checkoutEmail: string | null }> {
  const { shopState, checkoutEmail } = await getTelegramShopContext(chatId);
  return {
    state: { ...EMPTY_SHOP_STATE, ...(shopState ?? {}) } as TelegramShopState,
    checkoutEmail,
  };
}

async function loadCatalog(): Promise<ShopProduct[]> {
  try {
    return (await getDigitalCatalog()) as ShopProduct[];
  } catch (error) {
    console.warn(
      "[telegram][shop] catalogue indisponible :",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function findProduct(slug: string): Promise<ShopProduct | null> {
  const catalog = await loadCatalog();
  return catalog.find((product) => product.slug === slug) ?? null;
}

function pendingFor(
  product: ShopProduct,
  denomination: ShopDenomination,
  qty: number,
  language: ShopLocale,
): PendingCheckout {
  const locale = language === "ar" ? "ar" : "en";
  const title = locale === "ar" ? product.titleAr : product.titleEn;
  const label = denominationLabel(
    { label: denomination.label, faceValue: denomination.faceValue },
    locale,
  );
  return {
    slug: product.slug,
    denomId: denomination.id,
    qty,
    title,
    label,
    totalUsd: (Math.round(denomination.priceUsd * qty * 100) / 100).toFixed(2),
  };
}

function pendingFromState(state: TelegramShopState): PendingCheckout | null {
  const pending = state.pending;
  if (!pending || typeof pending !== "object") return null;
  const candidate = pending as Partial<PendingCheckout>;
  if (
    typeof candidate.slug !== "string" ||
    typeof candidate.denomId !== "string" ||
    typeof candidate.qty !== "number" ||
    typeof candidate.totalUsd !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.label !== "string"
  ) {
    return null;
  }
  return {
    slug: candidate.slug,
    denomId: candidate.denomId,
    qty: candidate.qty,
    title: candidate.title,
    label: candidate.label,
    totalUsd: candidate.totalUsd,
    promptMessageId:
      typeof candidate.promptMessageId === "number" ? candidate.promptMessageId : null,
  };
}

function lastOrderFromState(state: TelegramShopState): LastOrderInfo | null {
  const last = state.lastOrder;
  if (!last || typeof last !== "object") return null;
  const candidate = last as Partial<LastOrderInfo>;
  if (typeof candidate.ref !== "string" || typeof candidate.paymentUrl !== "string") return null;
  return {
    ref: candidate.ref,
    paymentUrl: candidate.paymentUrl,
    trackingToken: typeof candidate.trackingToken === "string" ? candidate.trackingToken : "",
    slug: typeof candidate.slug === "string" ? candidate.slug : "",
    title: typeof candidate.title === "string" ? candidate.title : "",
    label: typeof candidate.label === "string" ? candidate.label : "",
    totalUsd: typeof candidate.totalUsd === "string" ? candidate.totalUsd : "",
    email: typeof candidate.email === "string" ? candidate.email : "",
    qty: typeof candidate.qty === "number" ? candidate.qty : 1,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stateQty(state: TelegramShopState): number {
  const qty = typeof state.qty === "number" && Number.isInteger(state.qty) ? state.qty : 1;
  return Math.min(Math.max(1, qty), SHOP_MAX_QUANTITY);
}

function shopLinks(ctx: ShopBotContext): ShopLinks {
  return {
    site: ctx.siteUrl,
    store: ctx.storeUrl,
    ...(ctx.whatsapp ? { whatsapp: ctx.whatsapp } : {}),
  };
}

function localeMenu(locale: ShopLocale): string {
  return locale === "ar" ? "⬅️ القائمة" : "⬅️ Menu";
}

/**
 * Fusionne l'overlay de la vue dans l'état courant : les clés présents
 * écrasent (y compris `null`), les clés absents sont conservés.
 */
function mergeShopState(
  current: TelegramShopState,
  overlay?: TelegramShopState,
): TelegramShopState | null {
  if (!overlay) return null;
  const merged: TelegramShopState = { ...current };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    merged[key] = value;
  }
  return merged;
}

/**
 * Écrit l'état puis met à jour le message (retombe sur un envoi si l'édition
 * échoue). Renvoie l'identifiant du message affiché si connu.
 */
async function render(
  chatId: string,
  messageId: number | null,
  view: ShopView,
  currentState?: TelegramShopState,
): Promise<number | null> {
  if (view.state) {
    await setTelegramShopState(chatId, mergeShopState(currentState ?? {}, view.state));
  }
  const edited = messageId
    ? await editTelegramMessage(chatId, messageId, view.text, { parseMode: "HTML", keyboard: view.keyboard })
    : { ok: false as const, error: "no_message_id" };
  if (edited.ok) return messageId;
  const sent = await sendTelegramMessage(chatId, view.text, { parseMode: "HTML", keyboard: view.keyboard });
  return sent.ok ? (sent.result?.message_id ?? null) : null;
}

async function sendOrEdit(
  chatId: string,
  messageId: number | null,
  text: string,
  keyboard: { text: string; url?: string; callback_data?: string }[][],
): Promise<void> {
  const edited = messageId
    ? await editTelegramMessage(chatId, messageId, text, { parseMode: "HTML", keyboard })
    : { ok: false as const, error: "no_message_id" };
  if (!edited.ok) {
    await sendTelegramMessage(chatId, text, { parseMode: "HTML", keyboard });
  }
}
