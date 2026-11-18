/**
 * Règles pures des contrôles de disponibilité.
 *
 * Séparées du script réseau pour être testables sans accès Internet :
 * chaque fonction reçoit une réponse déjà obtenue et rend un verdict.
 */

/** @typedef {{ status: "ok" | "warn" | "fail", message: string }} Verdict */

/** @returns {any | null} */
export function parseJson(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/**
 * `/api/health` doit répondre 200 **et** `ok: true`.
 * Un 200 avec `ok: false` signifie que la base est tombée : c'est un échec.
 * @returns {Verdict}
 */
export function evaluateHealth(httpStatus, body) {
  if (httpStatus !== 200) {
    return {
      status: "fail",
      message: `HTTP ${httpStatus} au lieu de 200`,
    };
  }

  const data = parseJson(body);
  if (!data || typeof data !== "object") {
    return { status: "fail", message: "réponse JSON illisible" };
  }

  if (data.ok !== true) {
    const database =
      data.database && typeof data.database.connected === "boolean"
        ? `, base connectée : ${data.database.connected}`
        : "";
    return {
      status: "fail",
      message: `HTTP 200 mais ok=${String(data.ok)}${database}`,
    };
  }

  return { status: "ok", message: "HTTP 200, ok=true" };
}

/**
 * Une page publique doit répondre 200 et contenir au moins un marqueur.
 * Le marqueur prouve qu'on sert le vrai site, pas une page d'erreur cache.
 * @returns {Verdict}
 */
export function evaluatePage(httpStatus, body, markers) {
  if (httpStatus !== 200) {
    return { status: "fail", message: `HTTP ${httpStatus} au lieu de 200` };
  }

  const found = markers.some((marker) => body.includes(marker));
  if (!found) {
    return {
      status: "fail",
      message: `marqueur absent (${markers.join(" ou ")})`,
    };
  }

  return { status: "ok", message: "HTTP 200, marqueur trouvé" };
}

/**
 * Certificat TLS : échec sous 7 jours, avertissement sous 14 jours.
 * @param {string} validTo Date ISO renvoyée par le certificat
 * @param {Date} [now]
 * @returns {Verdict}
 */
export function evaluateTls(validTo, now = new Date()) {
  const expiry = new Date(validTo);
  if (Number.isNaN(expiry.getTime())) {
    return { status: "fail", message: "date d'expiration illisible" };
  }

  const days = Math.floor((expiry.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) {
    return { status: "fail", message: `certificat expiré depuis ${-days} j` };
  }
  if (days < 7) {
    return { status: "fail", message: `certificat expire dans ${days} j` };
  }
  if (days < 14) {
    return { status: "warn", message: `certificat expire dans ${days} j` };
  }
  return { status: "ok", message: `certificat valide ${days} j` };
}

/**
 * Un avertissement n'échoue pas le contrôle, un échec si.
 * @param {Verdict[]} verdicts
 */
export function overallStatus(verdicts) {
  if (verdicts.some((verdict) => verdict.status === "fail")) return "fail";
  if (verdicts.some((verdict) => verdict.status === "warn")) return "warn";
  return "ok";
}
