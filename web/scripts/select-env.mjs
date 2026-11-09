// Point the D1 binding at this environment's database before the build.
//
// The deploy runs `wrangler deploy --config wrangler.jsonc` for every
// environment and only changes the worker name, so the one config names the
// stage database and this swaps in prod's when ORUN_ENVIRONMENT is "prod"
// (set by the composition's `environmentBuildVar`). Any other environment,
// including dev's dry run and local builds, keeps stage.
import { readFileSync, writeFileSync } from "node:fs";

const DATABASES = {
  stage: { name: "openproduct-web-stage", id: "c15aee01-e621-4cc1-98ae-d0b0cf399555" },
  prod: { name: "openproduct-web-prod", id: "a0386d5b-256f-45f8-8062-3f6751fba6f6" },
};

const env = process.env.ORUN_ENVIRONMENT === "prod" ? "prod" : "stage";
const target = DATABASES[env];
const path = new URL("../wrangler.jsonc", import.meta.url);
let text = readFileSync(path, "utf8");
for (const db of Object.values(DATABASES)) {
  text = text.replaceAll(db.id, target.id).replaceAll(`"${db.name}"`, `"${target.name}"`);
}
if (!text.includes(target.id)) throw new Error("wrangler.jsonc has no D1 database id to select");
writeFileSync(path, text);
console.log(`D1: ${target.name} (${env})`);
