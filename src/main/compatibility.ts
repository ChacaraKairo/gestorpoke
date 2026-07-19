import type {
  AbilityCatalogEntry,
  MoveCatalogEntry,
  PokemonCompatibility,
} from "../shared/contracts";
import { resolvePokemonApiIdentifiers } from "../shared/pokemon-form";
import { getDatabase } from "./database";

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";

type NamedResource = { name: string; url: string };
type PokemonApiResponse = {
  id: number;
  name: string;
  abilities: Array<{ ability: NamedResource; is_hidden: boolean; slot: number }>;
  moves: Array<{
    move: NamedResource;
    version_group_details: Array<{
      level_learned_at: number;
      move_learn_method: NamedResource;
      version_group: NamedResource;
    }>;
  }>;
};

function resourceId(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  if (!match) throw new Error(`Não foi possível identificar o recurso: ${url}`);
  return Number(match[1]);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "GestorPoke/0.1" },
  });
  if (!response.ok) throw new Error(`Falha ao consultar compatibilidade (${response.status} ${response.statusText}).`);
  return response.json() as Promise<T>;
}

async function fetchPokemonForForm(
  speciesName: string,
  formName: string,
  nationalDexNumber: number | null,
): Promise<PokemonApiResponse> {
  const attempts = resolvePokemonApiIdentifiers(speciesName, formName, nationalDexNumber);
  let lastError: Error | null = null;
  for (const identifier of attempts) {
    try {
      return await fetchJson<PokemonApiResponse>(`${POKEAPI_BASE_URL}/pokemon/${encodeURIComponent(String(identifier))}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Falha ao consultar a forma do Pokémon.");
    }
  }
  throw lastError ?? new Error("Não foi possível localizar a espécie ou forma na PokéAPI.");
}

export function ensureCompatibilityTables(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS species_ability_compatibility (
      species_id INTEGER NOT NULL,
      ability_id INTEGER NOT NULL,
      ability_name TEXT NOT NULL COLLATE NOCASE,
      slot INTEGER NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (species_id, ability_id),
      FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS species_move_compatibility (
      species_id INTEGER NOT NULL,
      move_id INTEGER NOT NULL,
      move_name TEXT NOT NULL COLLATE NOCASE,
      methods_json TEXT NOT NULL DEFAULT '[]',
      version_groups_json TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (species_id, move_id),
      FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS species_compatibility_metadata (
      species_id INTEGER PRIMARY KEY,
      pokemon_api_id INTEGER NOT NULL,
      synchronized_at TEXT NOT NULL,
      FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_species_ability_name ON species_ability_compatibility(ability_name);
    CREATE INDEX IF NOT EXISTS idx_species_move_name ON species_move_compatibility(move_name);
  `);
}

function findOwnedSpecies(ownedPokemonId: number): {
  speciesId: number;
  speciesName: string;
  nationalDexNumber: number | null;
  formName: string;
} {
  const row = getDatabase().prepare(`
    SELECT s.id AS species_id, s.name AS species_name, s.national_dex_number, s.form_name
    FROM owned_pokemon op
    JOIN species s ON s.id = op.species_id
    WHERE op.id = ?
  `).get(ownedPokemonId) as Record<string, unknown> | undefined;
  if (!row) throw new Error("Pokémon não encontrado.");
  return {
    speciesId: Number(row.species_id),
    speciesName: String(row.species_name),
    nationalDexNumber: row.national_dex_number == null ? null : Number(row.national_dex_number),
    formName: String(row.form_name),
  };
}

function parseStringArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function getPokemonCompatibility(ownedPokemonId: number): PokemonCompatibility {
  ensureCompatibilityTables();
  const species = findOwnedSpecies(ownedPokemonId);
  const db = getDatabase();
  const metadata = db.prepare(`SELECT synchronized_at FROM species_compatibility_metadata WHERE species_id = ?`).get(species.speciesId) as { synchronized_at: string } | undefined;
  const abilities = db.prepare(`
    SELECT c.id, c.name, c.description, c.availability, r.slot, r.is_hidden
    FROM species_ability_compatibility r
    LEFT JOIN catalog_abilities c ON c.id = r.ability_id
    WHERE r.species_id = ?
    ORDER BY r.slot, r.ability_name COLLATE NOCASE
  `).all(species.speciesId) as Array<Record<string, unknown>>;
  const moves = db.prepare(`
    SELECT c.id, c.name, c.type, c.category, c.power, c.accuracy, c.pp, c.priority,
           c.target, c.description, c.availability, r.methods_json, r.version_groups_json,
           r.move_id, r.move_name
    FROM species_move_compatibility r
    LEFT JOIN catalog_moves c ON c.id = r.move_id
    WHERE r.species_id = ?
    ORDER BY COALESCE(c.name, r.move_name) COLLATE NOCASE
  `).all(species.speciesId) as Array<Record<string, unknown>>;

  return {
    ownedPokemonId,
    speciesName: species.speciesName,
    formName: species.formName,
    synchronizedAt: metadata?.synchronized_at ?? null,
    abilities: abilities.map((row) => ({
      id: Number(row.id), name: String(row.name),
      description: row.description == null ? null : String(row.description),
      availability: (row.availability ?? "unknown") as AbilityCatalogEntry["availability"],
      slot: Number(row.slot), hidden: Boolean(row.is_hidden),
    })),
    moves: moves.map((row) => ({
      id: Number(row.id ?? row.move_id), name: String(row.name ?? row.move_name),
      type: row.type == null ? null : String(row.type),
      category: row.category == null ? null : row.category as MoveCatalogEntry["category"],
      power: row.power == null ? null : Number(row.power),
      accuracy: row.accuracy == null ? null : Number(row.accuracy),
      pp: row.pp == null ? null : Number(row.pp),
      priority: row.priority == null ? 0 : Number(row.priority),
      target: row.target == null ? null : String(row.target),
      description: row.description == null ? null : String(row.description),
      availability: (row.availability ?? "unknown") as MoveCatalogEntry["availability"],
      methods: parseStringArray(row.methods_json),
      versionGroups: parseStringArray(row.version_groups_json),
    })),
  };
}

export async function synchronizePokemonCompatibility(ownedPokemonId: number): Promise<PokemonCompatibility> {
  ensureCompatibilityTables();
  const species = findOwnedSpecies(ownedPokemonId);
  const pokemon = await fetchPokemonForForm(species.speciesName, species.formName, species.nationalDexNumber);
  const db = getDatabase();

  db.transaction(() => {
    db.prepare("DELETE FROM species_ability_compatibility WHERE species_id = ?").run(species.speciesId);
    db.prepare("DELETE FROM species_move_compatibility WHERE species_id = ?").run(species.speciesId);
    const ensureAbility = db.prepare(`INSERT INTO catalog_abilities (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name`);
    const insertAbility = db.prepare(`INSERT INTO species_ability_compatibility (species_id, ability_id, ability_name, slot, is_hidden) VALUES (?, ?, ?, ?, ?)`);
    for (const entry of pokemon.abilities) {
      const id = resourceId(entry.ability.url);
      ensureAbility.run(id, entry.ability.name);
      insertAbility.run(species.speciesId, id, entry.ability.name, entry.slot, entry.is_hidden ? 1 : 0);
    }
    const ensureMove = db.prepare(`INSERT INTO catalog_moves (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name`);
    const insertMove = db.prepare(`INSERT INTO species_move_compatibility (species_id, move_id, move_name, methods_json, version_groups_json) VALUES (?, ?, ?, ?, ?)`);
    for (const entry of pokemon.moves) {
      const id = resourceId(entry.move.url);
      const methods = Array.from(new Set(entry.version_group_details.map((detail) => detail.move_learn_method.name)));
      const versionGroups = Array.from(new Set(entry.version_group_details.map((detail) => detail.version_group.name)));
      ensureMove.run(id, entry.move.name);
      insertMove.run(species.speciesId, id, entry.move.name, JSON.stringify(methods), JSON.stringify(versionGroups));
    }
    db.prepare(`
      INSERT INTO species_compatibility_metadata (species_id, pokemon_api_id, synchronized_at)
      VALUES (?, ?, ?)
      ON CONFLICT(species_id) DO UPDATE SET pokemon_api_id = excluded.pokemon_api_id, synchronized_at = excluded.synchronized_at
    `).run(species.speciesId, pokemon.id, new Date().toISOString());
  })();

  return getPokemonCompatibility(ownedPokemonId);
}

export function validateBuildCompatibility(ownedPokemonId: number, ability: string | null | undefined, moves: Array<{ name: string }>): void {
  ensureCompatibilityTables();
  const compatibility = getPokemonCompatibility(ownedPokemonId);
  if (!compatibility.synchronizedAt) return;
  const normalize = (value: string): string => value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const allowedAbilities = new Set(compatibility.abilities.map((entry) => normalize(entry.name)));
  const allowedMoves = new Set(compatibility.moves.map((entry) => normalize(entry.name)));
  if (ability?.trim() && !allowedAbilities.has(normalize(ability))) throw new Error(`A habilidade “${ability}” não é compatível com ${compatibility.speciesName} (${compatibility.formName}).`);
  const blockedMoves = moves.map((move) => move.name).filter((name) => !allowedMoves.has(normalize(name)));
  if (blockedMoves.length) throw new Error(`Golpes incompatíveis com ${compatibility.speciesName} (${compatibility.formName}): ${blockedMoves.join(", ")}.`);
}
