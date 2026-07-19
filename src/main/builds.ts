import type {
  BuildDetail,
  BuildMove,
  BuildStat,
  BuildSummary,
  StatCode,
  UpsertBuildInput,
} from "../shared/contracts";
import { statCodes } from "../shared/contracts";
import { getOfficialArtworkUrl } from "./catalog";
import { getDatabase } from "./database";

function mapSummary(row: Record<string, unknown>): BuildSummary {
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
  };
}

function getSummaryRow(id: number): Record<string, unknown> | undefined {
  return getDatabase().prepare(`
    SELECT
      b.id,
      b.owned_pokemon_id,
      s.name AS species_name,
      s.national_dex_number,
      COALESCE(op.nickname, s.name) AS pokemon_name,
      b.name AS build_name,
      b.battle_format,
      b.ability,
      b.stat_alignment,
      b.held_item,
      b.notes
    FROM builds b
    JOIN owned_pokemon op ON op.id = b.owned_pokemon_id
    JOIN species s ON s.id = op.species_id
    WHERE b.id = ?
  `).get(id) as Record<string, unknown> | undefined;
}

export function listBuilds(): BuildSummary[] {
  const rows = getDatabase().prepare(`
    SELECT
      b.id,
      b.owned_pokemon_id,
      s.name AS species_name,
      s.national_dex_number,
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

  return rows.map(mapSummary);
}

export function getBuild(id: number): BuildDetail {
  const row = getSummaryRow(id);
  if (!row) throw new Error("Build não encontrada.");

  const moves = getDatabase().prepare(`
    SELECT slot, name, type, pp
    FROM build_moves
    WHERE build_id = ?
    ORDER BY slot
  `).all(id) as Array<Record<string, unknown>>;

  const stats = getDatabase().prepare(`
    SELECT stat_code, final_value, training_points, modifier
    FROM build_stats
    WHERE build_id = ?
  `).all(id) as Array<Record<string, unknown>>;

  const statsByCode = new Map<StatCode, BuildStat>();
  for (const stat of stats) {
    const statCode = String(stat.stat_code) as StatCode;
    if (!statCodes.includes(statCode)) continue;
    statsByCode.set(statCode, {
      statCode,
      finalValue: stat.final_value == null ? null : Number(stat.final_value),
      trainingPoints: stat.training_points == null ? null : Number(stat.training_points),
      modifier: stat.modifier as BuildStat["modifier"],
    });
  }

  return {
    ...mapSummary(row),
    notes: row.notes == null ? null : String(row.notes),
    moves: moves.map((move) => ({
      slot: Number(move.slot) as BuildMove["slot"],
      name: String(move.name),
      type: move.type == null ? null : String(move.type),
      pp: move.pp == null ? null : Number(move.pp),
    })),
    stats: statCodes.map((statCode) => statsByCode.get(statCode) ?? {
      statCode,
      finalValue: null,
      trainingPoints: null,
      modifier: "neutral",
    }),
  };
}

function validateInput(input: UpsertBuildInput): void {
  if (!input.name.trim()) throw new Error("Informe o nome da build.");
  if (input.moves.length > 4) throw new Error("Uma build pode ter no máximo quatro golpes.");
  if (new Set(input.moves.map((move) => move.slot)).size !== input.moves.length) {
    throw new Error("Existem slots de golpe repetidos.");
  }
  if (new Set(input.stats.map((stat) => stat.statCode)).size !== input.stats.length) {
    throw new Error("Existem atributos repetidos.");
  }
}

function replaceChildren(buildId: number, input: UpsertBuildInput): void {
  const db = getDatabase();
  db.prepare("DELETE FROM build_moves WHERE build_id = ?").run(buildId);
  db.prepare("DELETE FROM build_stats WHERE build_id = ?").run(buildId);

  const insertMove = db.prepare(`
    INSERT INTO build_moves (build_id, slot, name, type, pp)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const move of input.moves) {
    insertMove.run(buildId, move.slot, move.name.trim(), move.type?.trim() || null, move.pp ?? null);
  }

  const insertStat = db.prepare(`
    INSERT INTO build_stats (build_id, stat_code, final_value, training_points, modifier)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const stat of input.stats) {
    insertStat.run(buildId, stat.statCode, stat.finalValue ?? null, stat.trainingPoints ?? null, stat.modifier);
  }
}

export function createBuild(input: UpsertBuildInput): BuildDetail {
  validateInput(input);
  const db = getDatabase();
  const transaction = db.transaction(() => {
    const owned = db.prepare("SELECT id FROM owned_pokemon WHERE id = ?").get(input.ownedPokemonId);
    if (!owned) throw new Error("Pokémon não encontrado.");

    const result = db.prepare(`
      INSERT INTO builds
        (owned_pokemon_id, name, battle_format, ability, stat_alignment, held_item, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.ownedPokemonId,
      input.name.trim(),
      input.format,
      input.ability?.trim() || null,
      input.statAlignment?.trim() || null,
      input.heldItem?.trim() || null,
      input.notes?.trim() || null,
    );
    const id = Number(result.lastInsertRowid);
    replaceChildren(id, input);
    return id;
  });

  return getBuild(transaction());
}

export function updateBuild(id: number, input: UpsertBuildInput): BuildDetail {
  validateInput(input);
  const db = getDatabase();
  const transaction = db.transaction(() => {
    const result = db.prepare(`
      UPDATE builds
      SET owned_pokemon_id = ?, name = ?, battle_format = ?, ability = ?, stat_alignment = ?,
          held_item = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      input.ownedPokemonId,
      input.name.trim(),
      input.format,
      input.ability?.trim() || null,
      input.statAlignment?.trim() || null,
      input.heldItem?.trim() || null,
      input.notes?.trim() || null,
      id,
    );
    if (result.changes === 0) throw new Error("Build não encontrada.");
    replaceChildren(id, input);
  });

  transaction();
  return getBuild(id);
}

export function removeBuild(id: number): void {
  const used = getDatabase().prepare("SELECT COUNT(*) AS total FROM team_members WHERE build_id = ?").get(id) as { total: number };
  if (Number(used.total) > 0) throw new Error("Esta build está em uma equipe e não pode ser excluída.");
  const result = getDatabase().prepare("DELETE FROM builds WHERE id = ?").run(id);
  if (result.changes === 0) throw new Error("Build não encontrada.");
}

export function duplicateBuild(id: number): BuildDetail {
  const source = getBuild(id);
  return createBuild({
    ownedPokemonId: source.ownedPokemonId,
    name: `${source.buildName} (cópia)`,
    format: source.format,
    ability: source.ability,
    statAlignment: source.statAlignment,
    heldItem: source.heldItem,
    notes: source.notes,
    moves: source.moves,
    stats: source.stats,
  });
}
