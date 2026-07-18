import Database from "better-sqlite3";
import { app } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  pokemonImportFileSchema,
  type CreatePokemonInput,
  type CreateTeamInput,
  type DashboardSummary,
  type ImportResult,
  type PokemonImportRecord,
  type PokemonSummary,
  type TeamSummary,
} from "../shared/contracts";

let database: Database.Database | null = null;

function getDatabasePath(): string {
  const dataDirectory = join(app.getPath("userData"), "data");
  mkdirSync(dataDirectory, { recursive: true });
  return join(dataDirectory, "gestorpoke.sqlite");
}

export function getDatabase(): Database.Database {
  if (database) return database;

  database = new Database(getDatabasePath());
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  migrate(database);
  return database;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS species (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      national_dex_number INTEGER,
      name TEXT NOT NULL COLLATE NOCASE,
      form_name TEXT NOT NULL DEFAULT 'default',
      types_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, form_name)
    );

    CREATE TABLE IF NOT EXISTS owned_pokemon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      species_id INTEGER NOT NULL,
      nickname TEXT,
      gender TEXT NOT NULL DEFAULT 'unknown',
      ownership_status TEXT NOT NULL CHECK (ownership_status IN ('permanent', 'trial', 'visitor')),
      acquisition_source TEXT NOT NULL CHECK (acquisition_source IN ('champions', 'pokemon_home', 'other')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owned_pokemon_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      battle_format TEXT NOT NULL DEFAULT 'both' CHECK (battle_format IN ('single', 'double', 'both')),
      ability TEXT,
      stat_alignment TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owned_pokemon_id) REFERENCES owned_pokemon(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS build_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      build_id INTEGER NOT NULL,
      slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 4),
      name TEXT NOT NULL,
      type TEXT,
      pp INTEGER,
      FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE,
      UNIQUE(build_id, slot)
    );

    CREATE TABLE IF NOT EXISTS build_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      build_id INTEGER NOT NULL,
      stat_code TEXT NOT NULL,
      final_value INTEGER,
      training_points INTEGER,
      modifier TEXT NOT NULL DEFAULT 'neutral' CHECK (modifier IN ('increased', 'decreased', 'neutral')),
      FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE,
      UNIQUE(build_id, stat_code)
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      battle_format TEXT NOT NULL CHECK (battle_format IN ('single', 'double')),
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      build_id INTEGER NOT NULL,
      position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 6),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE RESTRICT,
      UNIQUE(team_id, position)
    );

    CREATE INDEX IF NOT EXISTS idx_owned_pokemon_species ON owned_pokemon(species_id);
    CREATE INDEX IF NOT EXISTS idx_builds_owned_pokemon ON builds(owned_pokemon_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
  `);
}

function parseTypes(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function listPokemon(): PokemonSummary[] {
  const rows = getDatabase()
    .prepare(`
      SELECT
        op.id,
        s.name AS species_name,
        s.national_dex_number,
        s.form_name,
        s.types_json,
        op.nickname,
        op.ownership_status,
        op.acquisition_source,
        op.created_at,
        (SELECT COUNT(*) FROM builds b2 WHERE b2.owned_pokemon_id = op.id) AS build_count,
        (SELECT ability FROM builds b3 WHERE b3.owned_pokemon_id = op.id ORDER BY b3.id LIMIT 1) AS ability,
        (SELECT stat_alignment FROM builds b4 WHERE b4.owned_pokemon_id = op.id ORDER BY b4.id LIMIT 1) AS stat_alignment
      FROM owned_pokemon op
      JOIN species s ON s.id = op.species_id
      ORDER BY op.created_at DESC, op.id DESC
    `)
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: Number(row.id),
    speciesName: String(row.species_name),
    nationalDexNumber: row.national_dex_number == null ? null : Number(row.national_dex_number),
    nickname: row.nickname == null ? null : String(row.nickname),
    formName: String(row.form_name),
    types: parseTypes(String(row.types_json)),
    ability: row.ability == null ? null : String(row.ability),
    statAlignment: row.stat_alignment == null ? null : String(row.stat_alignment),
    ownershipStatus: row.ownership_status as PokemonSummary["ownershipStatus"],
    acquisitionSource: row.acquisition_source as PokemonSummary["acquisitionSource"],
    buildCount: Number(row.build_count),
    createdAt: String(row.created_at),
  }));
}

function upsertSpecies(record: {
  name: string;
  nationalDexNumber?: number | null;
  formName?: string;
  types?: string[];
}): number {
  const db = getDatabase();
  const formName = record.formName?.trim() || "default";
  const existing = db
    .prepare("SELECT id FROM species WHERE name = ? COLLATE NOCASE AND form_name = ? COLLATE NOCASE")
    .get(record.name.trim(), formName) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE species
      SET national_dex_number = COALESCE(?, national_dex_number),
          types_json = CASE WHEN ? = '[]' THEN types_json ELSE ? END
      WHERE id = ?
    `).run(record.nationalDexNumber ?? null, JSON.stringify(record.types ?? []), JSON.stringify(record.types ?? []), existing.id);
    return existing.id;
  }

  const result = db
    .prepare("INSERT INTO species (national_dex_number, name, form_name, types_json) VALUES (?, ?, ?, ?)")
    .run(record.nationalDexNumber ?? null, record.name.trim(), formName, JSON.stringify(record.types ?? []));
  return Number(result.lastInsertRowid);
}

export function createPokemon(input: CreatePokemonInput): PokemonSummary {
  const db = getDatabase();
  const transaction = db.transaction(() => {
    const speciesId = upsertSpecies({
      name: input.speciesName,
      nationalDexNumber: input.nationalDexNumber,
      formName: input.formName,
      types: input.types,
    });

    const ownedResult = db
      .prepare(`
        INSERT INTO owned_pokemon
          (species_id, nickname, ownership_status, acquisition_source)
        VALUES (?, ?, ?, ?)
      `)
      .run(speciesId, input.nickname ?? null, input.ownershipStatus, input.acquisitionSource);

    db.prepare(`
      INSERT INTO builds
        (owned_pokemon_id, name, ability, stat_alignment)
      VALUES (?, ?, ?, ?)
    `).run(Number(ownedResult.lastInsertRowid), input.buildName.trim(), input.ability ?? null, input.statAlignment ?? null);

    return Number(ownedResult.lastInsertRowid);
  });

  const id = transaction();
  const pokemon = listPokemon().find((item) => item.id === id);
  if (!pokemon) throw new Error("O Pokémon foi criado, mas não pôde ser recuperado.");
  return pokemon;
}

export function removePokemon(id: number): void {
  const result = getDatabase().prepare("DELETE FROM owned_pokemon WHERE id = ?").run(id);
  if (result.changes === 0) throw new Error("Pokémon não encontrado.");
}

export function getDashboardSummary(): DashboardSummary {
  const db = getDatabase();
  const count = (table: string): number => {
    const row = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number };
    return Number(row.total);
  };

  return {
    ownedPokemon: count("owned_pokemon"),
    builds: count("builds"),
    teams: count("teams"),
    recentPokemon: listPokemon().slice(0, 6),
  };
}

export function listTeams(): TeamSummary[] {
  const rows = getDatabase().prepare(`
    SELECT t.id, t.name, t.battle_format, t.description, t.created_at,
           COUNT(tm.id) AS member_count
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC, t.id DESC
  `).all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    format: row.battle_format as TeamSummary["format"],
    description: row.description == null ? null : String(row.description),
    memberCount: Number(row.member_count),
    createdAt: String(row.created_at),
  }));
}

export function createTeam(input: CreateTeamInput): TeamSummary {
  if (input.buildIds.length > 6) throw new Error("Uma equipe pode ter no máximo seis integrantes.");
  if (new Set(input.buildIds).size !== input.buildIds.length) throw new Error("A mesma build não pode ocupar duas posições.");

  const db = getDatabase();
  const transaction = db.transaction(() => {
    const teamResult = db
      .prepare("INSERT INTO teams (name, battle_format, description) VALUES (?, ?, ?)")
      .run(input.name.trim(), input.format, input.description ?? null);
    const teamId = Number(teamResult.lastInsertRowid);
    const insertMember = db.prepare("INSERT INTO team_members (team_id, build_id, position) VALUES (?, ?, ?)");
    input.buildIds.forEach((buildId, index) => insertMember.run(teamId, buildId, index + 1));
    return teamId;
  });

  const id = transaction();
  const team = listTeams().find((item) => item.id === id);
  if (!team) throw new Error("A equipe foi criada, mas não pôde ser recuperada.");
  return team;
}

function importOnePokemon(record: PokemonImportRecord): { pokemon: number; builds: number; warnings: string[] } {
  const db = getDatabase();
  const speciesId = upsertSpecies({
    name: record.species.name,
    nationalDexNumber: record.species.nationalDexNumber,
    formName: record.species.form,
    types: record.species.types,
  });

  const ownedResult = db.prepare(`
    INSERT INTO owned_pokemon
      (species_id, nickname, gender, ownership_status, acquisition_source)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    speciesId,
    record.ownedPokemon.nickname ?? null,
    record.ownedPokemon.gender ?? "unknown",
    record.ownedPokemon.ownershipStatus,
    record.ownedPokemon.acquisitionSource,
  );
  const ownedPokemonId = Number(ownedResult.lastInsertRowid);

  const buildResult = db.prepare(`
    INSERT INTO builds
      (owned_pokemon_id, name, battle_format, ability, stat_alignment, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    ownedPokemonId,
    record.build.name,
    record.build.format,
    record.build.ability ?? null,
    record.build.statAlignment ?? null,
    record.build.notes ?? null,
  );
  const buildId = Number(buildResult.lastInsertRowid);

  const warnings: string[] = [];
  const slots = new Set<number>();
  const insertMove = db.prepare("INSERT INTO build_moves (build_id, slot, name, type, pp) VALUES (?, ?, ?, ?, ?)");
  for (const move of record.build.moves) {
    if (slots.has(move.slot)) throw new Error(`Slot de movimento duplicado: ${move.slot}.`);
    slots.add(move.slot);
    insertMove.run(buildId, move.slot, move.name, move.type ?? null, move.pp ?? null);
  }
  if (record.build.moves.length < 4) warnings.push(`${record.species.name}: build importada com menos de quatro movimentos.`);

  const insertStat = db.prepare(`
    INSERT INTO build_stats
      (build_id, stat_code, final_value, training_points, modifier)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const [statCode, value] of Object.entries(record.build.stats ?? {})) {
    if (!value) continue;
    insertStat.run(buildId, statCode, value.finalValue ?? null, value.trainingPoints ?? null, value.modifier ?? "neutral");
  }

  return { pokemon: 1, builds: 1, warnings };
}

export function validateImport(jsonText: string): { valid: boolean; errors: string[]; count: number } {
  try {
    const json: unknown = JSON.parse(jsonText);
    const result = pokemonImportFileSchema.safeParse(json);
    if (!result.success) {
      return {
        valid: false,
        count: 0,
        errors: result.error.issues.map((issue) => `${issue.path.join(".") || "arquivo"}: ${issue.message}`),
      };
    }
    return { valid: true, errors: [], count: result.data.pokemon.length };
  } catch (error) {
    return { valid: false, count: 0, errors: [error instanceof Error ? error.message : "JSON inválido."] };
  }
}

export function executeImport(jsonText: string): ImportResult {
  const json: unknown = JSON.parse(jsonText);
  const data = pokemonImportFileSchema.parse(json);
  const db = getDatabase();
  const transaction = db.transaction(() => {
    let importedPokemon = 0;
    let importedBuilds = 0;
    const warnings: string[] = [];
    for (const record of data.pokemon) {
      const result = importOnePokemon(record);
      importedPokemon += result.pokemon;
      importedBuilds += result.builds;
      warnings.push(...result.warnings);
    }
    return { importedPokemon, importedBuilds, warnings };
  });
  return transaction();
}

export function closeDatabase(): void {
  database?.close();
  database = null;
}
