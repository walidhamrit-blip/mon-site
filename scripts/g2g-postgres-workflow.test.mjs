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
