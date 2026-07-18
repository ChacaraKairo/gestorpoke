import type { BuildSummary } from "../shared/contracts";
import { getDatabase } from "./database";

export function listBuilds(): BuildSummary[] {
  const rows = getDatabase().prepare(`
    SELECT
      b.id,
      b.owned_pokemon_id,
      s.name AS species_name,
      COALESCE(op.nickname, s.name) AS pokemon_name,
      b.name AS build_name,
      b.battle_format,
      b.ability,
      b.stat_alignment,
      b.held_item
    FROM builds b
    JOIN owned_pokemon op ON op.id = b.owned_pokemon_id
    JOIN species s ON s.id = op.species_id
    ORDER BY pokemon_name COLLATE NOCASE, b.name COLLATE NOCASE
  `).all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: Number(row.id),
    ownedPokemonId: Number(row.owned_pokemon_id),
    speciesName: String(row.species_name),
    pokemonName: String(row.pokemon_name),
    buildName: String(row.build_name),
    format: row.battle_format as BuildSummary["format"],
    ability: row.ability == null ? null : String(row.ability),
    statAlignment: row.stat_alignment == null ? null : String(row.stat_alignment),
    heldItem: row.held_item == null ? null : String(row.held_item),
  }));
}