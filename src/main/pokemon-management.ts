import type { BuildSummary, OwnedPokemonDetail, UpdatePokemonInput } from "../shared/contracts";
import { getOfficialArtworkUrl } from "./catalog";
import { getDatabase, listPokemon } from "./database";

function ensurePrimaryColumn(): void {
  const db = getDatabase();
  const columns = db.pragma("table_info(builds)") as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "is_primary")) db.exec("ALTER TABLE builds ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0");
}

function mapBuild(row: Record<string, unknown>): BuildSummary {
  const nationalDexNumber = row.national_dex_number == null ? null : Number(row.national_dex_number);
  return {
    id: Number(row.id),
    ownedPokemonId: Number(row.owned_pokemon_id),
    speciesName: String(row.species_name),
    pokemonName: String(row.pokemon_name),
    imageUrl: getOfficialArtworkUrl(nationalDexNumber),
    buildName: String(row.build_name),
    format: row.battle_format as BuildSummary["format"],
    ability: row.ability == null ? null : String(row.ability),
    statAlignment: row.stat_alignment == null ? null : String(row.stat_alignment),
    heldItem: row.held_item == null ? null : String(row.held_item),
    isPrimary: Number(row.is_primary ?? 0) === 1,
  };
}

export function getOwnedPokemonDetail(id: number): OwnedPokemonDetail {
  ensurePrimaryColumn();
  const row = getDatabase().prepare(`
    SELECT op.id, op.nickname, op.gender, op.ownership_status, op.acquisition_source,
           op.notes, op.created_at, op.updated_at,
           s.name AS species_name, s.national_dex_number, s.form_name, s.types_json
    FROM owned_pokemon op
    JOIN species s ON s.id = op.species_id
    WHERE op.id = ?
  `).get(id) as Record<string, unknown> | undefined;
  if (!row) throw new Error("Pokémon não encontrado.");
  const summary = listPokemon().find((item) => item.id === id);
  if (!summary) throw new Error("Não foi possível carregar o resumo do Pokémon.");
  const builds = getDatabase().prepare(`
    SELECT b.id, b.owned_pokemon_id, s.name AS species_name, s.national_dex_number,
           COALESCE(op.nickname, s.name) AS pokemon_name, b.name AS build_name,
           b.battle_format, b.ability, b.stat_alignment, b.held_item, b.is_primary
    FROM builds b
    JOIN owned_pokemon op ON op.id = b.owned_pokemon_id
    JOIN species s ON s.id = op.species_id
    WHERE b.owned_pokemon_id = ?
    ORDER BY b.is_primary DESC, b.id
  `).all(id) as Array<Record<string, unknown>>;
  return {
    ...summary,
    gender: row.gender as OwnedPokemonDetail["gender"],
    notes: row.notes == null ? null : String(row.notes),
    updatedAt: String(row.updated_at),
    builds: builds.map(mapBuild),
  };
}

export function updateOwnedPokemon(id: number, input: UpdatePokemonInput): OwnedPokemonDetail {
  const result = getDatabase().prepare(`
    UPDATE owned_pokemon
    SET nickname = ?, gender = ?, ownership_status = ?, acquisition_source = ?,
        notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(input.nickname?.trim() || null, input.gender, input.ownershipStatus, input.acquisitionSource, input.notes?.trim() || null, id);
  if (result.changes === 0) throw new Error("Pokémon não encontrado.");
  return getOwnedPokemonDetail(id);
}