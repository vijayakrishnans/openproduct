// Tests only: Node's built-in SQLite behind the slice of D1's API the app
// uses, so the real schema and SQL run in the tests. D1 enforces foreign
// keys; so does this.
import { DatabaseSync } from "node:sqlite";
import type { Db, Statement } from "./db";

export function sqliteDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  const statement = (sql: string, params: unknown[] = []): Statement => ({
    bind: (...values: unknown[]) => statement(sql, values),
    first: async <T,>() => (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null,
    all: async <T,>() => ({ results: raw.prepare(sql).all(...(params as never[])) as T[] }),
    run: async () => raw.prepare(sql).run(...(params as never[])),
  });
  return {
    raw,
    prepare: (sql: string) => statement(sql),
    batch: async (statements: Statement[]) => {
      raw.exec("BEGIN");
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        raw.exec("COMMIT");
        return out;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
