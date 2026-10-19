/**
 * Injecte un bloc JSON-LD (schema.org) dans le <head> logique de la page.
 * Composant serveur : aucune hydratation, rendu direct dans le HTML initial
 * donc lisible par Googlebot et les crawlers IA sans exécuter le JS.
 */
export function JsonLd({ data }: { data: object | ReadonlyArray<unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
