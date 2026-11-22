/** Fenêtre quotidienne de fermeture, évaluée en heure locale de Tripoli. */
export function manualPaymentsClosedAt(date: Date): boolean {
  if (!Number.isFinite(date.getTime())) return true;
  try {
    const hour = Number(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Tripoli", hour: "2-digit", hourCycle: "h23",
    }).format(date));
    return !Number.isInteger(hour) || hour < 0 || hour >= 24 || hour < 9;
  } catch {
    return true;
  }
}
