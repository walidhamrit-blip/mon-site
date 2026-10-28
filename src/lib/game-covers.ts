/**
 * Couvertures de jeux — visuels locaux des fiches `/codes`.
 *
 * Le catalogue FazerCards ne fournit AUCUNE image : les 120 fiches de la
 * vitrine s'affichaient donc avec une simple pastille d'initiales. Or un
 * magasin de clés de jeux vit de ses visuels : le client reconnaît une
 * jaquette avant de lire un titre.
 *
 * Choix structurants :
 *  - **Fichiers locaux** (`public/game-covers/<slug>.jpg`, 600×900, ~70 Ko) :
 *    aucune requête vers un site tiers (CSP `img-src 'self'`, RGPD, pas de
 *    lien mort quand un CDN change d'URL), et un rendu instantané ;
 *  - **Correspondance par mots-clés** : le slug et le titre viennent du
 *    fournisseur et changent (« 7 Days to Die », « 7 Days To Die (PC) »…).
 *    On normalise (minuscules, sans accents, ponctuation → espaces) puis on
 *    cherche la clé la plus LONGUE d'abord, pour que « age of mythology
 *    retold » ne soit pas capté par « age of mythology » ;
 *  - **Aucune invention** : une fiche sans correspondance renvoie `null` et
 *    le composant dessine un visuel de repli (dégradé + initiales). On ne
 *    colle jamais la jaquette d'un autre jeu sur une fiche.
 *
 * Module PUR (aucun import Node/Next) : il est importable par un composant
 * client comme par un test `node --test`.
 */

/** Une jaquette : le fichier local + les mots-clés qui la désignent. */
export interface GameCover {
  /** Chemin public servi par Next (`/game-covers/...`). */
  file: string;
  /** Mots-clés normalisés (minuscules, sans accent, espaces simples). */
  keys: string[];
}

/**
 * Table des jaquettes disponibles.
 *
 * Ajouter un jeu = déposer `public/game-covers/<slug>.jpg` (portrait 2:3)
 * puis ajouter une entrée ici. Aucun autre fichier à modifier.
 */
export const GAME_COVERS: GameCover[] = [
  {
    file: "/game-covers/7-days-to-die.jpg",
    keys: ["7 days to die", "seven days to die"],
  },
  {
    file: "/game-covers/abyssus.jpg",
    keys: ["abyssus"],
  },
  {
    file: "/game-covers/ace-attorney-investigations-collection.jpg",
    keys: [
      "ace attorney investigations collection",
      "ace attorney investigations",
      "ace attorney",
    ],
  },
  {
    file: "/game-covers/against-the-storm.jpg",
    keys: ["against the storm"],
  },
  {
    file: "/game-covers/age-of-mythology-retold.jpg",
    keys: ["age of mythology retold", "age of mythology"],
  },
  {
    file: "/game-covers/pubg-mobile.jpg",
    keys: ["pubg mobile", "pubg new state", "pubg"],
  },
  {
    file: "/game-covers/genshin-impact.jpg",
    keys: ["genshin impact", "genshin"],
  },
  {
    file: "/game-covers/valorant.jpg",
    keys: ["valorant"],
  },
  {
    file: "/game-covers/call-of-duty-mobile.jpg",
    keys: ["call of duty mobile", "cod mobile", "call of duty"],
  },
  {
    file: "/game-covers/alan-wake-2.jpg",
    keys: ["alan wake 2", "alan wake ii", "alan wake"],
  },
  {
    file: "/game-covers/borderlands-3.jpg",
    keys: ["borderlands 3", "borderlands"],
  },
  {
    file: "/game-covers/american-truck-simulator.jpg",
    keys: ["american truck simulator", "american truck"],
  },
  {
    file: "/game-covers/baldurs-gate-3.jpg",
    keys: ["baldurs gate 3", "baldurs gate iii", "baldur s gate 3", "baldur s gate"],
  },
  {
    file: "/game-covers/black-myth-wukong.jpg",
    keys: ["black myth wukong", "black myth"],
  },
  {
    file: "/game-covers/call-of-duty-black-ops-6.jpg",
    keys: ["black ops 6", "call of duty black ops", "call of duty"],
  },
  {
    file: "/game-covers/cyberpunk-2077.jpg",
    keys: ["cyberpunk 2077", "cyberpunk"],
  },
  {
    file: "/game-covers/ea-sports-fc-25.jpg",
    keys: ["ea sports fc 25", "ea sports fc", "fifa 25", "fifa"],
  },
  {
    file: "/game-covers/elden-ring.jpg",
    keys: ["elden ring", "shadow of the erdtree"],
  },
  {
    file: "/game-covers/euro-truck-simulator-2.jpg",
    keys: ["euro truck simulator 2", "euro truck simulator", "euro truck"],
  },
  {
    file: "/game-covers/god-of-war-ragnarok.jpg",
    keys: ["god of war ragnarok", "god of war"],
  },
  {
    file: "/game-covers/grand-theft-auto-v.jpg",
    keys: ["grand theft auto v", "grand theft auto 5", "gta v", "gta 5", "gta"],
  },
  {
    file: "/game-covers/helldivers-2.jpg",
    keys: ["helldivers 2", "helldivers ii", "helldivers"],
  },
  {
    file: "/game-covers/hogwarts-legacy.jpg",
    keys: ["hogwarts legacy", "hogwarts"],
  },
  {
    file: "/game-covers/minecraft.jpg",
    keys: ["minecraft"],
  },
  {
    file: "/game-covers/palworld.jpg",
    keys: ["palworld"],
  },
  {
    file: "/game-covers/red-dead-redemption-2.jpg",
    keys: ["red dead redemption 2", "red dead redemption ii", "red dead redemption", "rdr2"],
  },
  {
    file: "/game-covers/rust.jpg",
    keys: ["rust"],
  },
  {
    file: "/game-covers/free-fire.jpg",
    keys: ["free fire", "garena free fire", "freefire"],
  },
  {
    file: "/game-covers/the-witcher-3.jpg",
    keys: ["the witcher 3 wild hunt", "witcher 3", "the witcher"],
  },

  /* ----- Marques : cartes cadeaux, abonnements, recharges de monnaie ----- */
  // Ces fiches n'ont pas de « jaquette » : elles portent le visuel de la
  // marque (déjà livré dans /digital-products), présenté en portrait.
  {
    file: "/game-covers/brand-steam.jpg",
    keys: ["steam wallet", "steam"],
  },
  {
    file: "/game-covers/brand-playstation.jpg",
    keys: ["playstation store", "playstation network", "psn", "playstation"],
  },
  {
    file: "/game-covers/brand-xbox.jpg",
    keys: ["xbox game pass", "xbox live", "xbox"],
  },
  {
    file: "/game-covers/brand-google-play.jpg",
    keys: ["google play"],
  },
  {
    file: "/game-covers/brand-amazon.jpg",
    keys: ["amazon"],
  },
  {
    file: "/game-covers/brand-spotify.jpg",
    keys: ["spotify premium", "spotify"],
  },
  {
    file: "/game-covers/brand-nvidia.jpg",
    keys: ["nvidia geforce", "geforce now", "nvidia"],
  },
  {
    file: "/game-covers/brand-roblox.jpg",
    keys: ["roblox robux", "robux", "roblox"],
  },
];

/**
 * Normalise un texte pour la comparaison : minuscules, accents retirés,
 * toute ponctuation remplacée par une espace.
 */
export function normalizeCoverKey(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Toutes les clés, de la plus longue à la plus courte (précision d'abord). */
const SORTED_KEYS: { key: string; file: string }[] = GAME_COVERS.flatMap((cover) =>
  cover.keys.map((key) => ({ key: normalizeCoverKey(key), file: cover.file })),
).sort((a, b) => b.key.length - a.key.length);

/**
 * Jaquette d'une fiche, ou `null` si le jeu n'a pas de visuel local.
 *
 * Le texte analysé est le slug (tirets → espaces) PUIS le titre anglais et
 * arabe : le titre FazerCards d'une clé est « Game Key — 7 Days to Die »,
 * le nom du jeu y est donc toujours présent.
 */
export function gameCoverFor(input: {
  slug?: string | null;
  titleEn?: string | null;
  titleAr?: string | null;
  platform?: string | null;
}): string | null {
  const haystack = normalizeCoverKey(
    [input.slug?.replace(/-/g, " ") ?? "", input.titleEn ?? "", input.titleAr ?? "", input.platform ?? ""]
      .filter(Boolean)
      .join(" "),
  );
  if (!haystack) return null;

  // On exige une correspondance sur des MOTS entiers : « rust » ne doit pas
  // être trouvé dans « trust ». D'où les espaces ajoutées autour.
  const padded = ` ${haystack} `;
  for (const { key, file } of SORTED_KEYS) {
    if (padded.includes(` ${key} `)) return file;
  }
  return null;
}

/**
 * Visuel d'une fiche : l'image enregistrée (admin) sinon la jaquette locale.
 * Une image vide en base signifie « pas de visuel », pas « visuel blanc ».
 */
export function productVisual(input: {
  image?: string | null;
  slug?: string | null;
  titleEn?: string | null;
  titleAr?: string | null;
  platform?: string | null;
}): string | null {
  const stored = (input.image ?? "").trim();
  if (stored) return stored;
  return gameCoverFor(input);
}

/**
 * Cadrage à appliquer au visuel dans une vignette PORTRAIT (2:3).
 *
 *  - `cover`   : la jaquette locale du jeu est déjà en 2:3 → plein cadre ;
 *  - `contain` : l'image vient de l'admin (`product.image`) et ses
 *    proportions sont inconnues — souvent un visuel de marque en 16:9. La
 *    rogner en portrait couperait le logo : on la contient sur un fond
 *    flou issu d'elle-même (même principe que les vignettes de plateformes
 *    de streaming).
 */
export function productVisualFit(input: {
  image?: string | null;
}): "cover" | "contain" {
  return (input.image ?? "").trim() ? "contain" : "cover";
}
