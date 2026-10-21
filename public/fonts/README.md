# Polices auto-hébergées

Aucune requête vers `fonts.googleapis.com` / `fonts.gstatic.com` : les fichiers
sont servis directement par le site (`/fonts/…`), mis en cache par le CDN et
préchargés dans `src/app/layout.tsx`.

| Fichier | Famille | Usage |
| --- | --- | --- |
| `cairo-arabic-var.woff2`, `cairo-latin-var.woff2` | Cairo (variable 200→1000) | police principale (corps de texte, titres) |
| `plex-ar-400/500/600/700.woff2` | IBM Plex Sans Arabic | option du studio d'identité |
| `tajawal-400/500/700.woff2` | Tajawal | option du studio d'identité |

Les fichiers `@font-face` correspondants sont en haut de `src/app/globals.css`
(avec `font-display: swap` et `unicode-range` pour que seuls les sous-ensembles
utiles soient téléchargés).

Sources : packages `@fontsource-variable/cairo`, `@fontsource/ibm-plex-sans-arabic`
et `@fontsource/tajawal` (miroir de Google Fonts). Licence SIL Open Font License
1.1 — voir `OFL-*.txt` dans ce dossier. Pour mettre à jour une police, réinstaller
le package, recopier les `.woff2` ici, puis désinstaller le package : le site ne
dépend d'aucun paquet de polices au build.
