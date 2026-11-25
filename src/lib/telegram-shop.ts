/**
 * Boutique inline du bot Telegram — orchestration serveur.
 *
 * Ce module branche le catalogue du site (`getDigitalCatalog`) et la caisse
 * du site (`createDigitalCheckout`) sur le chat Telegram :
 *
 *   Catégories → Produits (avec prix) → Détails & Paiement
 *
 * Chaque clic appelle `editMessageText` sur le MÊME message : la navigation
 * reste fluide et instantanée, sans empiler des bulles. Le rendu (textes,
 * claviers, bornes) vit dans `telegram-shop-core.ts` (pur) ; ce module se
 * contente de résoudre les index courts du clavier, d'écrire l'état du chat
 * et de créer la commande.
 *
 * Garde-fous repris du site :
 *  - le prix est TOUJOURS recalculé côté serveur (`createDigitalCheckout`) ;
 *  - un e-mail réel de livraison est exigé (jamais d'adresse inventée) ;
 *  - les produits à champs acheteur (identifiant joueur…) ne se vendent pas
 *    dans le chat : le bot renvoie vers la fiche web complète ;
 *  - un garde-fou anti-spam évite de marteler NOWPayments facture après facture.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { digitalOrders, orders } from "@/db/schema";
import { getDigitalCatalog } from "@/lib/digital-store";
import { getFazercardsCatalog } from "@/lib/fazercards-catalog";
import { createFazercardsCheckout, FazercardsOrderError } from "@/lib/fazercards-orders";
import { fazercardsMinOrderUsd } from "@/lib/fazercards";
import { readDigitalOverrides } from "@/lib/digital-overrides";
import { resolveFazercardsCheckoutProduct } from "@/lib/digital-overrides-core";
import { siteBaseUrl } from "@/lib/site-url";
import { denominationLabel } from "@/lib/digital-types";
import { formatWatchConfirmation, watchOrderFromTelegram } from "@/lib/telegram-delivery";
import {
  editTelegramMessage,
  getTelegramShopContext,
  sendTelegramMessage,
  setTelegramCheckoutEmail,
  setTelegramShopState,
  type TelegramShopState,
} from "@/lib/telegram";
import {
  EMPTY_SHOP_STATE,
  formatShopUsd,
  isPlausibleEmail,
  parseShopCallback,
  shopCallback,
  shopBelowMinimumView,
  shopCategoriesView,
  shopCategoryView,
  shopCopy,
  fillShopTemplate,
  shopDenominationView,
  shopEmailPromptView,
  shopPaymentView,
  shopProductView,
  SHOP_MAX_QUANTITY,
  type ShopCallback,
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
}

interface LastOrderInfo {
  ref: string;
  paymentUrl: string;
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
  const catalog = await loadCatalog();
  await render(chatId, messageId, shopCategoriesView(catalog, language, shopLinks(ctx)));
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

  const state = await loadState(actor.chatId);

  switch (callback.view) {
    case "root":
      await openTelegramShop(actor.chatId, messageId, language, ctx);
      return true;
    case "category":
      await renderCategory(actor, messageId, callback.kind, callback.page, language, ctx, state);
      return true;
    case "product":
      await renderProductByIndex(actor, messageId, callback.index, language, ctx, state);
      return true;
    case "productPage":
      await renderProductBySlug(actor, messageId, callback.page, language, ctx, state);
      return true;
    case "denomination":
      await renderDenominationByIndex(actor, messageId, callback.index, language, ctx, state);
      return true;
    case "quantity":
      await shiftQuantity(actor, messageId, callback.delta, language, ctx, state);
      return true;
    case "buy":
      await startBuy(actor, messageId, language, ctx, state);
      return true;
    case "email":
      await askEmail(actor, messageId, language, ctx, state);
      return true;
    case "cancel":
      await cancelPending(actor, messageId, language, ctx);
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
  const state = await loadState(actor.chatId);
  if (!state.pending) return false;

  if (!isPlausibleEmail(text)) {
    const copy = shopCopy(language);
    await sendOrEdit(actor.chatId, messageId, copy.invalidEmail, [
      [{ text: `✖️ ${copy.cancel}`, callback_data: shopCallback({ view: "cancel" }) }],
    ]);
    return true;
  }

  await completeCheckout(actor, messageId, text.trim().toLowerCase(), language, ctx, state);
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
  const view = shopCategoryView(catalog, kind, page, language, shopLinks(ctx));
  await render(actor.chatId, messageId, view, state);
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
  await renderProduct(actor, messageId, slug, 1, language, ctx);
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
  await renderProduct(actor, messageId, slug, page, language, ctx);
}

async function renderProduct(
  actor: ShopActor,
  messageId: number | null,
  slug: string,
  page: number,
  language: ShopLocale,
  ctx: ShopBotContext,
): Promise<void> {
  const product = await findProduct(slug);
  if (!product) {
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }
  const view = shopProductView(product, page, language, shopLinks(ctx));
  await render(actor.chatId, messageId, view);
}

async function renderDenominationByIndex(
  actor: ShopActor,
  messageId: number | null,
  index: number,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
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
    await renderProduct(actor, messageId, product.slug, backPage, language, ctx);
    return;
  }
  const view = shopDenominationView(
    product,
    denomination,
    stateQty(state),
    backPage,
    language,
    shopLinks(ctx),
  );
  await render(actor.chatId, messageId, view);
}

async function shiftQuantity(
  actor: ShopActor,
  messageId: number | null,
  delta: -1 | 1,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
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
    await renderProduct(actor, messageId, product.slug, backPage, language, ctx);
    return;
  }
  const maxQty = Math.max(
    1,
    Math.min(denomination.maxQuantity ?? SHOP_MAX_QUANTITY, SHOP_MAX_QUANTITY),
  );
  const next = Math.min(Math.max(1, stateQty(state) + delta), maxQty);
  const view = shopDenominationView(product, denomination, next, backPage, language, shopLinks(ctx));
  await render(actor.chatId, messageId, view);
}

async function askEmail(
  actor: ShopActor,
  messageId: number | null,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const pending = pendingFromState(state);
  if (!pending) {
    await startBuy(actor, messageId, language, ctx, state);
    return;
  }
  await render(actor.chatId, messageId, shopEmailPromptView(pending, language), state);
}

async function cancelPending(
  actor: ShopActor,
  messageId: number | null,
  language: ShopLocale,
  ctx: ShopBotContext,
): Promise<void> {
  const copy = shopCopy(language);
  const catalog = await loadCatalog();
  const view = shopCategoriesView(catalog, language, shopLinks(ctx));
  await render(
    actor.chatId,
    messageId,
    { ...view, text: `${copy.changedMind}\n\n${view.text}`, state: { pending: null } },
  );
}

/** Bouton « Acheter » : e-mail connu → facture ; sinon demande d'e-mail. */
async function startBuy(
  actor: ShopActor,
  messageId: number | null,
  language: ShopLocale,
  ctx: ShopBotContext,
  state: TelegramShopState,
): Promise<void> {
  const product = typeof state.slug === "string" ? await findProduct(state.slug) : null;
  const denomId = typeof state.denomId === "string" ? state.denomId : null;
  const denomination = product?.denominations.find((item) => item.id === denomId);
  if (!product || !denomination) {
    await openTelegramShop(actor.chatId, messageId, language, ctx);
    return;
  }

  // Champs acheteur requis (identifiant joueur, serveur…) : la fiche web
  // complète est obligatoire — jamais de vente « à l'aveugle » dans le chat.
  if ((denomination.fields?.length ?? 0) > 0) {
    const view = shopDenominationView(
      product,
      denomination,
      stateQty(state),
      1,
      language,
      shopLinks(ctx),
    );
    await render(actor.chatId, messageId, view);
    return;
  }

  const pending = pendingFor(product, denomination, stateQty(state), language);

  // Plancher de facture crypto (ex. 1,50 $) : on l'annonce AVANT la caisse
  // avec la quantité exacte à choisir, au lieu d'un échec après coup.
  const minUsd = fazercardsMinOrderUsd();
  if (Number(pending.totalUsd) + 1e-6 < minUsd) {
    const backPage = typeof state.page === "number" ? state.page : 1;
    await render(
      actor.chatId,
      messageId,
      shopBelowMinimumView(product, denomination, minUsd, language, shopLinks(ctx), backPage),
      state,
    );
    return;
  }

  const { checkoutEmail } = await getTelegramShopContext(actor.chatId);
  if (checkoutEmail && isPlausibleEmail(checkoutEmail)) {
    await completeCheckout(actor, messageId, checkoutEmail, language, ctx, state, pending);
    return;
  }

  await setTelegramShopState(actor.chatId, { ...state, pending });
  await render(actor.chatId, messageId, shopEmailPromptView(pending, language), state);
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
    await sendOrEdit(actor.chatId, messageId, copy.cooldown, [
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
    console.warn("[telegram][shop] caisse :", error instanceof Error ? error.message : error);
    await sendOrEdit(actor.chatId, messageId, checkoutErrorMessage(error, language), [
      [{ text: localeMenu(language), callback_data: "menu:home" }],
    ]);
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

async function loadState(chatId: string): Promise<TelegramShopState> {
  const { shopState } = await getTelegramShopContext(chatId);
  return { ...EMPTY_SHOP_STATE, ...(shopState ?? {}) } as TelegramShopState;
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
  return candidate as PendingCheckout;
}

function lastOrderFromState(state: TelegramShopState): LastOrderInfo | null {
  const last = state.lastOrder;
  if (!last || typeof last !== "object") return null;
  const candidate = last as Partial<LastOrderInfo>;
  if (typeof candidate.ref !== "string" || typeof candidate.paymentUrl !== "string") return null;
  return {
    ref: candidate.ref,
    paymentUrl: candidate.paymentUrl,
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
  return { site: ctx.siteUrl, store: ctx.storeUrl };
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

/** Écrit l'état puis met à jour le message (retombe sur un envoi si l'édition échoue). */
async function render(
  chatId: string,
  messageId: number | null,
  view: ShopView,
  currentState?: TelegramShopState,
): Promise<void> {
  if (view.state) {
    await setTelegramShopState(chatId, mergeShopState(currentState ?? {}, view.state));
  }
  const edited = messageId
    ? await editTelegramMessage(chatId, messageId, view.text, { parseMode: "HTML", keyboard: view.keyboard })
    : { ok: false as const, error: "no_message_id" };
  if (!edited.ok) {
    await sendTelegramMessage(chatId, view.text, { parseMode: "HTML", keyboard: view.keyboard });
  }
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

function checkoutErrorMessage(error: unknown, language: ShopLocale): string {
  const copy = shopCopy(language);
  if (error instanceof FazercardsOrderError) {
    switch (error.code) {
      case "product_not_found":
      case "denomination_not_found":
      case "denomination_not_sellable":
      case "invalid_quantity":
        return copy.notFound;
      case "below_minimum":
        return fillShopTemplate(copy.belowMinimumRetry, { min: formatShopUsd(fazercardsMinOrderUsd()) });
      default:
        // Stock épuisé, fournisseur indisponible, montant refusé… : le détail
        // technique reste dans les logs, le client reçoit un message clair.
        return copy.unavailable;
    }
  }
  return copy.unavailable;
}
