# نخبة Nukhba — Agence Web Premium Tripoli

Site vitrine haut de gamme construit avec Next.js 16 + Tailwind + Framer Motion.

## Installation
```bash
npm install
npm run dev # http://localhost:3000
```

## Configuration unique
Editez `src/lib/config.ts`:
- `siteConfig.pricing.plans` : prix, noms, options
- `theme.accent` : couleur d'accent (#C6A664 doré par défaut)
- `whatsapp` : numéro sans "+"
- `social` : liens Instagram/Facebook
- `email`, `phone`, `address`

## Contenu modifiable
`src/lib/content.ts` : démos, secteurs, pourquoi nous, étapes, témoignages, FAQ
`src/lib/i18n.tsx` : traductions AR/EN

## Images
Remplacez les URLs Unsplash par vos images dans `content.ts` et sections. Placez mockups dans `public/images/` et référencez `/images/...`.

## Déploiement
- **Vercel** : `vercel --prod` — SSG automatique, 90+ Lighthouse. Ajoutez `nokhba.net.ly` dans Settings → Domains et configurez les DNS chez votre registrar.
- **VPS** : `npm run build` + `npm start` derrière Nginx + PM2. Ajoutez `DATABASE_URL` si vous activez formulaire DB.

## Formulaire
Actuellement log console + confirmation. Pour envoi réel:
- Webhook: POST vers `https://formspree.io` ou Make/Zapier dans `cta-form.tsx` handleSubmit
- Email: API route `/api/lead` avec Resend/Nodemailer
- UTM conservé via `window.location.search`

## SEO
- sitemap.ts, robots.ts, metadata, hreflang, Open Graph, LocalBusiness JSON-LD déjà inclus
- Ajoutez Google Analytics ID dans `src/app/page.tsx` placeholder
- respects `prefers-reduced-motion` via Framer Motion

## A personnaliser avant mise en ligne
1. Prix réels dans config.ts
2. Numéro WhatsApp réel
3. Adresse/email/horaires
4. Images réelles (remplacer Unsplash)
5. Logos clients (bande de confiance)
6. Domaine officiel (`nokhba.net.ly`) dans `src/lib/config.ts` (`domain` et `url`), utilisé aussi pour les métadonnées SEO.
7. GA/Plausible ID
8. Favicon/OG image dans public/
9. Textes légaux si besoin

## Performance
- next/image lazy, SSG, CSS variables, pas de gros JS
- Lighthouse 90+ visé — testez avec `npm run build && npx serve out` ou Vercel Analytics

## RTL parfait
- dir dynamique, icônes directionnelles, animations inversées via `dir` context

## Panneau d'administration
- **URL** : `/admin` (connexion) — interface en français, accès protégé par session signée (7 jours)
- **Variable obligatoire** : `ADMIN_PASSWORD` (Settings → Environment Variables sur Vercel). Optionnel : `SESSION_SECRET` (sinon la session est signée avec ADMIN_PASSWORD)
- **Modules** :
  - **Tableau de bord** — statistiques (total, nouveaux, en cours, traités), activité 14 jours, dernières demandes
  - **Demandes** — les formulaires du site sont enregistrés en base (table `leads`, créée automatiquement) : filtres, recherche, statuts, notes internes, contact WhatsApp/email, export CSV
  - **Configuration** — coordonnées, réseaux sociaux, chiffres et tarifs éditables, visibles immédiatement sur le site
  - **Contenu** — démos, témoignages et FAQ éditables (réordonner, ajouter, supprimer) avec bouton « Réinitialiser »
- Les réglages sont stockés dans la table `settings` ; par défaut le site utilise les valeurs de `src/lib/config.ts` et `src/lib/content.ts`
- Après chaque enregistrement, le site public est régénéré automatiquement (revalidation Next.js)
- **Optionnel** : `WEBHOOK_URL` — si définie, chaque demande du formulaire est aussi envoyée vers ce webhook (Formspree, Make, Zapier…)
