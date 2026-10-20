import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const nextConfigSrc = fs.readFileSync(path.join(rootDir, "next.config.ts"), "utf8");
const middlewareSrc = fs.readFileSync(path.join(rootDir, "src/middleware.ts"), "utf8");
const contentSrc = fs.readFileSync(path.join(rootDir, "src/lib/content.ts"), "utf8");
const csrfSrc = fs.readFileSync(path.join(rootDir, "src/lib/csrf.ts"), "utf8");

test("CSP frame-src autorise 'self' et tous les sites clients HTTPS en iframe", () => {
  assert.match(
    nextConfigSrc,
    /frame-src\s+'self'\s+https:/,
    "frame-src doit inclure 'self' et https: pour que toutes les démos clients (dont demo-cabinet-medecin.vercel.app et les domaines clients ajoutés dans /admin) s'affichent sans blocage navigateur",
  );
});

test("CSP et middleware n'interdisent jamais l'embarquement même-origine (/live-demos/*)", () => {
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
    middlewareSrc,
    /"X-Frame-Options",\s*"DENY"/,
    "src/middleware.ts ne doit jamais forcer X-Frame-Options: DENY",
  );
});

test("Permissions-Policy autorise le plein écran (fullscreen=*) sans avertissement console", () => {
  assert.match(nextConfigSrc, /fullscreen=\*/);
  assert.match(middlewareSrc, /fullscreen=\*/);
});

test("Toutes les images distantes de démos dans content.ts sont couvertes par next.config.ts", () => {
  const imageHosts = [
    ...new Set(
      [...contentSrc.matchAll(/image:\s*"https:\/\/([^/"]+)\//g)].map((m) => m[1]),
    ),
  ];
  assert.ok(imageHosts.length >= 8, "Au moins 8 hôtes d'images distants attendus");
  for (const host of imageHosts) {
    assert.ok(
      nextConfigSrc.includes(`"${host}"`),
      `L'hôte d'image ${host} (ex. demo-cabinet-medecin.vercel.app) doit être explicitement déclaré dans images.remotePatterns`,
    );
  }
});

test("CSRF accepte l'hôte réel de la requête (Host / X-Forwarded-Host / VERCEL_URL)", () => {
  assert.match(csrfSrc, /x-forwarded-host/);
  assert.match(csrfSrc, /VERCEL_URL/);
  assert.match(csrfSrc, /VERCEL_PROJECT_PRODUCTION_URL/);
});
