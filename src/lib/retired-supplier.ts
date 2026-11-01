/** Permanent retirement of the legacy supplier. No environment variable can re-enable it. */
export const LEGACY_SUPPLIER_RETIRED = true;
export const RETIRED_SUPPLIER_MESSAGE = "Cet ancien fournisseur a été retiré. Les archives sont conservées ; utilisez le catalogue FazerCards pour les nouvelles ventes.";

export function assertLegacySupplierActive(): void {
  if (LEGACY_SUPPLIER_RETIRED) throw new Error(RETIRED_SUPPLIER_MESSAGE);
}
