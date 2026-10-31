# Public gaming design system

The public website uses `src/app/gaming.css`, loaded after the base stylesheet.
All visual rules are scoped to `.public-shell`; the admin interface is not
silently restyled. Existing routes, product data, checkout logic and SEO
hierarchy stay unchanged.

## Day and night are designed separately

- White day canvas, black night canvas (as requested).
- White day cards, blue-charcoal night cards; neutral secondary surfaces.
- Six stable palette IDs, preserving admin and visitor preferences.
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
