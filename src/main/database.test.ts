import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "./database";

describe("migrate", () => {
  it("cria o esquema e registra as migrations aplicadas", () => {
    const db = new Database(":memory:");

    migrate(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = new Set(tables.map((row) => row.name));

    expect(tableNames.has("species")).toBe(true);
    expect(tableNames.has("owned_pokemon")).toBe(true);
    expect(tableNames.has("builds")).toBe(true);
    expect(tableNames.has("teams")).toBe(true);
    expect(tableNames.has("schema_migrations")).toBe(true);

    const applied = db
      .prepare("SELECT version, name FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number; name: string }>;

    expect(applied).toEqual([
      { version: 1, name: "initial-schema" },
      { version: 2, name: "add-held-item-to-builds" },
    ]);

    db.close();
  });

  it("pode ser executada novamente sem duplicar versões", () => {
    const db = new Database(":memory:");

    migrate(db);
    migrate(db);

    const row = db.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get() as { total: number };
    expect(row.total).toBe(2);

    db.close();
  });
});
