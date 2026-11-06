import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

/** Retire commentaires et espaces : on ne teste que le code exécuté. */
const code = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ");
const nextConfigSrc = fs.readFileSync(path.join(rootDir, "next.config.ts"), "utf8");
const proxySrc = fs.readFileSync(path.join(rootDir, "src/proxy.ts"), "utf8");
const contentSrc = fs.readFileSync(path.join(rootDir, "src/lib/content.ts"), "utf8");
const csrfSrc = fs.readFileSync(path.join(rootDir, "src/lib/csrf.ts"), "utf8");
const { OPTIMIZED_IMAGE_HOSTS, isOptimizableImageSource, imageOptimizationProps } = await import(
  "../src/lib/image-source.ts"
);

test("CSP frame-src autorise 'self' et tous les sites clients HTTPS en iframe", () => {
  assert.match(
    nextConfigSrc,
    /frame-src\s+'self'\s+https:/,
    "frame-src doit inclure 'self' et https: pour que toutes les démos clients (dont demo-cabinet-medecin.vercel.app et les domaines clients ajoutés dans /admin) s'affichent sans blocage navigateur",
  );
});

test("CSP et proxy n'interdisent jamais l'embarquement même-origine (/live-demos/*)", () => {
  assert.doesNotMatch(
    nextConfigSrc,
    /value:\s*"DENY"/,
    "X-Frame-Options ne doit jamais être DENY (bloquerait /live-demos/tulin-magazin/index.html)",
  );
  assert.doesNotMatch(
    nextConfigSrc,
    /frame-ancestors\s+'none'/,
    "frame-ancestors ne doit jamais être 'none' (bloquerait /live-demos/tulin-magazin/index.html)",
  );
  assert.doesNotMatch(
    proxySrc,
    /"X-Frame-Options",\s*"DENY"/,
    "src/proxy.ts ne doit jamais forcer X-Frame-Options: DENY",
  );
});

test("Permissions-Policy autorise le plein écran (fullscreen=*) sans avertissement console", () => {
  assert.match(nextConfigSrc, /fullscreen=\*/);
  assert.match(proxySrc, /fullscreen=\*/);
});

test("aucun joker global dans images.remotePatterns (proxy d'images fermé)", () => {
  // Avec `hostname: "**"`, /_next/image accepte n'importe quelle URL HTTPS :
  // le déploiement télécharge et transcode des images pour le compte de
  // tiers, et l'assertion « chaque hôte est déclaré » ci-dessous devenait
  // vraie par construction — un garde-fou incapable d'échouer.
  const nextConfigCode = code(nextConfigSrc);
  assert.doesNotMatch(
    nextConfigCode,
    /hostname: "\*\*"/,
    "/_next/image deviendrait un proxy ouvert pour n'importe quel hôte",
  );
  assert.doesNotMatch(nextConfigCode, /hostname: "\*\.\*"/);
});

test("les hôtes d'images du contenu éditorial sont tous optimisables", () => {
  const imageHosts = [
    ...new Set(
      [...contentSrc.matchAll(/image:\s*"https:\/\/([^/"]+)\//g)].map((m) => m[1]),
    ),
  ];
  assert.ok(imageHosts.length >= 8, "Au moins 8 hôtes d'images distants attendus");
  for (const host of imageHosts) {
    assert.ok(
      OPTIMIZED_IMAGE_HOSTS.includes(host),
      `L'hôte d'image ${host} doit figurer dans OPTIMIZED_IMAGE_HOSTS (src/lib/image-source.ts)`,
    );
  }
});

test("une source inconnue n'est jamais optimisée", () => {
  assert.equal(isOptimizableImageSource("/previews/al-bay-family-restaurant-desktop.webp"), true);
  assert.equal(isOptimizableImageSource("/api/media/abc"), true);
  assert.equal(isOptimizableImageSource("https://images.unsplash.com/photo-1?w=1200"), true);
  assert.equal(isOptimizableImageSource("https://images.unsplash.com.evil.example/x.jpg"), false);
  assert.equal(isOptimizableImageSource("https://attaquant.example/x.jpg"), false);
  assert.equal(isOptimizableImageSource("http://images.unsplash.com/x.jpg"), false);
  assert.equal(isOptimizableImageSource("//evil.example/x.jpg"), false);
  assert.equal(isOptimizableImageSource(""), false);
  assert.deepEqual(imageOptimizationProps("https://images.unsplash.com/x.jpg"), {});
  assert.deepEqual(imageOptimizationProps("https://attaquant.example/x.jpg"), { unoptimized: true });
});

test("CSRF accepte l'hôte réel de la requête (Host / X-Forwarded-Host / VERCEL_URL)", () => {
  assert.match(csrfSrc, /x-forwarded-host/);
  assert.match(csrfSrc, /VERCEL_URL/);
  assert.match(csrfSrc, /VERCEL_PROJECT_PRODUCTION_URL/);
});

test("A13 : la démo HTML embarquée reste noindex et hors du sitemap", () => {
  const demoDir = path.join(rootDir, "public/live-demos");
  const demoFiles = fs
    .readdirSync(demoDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(demoDir, entry.name, "index.html"))
    .filter((file) => fs.existsSync(file));
  assert.ok(demoFiles.length > 0, "Au moins une démo HTML autonome attendue");

  for (const file of demoFiles) {
    const html = fs.readFileSync(file, "utf8");
    const relative = path.relative(rootDir, file);
    const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
    assert.ok(robots, `${relative} doit déclarer explicitement une directive robots`);
    assert.match(robots[1], /noindex/i, `${relative} est un aperçu embarqué : noindex attendu`);
    assert.doesNotMatch(robots[1], /(^|,)\s*index\b/i, `${relative} ne doit pas rester indexable`);
  }

  assert.match(
    nextConfigSrc,
    /source:\s*"\/live-demos\/:path\*"[\s\S]*?key:\s*"X-Robots-Tag",\s*value:\s*"noindex/,
    "next.config.ts doit confirmer le noindex des démos par X-Robots-Tag",
  );

  const sitemapSrc = fs.readFileSync(path.join(rootDir, "src/app/sitemap.ts"), "utf8");
  assert.doesNotMatch(
    sitemapSrc,
    /live-demos/,
    "les aperçus /live-demos/* ne doivent jamais entrer dans le sitemap",
  );
});
