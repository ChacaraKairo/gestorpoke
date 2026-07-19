import type { PokedexEntry } from "../shared/contracts";
import { getDatabase, parseTypes } from "./database";

export function listPokedex(): PokedexEntry[] {
  const rows = getDatabase().prepare(`
    SELECT
      s.id,
      s.name AS species_name,
      s.national_dex_number,
      s.form_name,
      s.types_json,
      s.created_at,
      COUNT(DISTINCT op.id) AS owned_count,
      COUNT(DISTINCT b.id) AS build_count
    FROM species s
    LEFT JOIN owned_pokemon op ON op.species_id = s.id
    LEFT JOIN builds b ON b.owned_pokemon_id = op.id
    GROUP BY s.id
    ORDER BY
      CASE WHEN s.national_dex_number IS NULL THEN 1 ELSE 0 END,
      s.national_dex_number,
      s.name COLLATE NOCASE,
      s.form_name COLLATE NOCASE
  `).all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: Number(row.id),
    speciesName: String(row.species_name),
    nationalDexNumber: row.national_dex_number == null ? null : Number(row.national_dex_number),
    formName: String(row.form_name),
    types: parseTypes(String(row.types_json)),
    ownedCount: Number(row.owned_count),
    buildCount: Number(row.build_count),
    firstSeenAt: String(row.created_at),
  }));
}
