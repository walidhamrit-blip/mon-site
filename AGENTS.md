# Instructions pour les agents IA

Ce dépôt embarque des **skills** Vercel (installés via `npx skills add vercel-labs/agent-skills`).
Ils se trouvent dans `.agents/skills/` (et `.claude/skills/` est un lien vers ce dossier).

Avant une tâche, lis le `SKILL.md` du skill concerné et applique ses règles :

| Tâche | Skill à lire |
| --- | --- |
| Écrire / revoir / optimiser du code React ou Next.js | `.agents/skills/vercel-react-best-practices/SKILL.md` |
| Architecture de composants, props booléennes, composants composés | `.agents/skills/vercel-composition-patterns/SKILL.md` |
| Animations de pages, transitions entre routes | `.agents/skills/vercel-react-view-transitions/SKILL.md` |
| Audit UI / UX / accessibilité | `.agents/skills/web-design-guidelines/SKILL.md` |
| Relire des textes, docs, contenus du site | `.agents/skills/writing-guidelines/SKILL.md` |
| Déployer sur Vercel | `.agents/skills/deploy-to-vercel/SKILL.md` et `.agents/skills/vercel-cli-with-tokens/SKILL.md` |
| Réduire les coûts / améliorer les perfs Vercel | `.agents/skills/vercel-optimize/SKILL.md` |

## Mettre à jour les skills

```bash
npx skills update -p -y          # met à jour selon skills-lock.json
npx skills add vercel-labs/agent-skills --list   # voir tous les skills disponibles
```
