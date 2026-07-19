import type { CatalogStatus, CatalogSyncResult, MoveCatalogEntry } from "../shared/contracts";
import { getDatabase } from "./database";

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
const OFFICIAL_ARTWORK_BASE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";
const CONCURRENCY = 12;

type NamedResource = { name: string; url: string };
type ResourceList = { count: number; results: NamedResource[] };
type PokemonResponse = {
  id: number;
  name: string;
  types: Array<{ slot: number; type: NamedResource }>;
};
type MoveResponse = {
  id: number;
  name: string;
  accuracy: number | null;
  power: number | null;
  pp: number | null;
  priority: number;
  type: NamedResource;
  damage_class: NamedResource;
  target: NamedResource;
  effect_entries: Array<{ effect: string; short_effect: string; language: NamedResource }>;
};

function ensureCatalogTables(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS catalog_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalog_moves (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      type TEXT,
      category TEXT CHECK (category IN ('physical', 'special', 'status')),
      power INTEGER,
      accuracy INTEGER,
      pp INTEGER,
      priority INTEGER NOT NULL DEFAULT 0,
      target TEXT,
      description TEXT,
      availability TEXT NOT NULL DEFAULT 'unknown'
        CHECK (availability IN ('confirmed', 'unavailable', 'unknown')),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_moves_name ON catalog_moves(name);
    CREATE INDEX IF NOT EXISTS idx_catalog_moves_availability ON catalog_moves(availability);
  `);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "GestorPoke/0.1" },
  });
  if (!response.ok) throw new Error(`Falha ao consultar o catálogo (${response.status} ${response.statusText}).`);
  return response.json() as Promise<T>;
}

function getIdFromResourceUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  if (!match) throw new Error(`Não foi possível identificar o recurso: ${url}`);
  return Number(match[1]);
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

function setMetadata(key: string, value: string): void {
  getDatabase().prepare(`
    INSERT INTO catalog_metadata (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value);
}

function getMetadata(key: string): string | null {
  const row = getDatabase().prepare("SELECT value FROM catalog_metadata WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function getOfficialArtworkUrl(nationalDexNumber: number | null): string | null {
  return nationalDexNumber == null ? null : `${OFFICIAL_ARTWORK_BASE_URL}/${nationalDexNumber}.png`;
}

export function getCatalogStatus(): CatalogStatus {
  ensureCatalogTables();
  const db = getDatabase();
  const speciesCount = Number((db.prepare("SELECT COUNT(*) AS total FROM species WHERE national_dex_number IS NOT NULL").get() as { total: number }).total);
  const moveCount = Number((db.prepare("SELECT COUNT(*) AS total FROM catalog_moves").get() as { total: number }).total);
  return {
    speciesCount,
    moveCount,
    synchronizedAt: getMetadata("catalog_synchronized_at") ?? getMetadata("pokedex_synchronized_at"),
    source: "PokéAPI + confirmações do Pokémon Champions",
  };
}

export function listMoves(): MoveCatalogEntry[] {
  ensureCatalogTables();
  const rows = getDatabase().prepare(`
    SELECT id, name, type, category, power, accuracy, pp, priority, target, description, availability
    FROM catalog_moves
    ORDER BY name COLLATE NOCASE
  `).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    type: row.type == null ? null : String(row.type),
    category: row.category == null ? null : row.category as MoveCatalogEntry["category"],
    power: row.power == null ? null : Number(row.power),
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
    pp: row.pp == null ? null : Number(row.pp),
    priority: Number(row.priority),
    target: row.target == null ? null : String(row.target),
    description: row.description == null ? null : String(row.description),
    availability: row.availability as MoveCatalogEntry["availability"],
  }));
}

export async function synchronizePokedex(): Promise<CatalogSyncResult> {
  ensureCatalogTables();
  const list = await fetchJson<ResourceList>(`${POKEAPI_BASE_URL}/pokemon-species?limit=100000&offset=0`);
  const records = await mapWithConcurrency(list.results, CONCURRENCY, async (resource) => {
    const nationalDexNumber = getIdFromResourceUrl(resource.url);
    const pokemon = await fetchJson<PokemonResponse>(`${POKEAPI_BASE_URL}/pokemon/${nationalDexNumber}`);
    return {
      nationalDexNumber,
      name: resource.name,
      types: pokemon.types.slice().sort((a, b) => a.slot - b.slot).map((entry) => entry.type.name),
    };
  });

  const db = getDatabase();
  const findByDex = db.prepare("SELECT id FROM species WHERE national_dex_number = ? AND form_name = 'default'");
  const findByName = db.prepare("SELECT id FROM species WHERE name = ? COLLATE NOCASE AND form_name = 'default'");
  const update = db.prepare("UPDATE species SET national_dex_number = ?, name = ?, types_json = ? WHERE id = ?");
  const insert = db.prepare("INSERT INTO species (national_dex_number, name, form_name, types_json) VALUES (?, ?, 'default', ?)");

  const result = db.transaction(() => {
    let imported = 0;
    let updated = 0;
    for (const record of records) {
      const existing = (findByDex.get(record.nationalDexNumber) ?? findByName.get(record.name)) as { id: number } | undefined;
      if (existing) {
        update.run(record.nationalDexNumber, record.name, JSON.stringify(record.types), existing.id);
        updated++;
      } else {
        insert.run(record.nationalDexNumber, record.name, JSON.stringify(record.types));
        imported++;
      }
    }
    return { imported, updated };
  })();

  const synchronizedAt = new Date().toISOString();
  setMetadata("pokedex_synchronized_at", synchronizedAt);
  setMetadata("catalog_synchronized_at", synchronizedAt);
  return { ...getCatalogStatus(), ...result, synchronizedAt };
}

export async function synchronizeMoves(): Promise<CatalogSyncResult> {
  ensureCatalogTables();
  const list = await fetchJson<ResourceList>(`${POKEAPI_BASE_URL}/move?limit=100000&offset=0`);
  const records = await mapWithConcurrency(list.results, CONCURRENCY, async (resource) => {
    const move = await fetchJson<MoveResponse>(resource.url);
    const description = move.effect_entries.find((entry) => entry.language.name === "en")?.short_effect ?? null;
    return {
      id: move.id,
      name: move.name,
      type: move.type?.name ?? null,
      category: move.damage_class?.name ?? null,
      power: move.power,
      accuracy: move.accuracy,
      pp: move.pp,
      priority: move.priority,
      target: move.target?.name ?? null,
      description,
    };
  });

  const db = getDatabase();
  const upsert = db.prepare(`
    INSERT INTO catalog_moves (id, name, type, category, power, accuracy, pp, priority, target, description)
    VALUES (@id, @name, @type, @category, @power, @accuracy, @pp, @priority, @target, @description)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      category = excluded.category,
      power = excluded.power,
      accuracy = excluded.accuracy,
      pp = excluded.pp,
      priority = excluded.priority,
      target = excluded.target,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `);
  const existingIds = new Set((db.prepare("SELECT id FROM catalog_moves").all() as Array<{ id: number }>).map((row) => row.id));
  let imported = 0;
  let updated = 0;
  db.transaction(() => {
    for (const record of records) {
      if (existingIds.has(record.id)) updated++; else imported++;
      upsert.run(record);
    }
  })();

  const synchronizedAt = new Date().toISOString();
  setMetadata("moves_synchronized_at", synchronizedAt);
  setMetadata("catalog_synchronized_at", synchronizedAt);
  return { ...getCatalogStatus(), imported, updated, synchronizedAt };
}
