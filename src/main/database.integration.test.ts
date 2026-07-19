import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ root: `/tmp/gestorpoke-vitest-${process.pid}` }));

vi.mock("electron", () => ({
  app: { getPath: () => state.root },
}));

import { listBuilds } from "./builds";
import { ensureCompatibilityTables } from "./compatibility";
import { closeDatabase, getDatabase, getDatabaseFilePath } from "./database";
import { listTeams } from "./teams";

describe("SQLite integration", () => {
  beforeAll(() => {
    rmSync(state.root, { recursive: true, force: true });
    mkdirSync(state.root, { recursive: true });
  });

  afterAll(() => {
    closeDatabase();
    rmSync(state.root, { recursive: true, force: true });
  });

  it("creates the database in the application data directory", () => {
    expect(getDatabaseFilePath()).toBe(join(state.root, "data", "gestorpoke.sqlite"));
    const db = getDatabase();
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("applies the core schema and service extensions", () => {
    const db = getDatabase();
    listBuilds();
    listTeams();
    ensureCompatibilityTables();

    const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((row) => row.name));
    for (const table of [
      "species", "owned_pokemon", "builds", "build_moves", "build_stats", "teams", "team_members",
      "species_ability_compatibility", "species_move_compatibility", "species_compatibility_metadata",
    ]) expect(tables.has(table)).toBe(true);

    const buildColumns = new Set((db.pragma("table_info(builds)") as Array<{ name: string }>).map((row) => row.name));
    const teamColumns = new Set((db.pragma("table_info(teams)") as Array<{ name: string }>).map((row) => row.name));
    expect(buildColumns.has("is_primary")).toBe(true);
    expect(teamColumns.has("regulation_key")).toBe(true);
  });

  it("preserves foreign-key integrity", () => {
    const db = getDatabase();
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
  });
});
