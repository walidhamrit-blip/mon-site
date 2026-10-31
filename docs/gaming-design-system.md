# Public gaming design system

The public website uses `src/app/gaming.css`, loaded after the base stylesheet.
All visual rules are scoped to `.public-shell`; the admin interface is not
silently restyled. Existing routes, product data, checkout logic and SEO
hierarchy stay unchanged.

## Day and night are designed separately

- White day canvas, black night canvas (as requested).
- White day cards, blue-charcoal night cards; neutral secondary surfaces.
- Seven gaming palettes: Cyber Violet, Electric Blue, Neon Lime, Plasma Rose,
  Solar Orange, Arctic Cyan and Royal Gold. Legacy IDs are mapped to the new IDs before
  first paint, preserving both admin and visitor preferences.
- Day accents are deliberately darker than night accents: normal-sized links,
  action labels and body text must remain legible without neon on white.
- Night accents are luminous with dark action labels.
- `themes.ts` remains the shared source for CSS tokens and theme previews.
- Tests check a minimum 4.5:1 ratio for token pairs used for text/buttons,
  including hover states. This is not a claim of a complete WCAG audit.

## Common components

- Angular brand badge, rectangular controls and underlined active navigation.
- Image-only panoramic homepage banner remains unchanged.
- Three illustrated entry cards, restrained panel corners and indexed labels.
- Shared cards, typography, fields, tables, FAQ and page mastheads for the
  shop, web services, pricing, guides and supporting pages.
- New four-column footer follows the selected mode, with separate store,
  website and support destinations. Secondary/legacy URLs remain linked.
- No hidden or removed content for crawlers; animations respect reduced motion.

## Verification

Build and source tests run without Neon. Browser smoke checks cover the main
public routes in all six palettes and both modes, plus mobile layouts, images
and menu interaction. Live purchasing still needs the Neon quota restored.

## Shop language boundary

`/codes` keeps catalogue fetching, metadata and structured data on the server.
All visible shop content is rendered by `DigitalStoreView`, using the same
live `useI18n` locale as the filters and navigation. This includes the header,
category links, counts, maintenance notice, buying guide and FAQ. The initial
server render still follows the configured site language, so crawlable content
and initial JSON-LD stay aligned; changing the visitor language updates the
visible content without refetching the catalogue. Product display names and
related-product names are selected in the live locale too.

`store-locale.test.mjs` renders both languages and both maintenance states and
checks that English visible copy contains no Arabic characters.

Royal Gold adds warm gold accents (`#F0CE78`, hover `#FFE2A0`) on the
black dark-mode canvas, with dark button labels. Light mode uses a deeper
gold (`#8A620C`) for readable text and buttons on white. The default palette
and existing saved preferences are unchanged.

Dark Royal Gold controls also use a static metallic highlight and a restrained
gold halo, strengthened on hover/focus. Secondary controls, other palettes and
light mode are unaffected; no animated shimmer is used.
