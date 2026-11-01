import { db } from "@/db";
import { sql } from "drizzle-orm";
import { siteConfig } from "@/lib/config";
import {
  configuredLeadRecipient,
  mailDiagnostics,
  mailLeadRecipient,
} from "@/lib/mailer";
import {
  checkFazercardsCredentials,
  fazercardsApiBase,
  fazercardsConfigured,
  fazercardsMaxOrderUsd,
} from "@/lib/fazercards";
import { fazercardsCatalogStatusLive } from "@/lib/fazercards-catalog";
import { databaseConfigured } from "@/lib/digital-store";
import {
  checkNowPaymentsApiKey,
  nowPaymentsApiBase,
  nowPaymentsApiKey,
  nowPaymentsFiatCurrency,
  nowPaymentsIpnSecret,
  nowPaymentsSandbox,
} from "@/lib/nowpayments";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Décrit une erreur de base de données **exploitable**.
 *
 * Constat du 29/10/2026 : `/api/health` affichait `Failed query: select 1`,
 * message de Drizzle qui masque la cause réelle (« terminate connection »,
 * « password authentication failed », « remaining connection slots »…).
 * On remonte donc la chaîne `cause` de Node (message + code Postgres), en
 * retirant toute chaîne de connexion — la route est publique.
 */
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const node = current as {
      message?: string;
      code?: string;
      detail?: string;
      cause?: unknown;
    };
    if (node.message) parts.push(node.message.trim());
    if (node.code) parts.push(`code=${node.code}`);
    if (node.detail) parts.push(`detail=${node.detail.trim()}`);
    current = node.cause;
  }
  const single = [...new Set(parts.filter(Boolean))].join(" | ");
  return redact(single) || "Erreur inconnue";
}

/** Retire toute chaîne de connexion ou secret d'un message d'erreur. */
function redact(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://***")
    .replace(/(password|pass|pwd)=[^\s&"']+/gi, "$1=***");
}

/**
 * Traduction en une phrase actionnable. C'est ce qui manquait : un `false`
 * sans explication a coûté plusieurs jours de boutique fermée.
 */
function databaseHint(message: string): string {
  const text = message.toLowerCase();
  if (/terminat|suspend|quota|compute time|project has/i.test(text)) {
    return "Base suspendue (quota de calcul épuisé ?) — voir console.neon.tech → Billing, puis Restart compute.";
  }
  if (/too many|remaining connection slots|53300/.test(text)) {
    return "Trop de connexions ouvertes — redémarrer la base et vérifier le pool.";
  }
  if (/password|authentication|28p01|role .* does not exist/.test(text)) {
    return "Identifiants refusés — DATABASE_URL ne correspond plus au mot de passe de la base.";
  }
  if (/does not exist|3d000/.test(text)) {
    return "La base nommée dans DATABASE_URL n'existe plus (projet supprimé ou renommé ?).";
  }
  if (/enotfound|econnrefused|etimedout|timeout|getaddrinfo/.test(text)) {
    return "Hôte injoignable — DATABASE_URL pointe vers un serveur arrêté, ou le réseau de sortie est bloqué.";
  }
  if (/ssl|self.signed|certificate/.test(text)) {
    return "Problème TLS — ajouter ?sslmode=require à la fin de DATABASE_URL.";
  }
  return "Voir le message exact ci-dessus ; la cause est presque toujours côté hébergeur de la base.";
}

/**
 * Sonde de diagnostic complète — publique, sans aucun secret
 * (booléens et messages d'erreur uniquement, jamais de clés).
 *
 * Utilisée pour localiser la cause d'un échec de création de paiement :
 *  - `database.connected:false` → `DATABASE_URL` absente ou base injoignable ;
 *  - `nowpayments.apiKeyConfigured:false` → `NOWPAYMENTS_API_KEY` absente
 *    de l'environnement qui sert cette route (Vercel : vérifier
 *    l'environnement « Production » puis redéployer) ;
 *  - `nowpayments.reachable:false` → sortie réseau vers NOWPayments bloquée ;
 *  - `nowpayments.apiKeyValid:false` → la clé est refusée par
 *    l'environnement visé (`apiKeyError` = corps exact du refus) : clé
 *    sandbox contre API production ou inversement (les deux environnements
 *    sont séparés), secret IPN collé à la place de la clé API, ou clé
 *    tronquée/régénérée. `apiKeyValid:true` = paiements réellement possibles ;
 *  - `vercel.env` / `vercel.commit` → quel déploiement sert la réponse.
 */
export async function GET() {
  const startedAt = Date.now();

  // ── Base de données ──
  const urlConfigured = databaseConfigured();
  let database: {
    urlConfigured: boolean;
    connected: boolean;
    latencyMs: number;
    error: string | null;
    hint: string | null;
  };
  try {
    await db.execute(sql`select 1`);
    database = {
      urlConfigured,
      connected: true,
      latencyMs: Date.now() - startedAt,
      error: null,
      hint: null,
    };
  } catch (error) {
    const detail = describeError(error);
    database = {
      urlConfigured,
      connected: false,
      latencyMs: Date.now() - startedAt,
      error: detail,
      hint: databaseHint(detail),
    };
  }

  // ── Passerelle NOWPayments ──
  // Deux sondes en parallèle : `GET /status` (public — dit seulement si la
  // passerelle répond) et `GET /currencies` avec la clé (dit si la clé est
  // acceptée par l'environnement visé). La première seule a déjà fait
  // croire à tort que « tout allait bien » alors que la clé était refusée.
  const apiBase = nowPaymentsApiBase();
  const [statusProbe, apiKeyCheck] = await Promise.all([
    (async () => {
      try {
        const response = await fetch(`${apiBase}/status`, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        return {
          reachable: response.ok,
          error: response.ok ? null : `HTTP ${response.status}`,
        };
      } catch (error) {
        return { reachable: false, error: errorMessage(error) };
      }
    })(),
    checkNowPaymentsApiKey(),
  ]);

  const nowpayments = {
    apiKeyConfigured: nowPaymentsApiKey().length > 0,
    apiKeyValid: apiKeyCheck.valid,
    apiKeyStatus: apiKeyCheck.status,
    apiKeyError: apiKeyCheck.error,
    ipnSecretConfigured: Boolean(nowPaymentsIpnSecret()),
    sandbox: nowPaymentsSandbox(),
    apiBase,
    currency: nowPaymentsFiatCurrency(),
    reachable: statusProbe.reachable,
    error: statusProbe.error,
  };

  // ── Fournisseur de codes (FazerCards) ──
  // Diagnostic : « configuré ou non », validité de la clé et état
  // du cache catalogue. Le SOLDE n'est jamais exposé (donnée financière sur
  // une route publique) — il reste consultable dans le hub revendeur.
  const fazercardsCheck = fazercardsConfigured()
    ? await checkFazercardsCredentials({ timeoutMs: 6000 }).catch((error) => ({
        configured: true,
        valid: null as boolean | null,
        balance: null,
        error: errorMessage(error),
      }))
    : {
        configured: false,
        valid: false as boolean | null,
        balance: null,
        error: "FAZERCARDS_API_KEY manquant",
      };

  const fazercards = {
    configured: fazercardsCheck.configured,
    credentialsValid: fazercardsCheck.valid,
    apiBase: fazercardsApiBase(),
    maxOrderUsd: fazercardsMaxOrderUsd(),
    // Cache du catalogue : évite de deviner si la boutique affiche des
    // données fraîches (TTL 10 min par défaut).
    // Hydraté depuis la copie partagée : une instance neuve n'a pas de
    // cache mémoire, et un `products: 0` mensonger fausse tout diagnostic.
    catalog: await fazercardsCatalogStatusLive(),
    error: fazercardsCheck.error,
  };

  // État de la vitrine : quand la base est configurée mais muette, le
  // catalogue public retombe sur des fiches de démonstration. Cette ligne
  // évite d'avoir à le déduire d'un `products: 0` ambigu.
  /*
   * L'état du catalogue se déduit de la sonde ci-dessus, pas d'un état
   * mémorisé : chaque route Next est un bundle séparé, donc la mémoire du
   * module `digital-store` vue par `/codes` n'est pas celle de cette route.
   * La sonde `select 1`, elle, est fiable partout.
   */
  const catalog = {
    degraded: database.urlConfigured && !database.connected,
    reason: database.urlConfigured && !database.connected ? "database_unreachable" : null,
    message: database.connected ? null : database.error,
    since: null,
  };
  const diagnostics = mailDiagnostics();
  const leadRecipient = mailLeadRecipient(siteConfig.email);

  /**
   * Ce qui empêche le site de fonctionner **aujourd'hui**, en clair.
   * C'est la partie que le propriétaire peut lire sans être développeur.
   */
  const warnings: string[] = [];
  if (database.urlConfigured && !database.connected) {
    warnings.push(
      `Base de données injoignable : la boutique affiche un bandeau de maintenance et aucune commande ne peut être enregistrée. ${database.hint ?? ""}`.trim(),
    );
  }
  if (catalog.degraded) {
    warnings.push(
      "Catalogue public en mode dégradé (repli) : les fiches du sitemap sont retirées tant que la base ne répond pas.",
    );
  }
  if (!diagnostics.configured) {
    warnings.push(
      "Aucun fournisseur d'e-mail configuré : les codes achetés ne peuvent pas être livrés.",
    );
  }
  if (!diagnostics.replyTo) {
    warnings.push(
      `Les e-mails partent de ${diagnostics.from} : sans EMAIL_REPLY_TO, un client qui répond à sa confirmation écrit à une boîte qui n'existe pas (rejet 550).`,
    );
  }
  /*
   * Variable présente mais inutilisable : cas réel du 29/10/2026, où
   * `LEAD_NOTIFICATION_EMAIL` valait littéralement « LEAD_NOTIFICATION_EMAIL ».
   * Sans cette alerte, les notifications partaient dans le vide en silence.
   */
  if (process.env.LEAD_NOTIFICATION_EMAIL?.trim() && !configuredLeadRecipient()) {
    warnings.push(
      `LEAD_NOTIFICATION_EMAIL ne contient pas une adresse e-mail valide (valeur actuelle ignorée) : les demandes partent vers ${siteConfig.email}. Corriger la variable sur Vercel.`,
    );
  }
  if (leadRecipient === siteConfig.email) {
    warnings.push(
      `Les demandes du formulaire sont envoyées à ${leadRecipient}. Si cette boîte n'existe pas, définir LEAD_NOTIFICATION_EMAIL avec une adresse qui reçoit réellement.`,
    );
  }

  // `ok` n'est vrai que si un paiement peut réellement être créé :
  // base connectée ET clé acceptée (pas seulement présente/joignable).
  const ok = database.connected && nowpayments.apiKeyValid === true;

  return Response.json(
    {
      ok,
      time: new Date().toISOString(),
      siteUrl: (process.env.SITE_URL?.trim() || siteConfig.url).replace(/\/+$/, ""),
      vercel: {
        env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
        // Le SHA du commit est volontairement omis : sur une route publique
        // il pourrait aider un attaquant à corréler des CVE framework avec
        // une version précise. On garde `deploymentUrl` (utile au debug
        // pour savoir si l'utilisateur parle au bon environnement) et
        // `env` (production/preview).
        deploymentUrl: process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : null,
      },
      database,
      nowpayments,
      fazercards,
      /** Panne du catalogue public (bandeau de maintenance affiché). */
      catalog,
      // Diagnostic d'envoi : savoir par quel canal et depuis quelle adresse
      // partent les codes (aucune clé exposée).
      mail: {
        ...diagnostics,
        /** Destinataire réel des demandes du formulaire. */
        leadRecipient,
      },
      warnings,
    },
    { status: ok ? 200 : 500 },
  );
}
