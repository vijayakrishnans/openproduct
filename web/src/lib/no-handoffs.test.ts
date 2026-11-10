// OP-25: nothing on this site sends people to openproduct.live. Its data is
// read from api.openproduct.live, but no page links to the site itself.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("no hand-offs to openproduct.live", () => {
  it("no source file holds a link to the openproduct.live site", () => {
    const offenders = files(join(__dirname, "..")).filter((f) => /https?:\/\/(www\.)?openproduct\.live(?![\w.-])/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
