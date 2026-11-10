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
// Each environment's cover bucket (list-your-build LB5).
text = text.replace(/"openproduct-web-covers-(stage|prod)"/, `"openproduct-web-covers-${env}"`);
if (!text.includes(`"openproduct-web-covers-${env}"`)) throw new Error("wrangler.jsonc has no cover bucket to select");
// Demo sign-in is for stage only: prod must never sign anyone in without a provider.
text = text.replace(/"DEMO_SIGNIN":\s*"[^"]*"/, `"DEMO_SIGNIN": "${env === "prod" ? "off" : "on"}"`);
if (env === "prod" && !text.includes('"DEMO_SIGNIN": "off"')) throw new Error("could not turn demo sign-in off for prod");
writeFileSync(path, text);
console.log(`D1: ${target.name} (${env}); covers: openproduct-web-covers-${env}; demo sign-in ${env === "prod" ? "off" : "on"}`);
