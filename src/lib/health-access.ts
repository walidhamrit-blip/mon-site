// Contrôle d'accès de la sonde `/api/health`.
//
// La route sert deux publics très différents :
//   - l'administrateur (panneau /admin → SystemHealth, ou curl muni du
//     secret) qui a besoin du diagnostic COMPLET : état des clés, erreurs
//     fournisseurs, avertissements lisibles ;
//   - n'importe quel visiteur — y compris celui qui clique le lien de secours
//     affiché dans le dialogue de paiement quand une facture échoue.
//
// Le diagnostic complet révèle la configuration (clés absentes ou refusées,
// état de la base, e-mail) et déclenche des appels SORTANTS facturés
// (NOWPayments `/status` + validation de clé, FazerCards). Il ne doit donc
// jamais être servi à un inconnu. Le mode public se contente d'un `select 1`.

import { isAdminAuthenticated } from "@/lib/auth";
import { hasServerSecret } from "@/lib/server-secret";

export type HealthAccess = "full" | "public";

export async function healthAccess(req: Request): Promise<HealthAccess> {
  if (hasServerSecret(req)) return "full";
  try {
    if (await isAdminAuthenticated()) return "full";
  } catch {
    /* hors contexte Next : on retombe sur le mode public */
  }
  return "public";
}
