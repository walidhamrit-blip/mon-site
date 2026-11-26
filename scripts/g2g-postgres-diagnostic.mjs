// Ne jamais afficher error.message, stack, URL, valeurs SQL ou paramètres.
export function safePostgresError(error) {
  const descriptions = {
    G2G_SECRET_MISSING: "Secret G2G_TEST_DATABASE_URL absent ou vide.",
    G2G_URL_INVALID: "URI PostgreSQL invalide ou paramètres encodés incorrectement.",
    G2G_TARGET_INVALID: "URI refusée : cible différente de g2g-test, format/port/base incorrect ou paramètres URL présents.",
    ENOTFOUND: "Résolution DNS impossible.", EAI_AGAIN: "Résolution DNS temporairement indisponible.",
    ENETUNREACH: "Réseau inaccessible (par exemple IPv6 non disponible).",
    EHOSTUNREACH: "Hôte inaccessible.", ECONNREFUSED: "Connexion refusée.",
    ETIMEDOUT: "Délai de connexion dépassé.", ECONNRESET: "Connexion interrompue.",
    SELF_SIGNED_CERT_IN_CHAIN: "Certificat TLS non reconnu.", UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Certificat TLS non vérifié.",
    CERT_HAS_EXPIRED: "Certificat TLS expiré.",
    "28P01": "Authentification PostgreSQL refusée.", "28000": "Accès PostgreSQL refusé.",
    "3D000": "Base PostgreSQL introuvable.", "42P01": "Table prototype introuvable.",
    "42501": "Droits PostgreSQL insuffisants.", "57014": "Requête PostgreSQL interrompue ou expirée.",
    ERR_ASSERTION: "Résultat du scénario différent de celui attendu ; un résultat de réservation incertain peut aussi provoquer cet échec.",
  };
  const code = typeof error?.code === "string" ? error.code : "";
  if (Object.hasOwn(descriptions, code)) return descriptions[code];
  const nested = error?.cause?.code;
  if (typeof nested === "string" && Object.hasOwn(descriptions, nested)) return descriptions[nested];
  return "Cause non classée ; aucun détail sensible n'est affiché.";
}
export function diagnosticError(code) { return Object.assign(new Error("Erreur de test"), {code}); }
