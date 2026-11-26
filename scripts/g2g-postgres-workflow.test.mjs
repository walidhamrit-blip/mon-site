import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Aucun test ci-dessous ne se connecte : toutes les adresses sont rejetées.
test("le script réel refuse toute cible non autorisée avant connexion et ne divulgue pas l'URL", () => {
  for (const value of ["", "not-a-url-secret", "postgresql://postgres:fake-password@db.other.supabase.co:5432/postgres", "postgresql://postgres.other:fake-password@aws-0-eu-west-1.pooler.supabase.com:6543/postgres", "postgresql://postgres:fake-password@db.tghunxntbjtkvvmyvxwh.supabase.co:5432/postgres?sslmode=disable"]) {
    const result = spawnSync(process.execPath,["scripts/g2g-postgres-integration.mjs"],{env:{...process.env,G2G_TEST_DATABASE_URL:value},encoding:"utf8",timeout:10000});
    assert.equal(result.status,1);
    assert.equal(result.stdout,"");
    assert.doesNotMatch(result.stderr,/fake-password|not-a-url-secret/);
  }
});

test("le workflow est uniquement manuel et le secret est limité à l'étape de test", () => {
  const workflow=readFileSync(".github/workflows/g2g-postgres-manual.yml","utf8");
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/pull_request:|push:|schedule:/);
  assert.match(workflow,/npm ci --ignore-scripts/);
  assert.match(workflow,/G2G_TEST_DATABASE_URL: \$\{\{ secrets\.G2G_TEST_DATABASE_URL \}\}/);
  assert.match(workflow,/persist-credentials: false/);
});

test("diagnostic : erreurs classées sans jamais afficher le message ni le secret", async () => {
  const {safePostgresError} = await import("./g2g-postgres-diagnostic.mjs");
  for (const [code, fragment] of [["28P01","Authentification"],["ENETUNREACH","Réseau inaccessible"],["42P01","Table prototype"],["G2G_TARGET_INVALID","URI refusée"],["SELF_SIGNED_CERT_IN_CHAIN","TLS"]]) {
    const message = safePostgresError({code,message:"postgresql://private-secret"});
    assert.match(message,new RegExp(fragment));
    assert.doesNotMatch(message,/private-secret|postgresql/);
  }
  assert.doesNotMatch(safePostgresError({code:"private-secret",message:"private-secret"}),/private-secret/);
});


test("certificat invalide refusé avant connexion sans en afficher le contenu", () => {
  const result = spawnSync(process.execPath,["scripts/g2g-postgres-integration.mjs"],{
    env:{...process.env,G2G_TEST_DATABASE_URL:"postgresql://postgres.tghunxntbjtkvvmyvxwh:fake-password@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",G2G_TEST_DATABASE_CA:"not-a-certificate-secret"},encoding:"utf8",timeout:10000
  });
  assert.equal(result.status,1);
  assert.match(result.stderr,/Certificat CA invalide/);
  assert.doesNotMatch(result.stderr,/fake-password|not-a-certificate-secret/);
});
