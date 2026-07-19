import type {
  AbilityCatalogEntry,
  CatalogStatus,
  CatalogSyncResult,
  ItemCatalogEntry,
  MoveCatalogEntry,
} from "../shared/contracts";
import { getDatabase } from "./database";

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
const OFFICIAL_ARTWORK_BASE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";
const CONCURRENCY = 12;

type NamedResource = { name: string; url: string };
type ResourceList = { count: number; results: NamedResource[] };
type PokemonResponse = { id: number; name: string; types: Array<{ slot: number; type: NamedResource }> };
type EffectEntry = { effect: string; short_effect: string; language: NamedResource };
type FlavorTextEntry = { flavor_text: string; language: NamedResource };
type MoveResponse = {
  id: number; name: string; accuracy: number | null; power: number | null; pp: number | null; priority: number;
  type: NamedResource; damage_class: NamedResource; target: NamedResource; effect_entries: EffectEntry[];
};
type AbilityResponse = { id: number; name: string; effect_entries: EffectEntry[]; flavor_text_entries: FlavorTextEntry[] };
type ItemResponse = { id: number; name: string; effect_entries: EffectEntry[]; flavor_text_entries: FlavorTextEntry[]; sprites?: { default?: string | null } };

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
      availability TEXT NOT NULL DEFAULT 'unknown' CHECK (availability IN ('confirmed', 'unavailable', 'unknown')),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalog_abilities (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT,
      availability TEXT NOT NULL DEFAULT 'unknown' CHECK (availability IN ('confirmed', 'unavailable', 'unknown')),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalog_items (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT,
      image_url TEXT,
      availability TEXT NOT NULL DEFAULT 'unknown' CHECK (availability IN ('confirmed', 'unavailable', 'unknown')),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_moves_name ON catalog_moves(name);
    CREATE INDEX IF NOT EXISTS idx_catalog_moves_availability ON catalog_moves(availability);
    CREATE INDEX IF NOT EXISTS idx_catalog_abilities_name ON catalog_abilities(name);
    CREATE INDEX IF NOT EXISTS idx_catalog_items_name ON catalog_items(name);
  `);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "GestorPoke/0.1" } });
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

function englishDescription(effectEntries: EffectEntry[], flavorEntries: FlavorTextEntry[] = []): string | null {
  return effectEntries.find((entry) => entry.language.name === "en")?.short_effect
    ?? flavorEntries.find((entry) => entry.language.name === "en")?.flavor_text.replace(/\s+/g, " ").trim()
    ?? null;
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
  const count = (table: string): number => Number((db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total);
  return {
    speciesCount: Number((db.prepare("SELECT COUNT(*) AS total FROM species WHERE national_dex_number IS NOT NULL").get() as { total: number }).total),
    moveCount: count("catalog_moves"),
    abilityCount: count("catalog_abilities"),
    itemCount: count("catalog_items"),
    synchronizedAt: getMetadata("catalog_synchronized_at") ?? getMetadata("pokedex_synchronized_at"),
    source: "PokéAPI + confirmações do Pokémon Champions",
  };
}

export function listMoves(): MoveCatalogEntry[] {
  ensureCatalogTables();
  return (getDatabase().prepare(`SELECT id, name, type, category, power, accuracy, pp, priority, target, description, availability FROM catalog_moves ORDER BY name COLLATE NOCASE`).all() as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id), name: String(row.name), type: row.type == null ? null : String(row.type),
    category: row.category == null ? null : row.category as MoveCatalogEntry["category"],
    power: row.power == null ? null : Number(row.power), accuracy: row.accuracy == null ? null : Number(row.accuracy),
    pp: row.pp == null ? null : Number(row.pp), priority: Number(row.priority), target: row.target == null ? null : String(row.target),
    description: row.description == null ? null : String(row.description), availability: row.availability as MoveCatalogEntry["availability"],
  }));
}

export function listAbilities(): AbilityCatalogEntry[] {
  ensureCatalogTables();
  return (getDatabase().prepare(`SELECT id, name, description, availability FROM catalog_abilities ORDER BY name COLLATE NOCASE`).all() as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id), name: String(row.name), description: row.description == null ? null : String(row.description), availability: row.availability as AbilityCatalogEntry["availability"],
  }));
}

export function listItems(): ItemCatalogEntry[] {
  ensureCatalogTables();
  return (getDatabase().prepare(`SELECT id, name, description, image_url, availability FROM catalog_items ORDER BY name COLLATE NOCASE`).all() as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id), name: String(row.name), description: row.description == null ? null : String(row.description),
    imageUrl: row.image_url == null ? null : String(row.image_url), availability: row.availability as ItemCatalogEntry["availability"],
  }));
}

export async function synchronizePokedex(): Promise<CatalogSyncResult> {
  ensureCatalogTables();
  const list = await fetchJson<ResourceList>(`${POKEAPI_BASE_URL}/pokemon-species?limit=100000&offset=0`);
  const records = await mapWithConcurrency(list.results, CONCURRENCY, async (resource) => {
    const nationalDexNumber = getIdFromResourceUrl(resource.url);
    const pokemon = await fetchJson<PokemonResponse>(`${POKEAPI_BASE_URL}/pokemon/${nationalDexNumber}`);
    return { nationalDexNumber, name: resource.name, types: pokemon.types.slice().sort((a, b) => a.slot - b.slot).map((entry) => entry.type.name) };
  });
  const db = getDatabase();
  const findByDex = db.prepare("SELECT id FROM species WHERE national_dex_number = ? AND form_name = 'default'");
  const findByName = db.prepare("SELECT id FROM species WHERE name = ? COLLATE NOCASE AND form_name = 'default'");
  const update = db.prepare("UPDATE species SET national_dex_number = ?, name = ?, types_json = ? WHERE id = ?");
  const insert = db.prepare("INSERT INTO species (national_dex_number, name, form_name, types_json) VALUES (?, ?, 'default', ?)");
  const result = db.transaction(() => {
    let imported = 0; let updated = 0;
    for (const record of records) {
      const existing = (findByDex.get(record.nationalDexNumber) ?? findByName.get(record.name)) as { id: number } | undefined;
      if (existing) { update.run(record.nationalDexNumber, record.name, JSON.stringify(record.types), existing.id); updated++; }
      else { insert.run(record.nationalDexNumber, record.name, JSON.stringify(record.types)); imported++; }
    }
    return { imported, updated };
  })();
  const synchronizedAt = new Date().toISOString();
  setMetadata("pokedex_synchronized_at", synchronizedAt); setMetadata("catalog_synchronized_at", synchronizedAt);
  return { ...getCatalogStatus(), ...result, synchronizedAt };
}

async function synchronizeNamedCatalog<T extends { id: number; name: string }>(
  endpoint: "move" | "ability" | "item",
  mapper: (resource: NamedResource) => Promise<T>,
  upsert: (record: T) => void,
  table: string,
): Promise<CatalogSyncResult> {
  ensureCatalogTables();
  const list = await fetchJson<ResourceList>(`${POKEAPI_BASE_URL}/${endpoint}?limit=100000&offset=0`);
  const records = await mapWithConcurrency(list.results, CONCURRENCY, mapper);
  const existingIds = new Set((getDatabase().prepare(`SELECT id FROM ${table}`).all() as Array<{ id: number }>).map((row) => row.id));
  let imported = 0; let updated = 0;
  getDatabase().transaction(() => { for (const record of records) { existingIds.has(record.id) ? updated++ : imported++; upsert(record); } })();
  const synchronizedAt = new Date().toISOString();
  setMetadata(`${endpoint}s_synchronized_at`, synchronizedAt); setMetadata("catalog_synchronized_at", synchronizedAt);
  return { ...getCatalogStatus(), imported, updated, synchronizedAt };
}

export function synchronizeMoves(): Promise<CatalogSyncResult> {
  const upsert = getDatabase().prepare(`
    INSERT INTO catalog_moves (id, name, type, category, power, accuracy, pp, priority, target, description)
    VALUES (@id, @name, @type, @category, @power, @accuracy, @pp, @priority, @target, @description)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,category=excluded.category,power=excluded.power,accuracy=excluded.accuracy,pp=excluded.pp,priority=excluded.priority,target=excluded.target,description=excluded.description,updated_at=CURRENT_TIMESTAMP
  `);
  return synchronizeNamedCatalog("move", async (resource) => {
    const move = await fetchJson<MoveResponse>(resource.url);
    return { id: move.id, name: move.name, type: move.type?.name ?? null, category: move.damage_class?.name ?? null, power: move.power, accuracy: move.accuracy, pp: move.pp, priority: move.priority, target: move.target?.name ?? null, description: englishDescription(move.effect_entries) };
  }, (record) => upsert.run(record), "catalog_moves");
}

export function synchronizeAbilities(): Promise<CatalogSyncResult> {
  const upsert = getDatabase().prepare(`
    INSERT INTO catalog_abilities (id, name, description) VALUES (@id, @name, @description)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,updated_at=CURRENT_TIMESTAMP
  `);
  return synchronizeNamedCatalog("ability", async (resource) => {
    const ability = await fetchJson<AbilityResponse>(resource.url);
    return { id: ability.id, name: ability.name, description: englishDescription(ability.effect_entries, ability.flavor_text_entries) };
  }, (record) => upsert.run(record), "catalog_abilities");
}

export function synchronizeItems(): Promise<CatalogSyncResult> {
  const upsert = getDatabase().prepare(`
    INSERT INTO catalog_items (id, name, description, image_url) VALUES (@id, @name, @description, @imageUrl)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,image_url=excluded.image_url,updated_at=CURRENT_TIMESTAMP
  `);
  return synchronizeNamedCatalog("item", async (resource) => {
    const item = await fetchJson<ItemResponse>(resource.url);
    return { id: item.id, name: item.name, description: englishDescription(item.effect_entries, item.flavor_text_entries), imageUrl: item.sprites?.default ?? null };
  }, (record) => upsert.run(record), "catalog_items");
}
