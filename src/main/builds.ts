import type {
  BuildComparison,
  BuildDetail,
  BuildMove,
  BuildStat,
  BuildSummary,
  StatCode,
  UpsertBuildInput,
} from "../shared/contracts";
import { statCodes } from "../shared/contracts";
import { getOfficialArtworkUrl } from "./catalog";
import { validateBuildCompatibility } from "./compatibility";
import { getDatabase } from "./database";

function ensurePrimaryColumn(): void {
  const db = getDatabase();
  const columns = db.pragma("table_info(builds)") as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "is_primary")) {
    db.exec("ALTER TABLE builds ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_builds_primary ON builds(owned_pokemon_id, is_primary)");
  const pokemonIds = db.prepare("SELECT id FROM owned_pokemon").all() as Array<{ id: number }>;
  const firstBuild = db.prepare("SELECT id FROM builds WHERE owned_pokemon_id = ? ORDER BY id LIMIT 1");
  const hasPrimary = db.prepare("SELECT id FROM builds WHERE owned_pokemon_id = ? AND is_primary = 1 LIMIT 1");
  const mark = db.prepare("UPDATE builds SET is_primary = 1 WHERE id = ?");
  db.transaction(() => {
    for (const pokemon of pokemonIds) {
      if (hasPrimary.get(pokemon.id)) continue;
      const first = firstBuild.get(pokemon.id) as { id: number } | undefined;
      if (first) mark.run(first.id);
    }
  })();
}

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
    isPrimary: Number(row.is_primary ?? 0) === 1,
  };
}

function getSummaryRow(id: number): Record<string, unknown> | undefined {
  ensurePrimaryColumn();
  return getDatabase().prepare(`
    SELECT b.id, b.owned_pokemon_id, s.name AS species_name, s.national_dex_number,
           COALESCE(op.nickname, s.name) AS pokemon_name, b.name AS build_name,
           b.battle_format, b.ability, b.stat_alignment, b.held_item, b.notes, b.is_primary
    FROM builds b
    JOIN owned_pokemon op ON op.id = b.owned_pokemon_id
    JOIN species s ON s.id = op.species_id
    WHERE b.id = ?
  `).get(id) as Record<string, unknown> | undefined;
}

export function listBuilds(): BuildSummary[] {
  ensurePrimaryColumn();
  const rows = getDatabase().prepare(`
    SELECT b.id, b.owned_pokemon_id, s.name AS species_name, s.national_dex_number,
           COALESCE(op.nickname, s.name) AS pokemon_name, b.name AS build_name,
           b.battle_format, b.ability, b.stat_alignment, b.held_item, b.is_primary
    FROM builds b
    JOIN owned_pokemon op ON op.id = b.owned_pokemon_id
    JOIN species s ON s.id = op.species_id
    ORDER BY pokemon_name COLLATE NOCASE, b.is_primary DESC, b.name COLLATE NOCASE
  `).all() as Array<Record<string, unknown>>;
  return rows.map(mapSummary);
}

export function getBuild(id: number): BuildDetail {
  const row = getSummaryRow(id);
  if (!row) throw new Error("Build não encontrada.");
  const moves = getDatabase().prepare("SELECT slot, name, type, pp FROM build_moves WHERE build_id = ? ORDER BY slot").all(id) as Array<Record<string, unknown>>;
  const stats = getDatabase().prepare("SELECT stat_code, final_value, training_points, modifier FROM build_stats WHERE build_id = ?").all(id) as Array<Record<string, unknown>>;
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
  if (new Set(input.moves.map((move) => move.slot)).size !== input.moves.length) throw new Error("Existem slots de golpe repetidos.");
  if (new Set(input.moves.map((move) => move.name.trim().toLowerCase())).size !== input.moves.length) throw new Error("A mesma build não pode repetir um golpe.");
  if (new Set(input.stats.map((stat) => stat.statCode)).size !== input.stats.length) throw new Error("Existem atributos repetidos.");
  const totalTraining = input.stats.reduce((total, stat) => total + (stat.trainingPoints ?? 0), 0);
  if (totalTraining > 510) throw new Error("O treinamento total da build não pode ultrapassar 510 pontos.");
  if (input.stats.some((stat) => (stat.trainingPoints ?? 0) > 252)) throw new Error("Um atributo não pode receber mais de 252 pontos de treinamento.");
  validateBuildCompatibility(input.ownedPokemonId, input.ability, input.moves);
}

function replaceChildren(buildId: number, input: UpsertBuildInput): void {
  const db = getDatabase();
  db.prepare("DELETE FROM build_moves WHERE build_id = ?").run(buildId);
  db.prepare("DELETE FROM build_stats WHERE build_id = ?").run(buildId);
  const insertMove = db.prepare("INSERT INTO build_moves (build_id, slot, name, type, pp) VALUES (?, ?, ?, ?, ?)");
  for (const move of input.moves) insertMove.run(buildId, move.slot, move.name.trim(), move.type?.trim() || null, move.pp ?? null);
  const insertStat = db.prepare("INSERT INTO build_stats (build_id, stat_code, final_value, training_points, modifier) VALUES (?, ?, ?, ?, ?)");
  for (const stat of input.stats) insertStat.run(buildId, stat.statCode, stat.finalValue ?? null, stat.trainingPoints ?? null, stat.modifier);
}

export function createBuild(input: UpsertBuildInput): BuildDetail {
  ensurePrimaryColumn();
  const db = getDatabase();
  const owned = db.prepare("SELECT id FROM owned_pokemon WHERE id = ?").get(input.ownedPokemonId);
  if (!owned) throw new Error("Pokémon não encontrado.");
  validateInput(input);
  const id = db.transaction(() => {
    const hasBuild = db.prepare("SELECT id FROM builds WHERE owned_pokemon_id = ? LIMIT 1").get(input.ownedPokemonId);
    const result = db.prepare(`
      INSERT INTO builds (owned_pokemon_id, name, battle_format, ability, stat_alignment, held_item, notes, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.ownedPokemonId, input.name.trim(), input.format, input.ability?.trim() || null,
      input.statAlignment?.trim() || null, input.heldItem?.trim() || null, input.notes?.trim() || null, hasBuild ? 0 : 1);
    const buildId = Number(result.lastInsertRowid);
    replaceChildren(buildId, input);
    return buildId;
  })();
  return getBuild(id);
}

export function updateBuild(id: number, input: UpsertBuildInput): BuildDetail {
  ensurePrimaryColumn();
  const db = getDatabase();
  const owned = db.prepare("SELECT id FROM owned_pokemon WHERE id = ?").get(input.ownedPokemonId);
  if (!owned) throw new Error("Pokémon não encontrado.");
  validateInput(input);
  db.transaction(() => {
    const result = db.prepare(`
      UPDATE builds
      SET owned_pokemon_id = ?, name = ?, battle_format = ?, ability = ?, stat_alignment = ?,
          held_item = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(input.ownedPokemonId, input.name.trim(), input.format, input.ability?.trim() || null,
      input.statAlignment?.trim() || null, input.heldItem?.trim() || null, input.notes?.trim() || null, id);
    if (result.changes === 0) throw new Error("Build não encontrada.");
    replaceChildren(id, input);
  })();
  return getBuild(id);
}

export function setPrimaryBuild(id: number): BuildDetail {
  ensurePrimaryColumn();
  const db = getDatabase();
  const row = db.prepare("SELECT owned_pokemon_id FROM builds WHERE id = ?").get(id) as { owned_pokemon_id: number } | undefined;
  if (!row) throw new Error("Build não encontrada.");
  db.transaction(() => {
    db.prepare("UPDATE builds SET is_primary = 0 WHERE owned_pokemon_id = ?").run(row.owned_pokemon_id);
    db.prepare("UPDATE builds SET is_primary = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  })();
  return getBuild(id);
}

export function removeBuild(id: number): void {
  ensurePrimaryColumn();
  const db = getDatabase();
  const source = db.prepare("SELECT owned_pokemon_id, is_primary FROM builds WHERE id = ?").get(id) as { owned_pokemon_id: number; is_primary: number } | undefined;
  if (!source) throw new Error("Build não encontrada.");
  const used = db.prepare("SELECT COUNT(*) AS total FROM team_members WHERE build_id = ?").get(id) as { total: number };
  if (Number(used.total) > 0) throw new Error("Esta build está em uma equipe e não pode ser excluída.");
  db.prepare("DELETE FROM builds WHERE id = ?").run(id);
  if (source.is_primary) {
    const next = db.prepare("SELECT id FROM builds WHERE owned_pokemon_id = ? ORDER BY id LIMIT 1").get(source.owned_pokemon_id) as { id: number } | undefined;
    if (next) db.prepare("UPDATE builds SET is_primary = 1 WHERE id = ?").run(next.id);
  }
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

export function compareBuilds(leftId: number, rightId: number): BuildComparison {
  const left = getBuild(leftId);
  const right = getBuild(rightId);
  const differences: BuildComparison["differences"] = [];
  const add = (field: string, leftValue: unknown, rightValue: unknown) => {
    const l = leftValue == null ? "—" : String(leftValue);
    const r = rightValue == null ? "—" : String(rightValue);
    if (l !== r) differences.push({ field, left: l, right: r });
  };
  add("Formato", left.format, right.format);
  add("Habilidade", left.ability, right.ability);
  add("Item", left.heldItem, right.heldItem);
  add("Stat Alignment", left.statAlignment, right.statAlignment);
  for (const slot of [1, 2, 3, 4] as const) {
    add(`Golpe ${slot}`, left.moves.find((move) => move.slot === slot)?.name, right.moves.find((move) => move.slot === slot)?.name);
  }
  for (const code of statCodes) {
    const l = left.stats.find((stat) => stat.statCode === code);
    const r = right.stats.find((stat) => stat.statCode === code);
    add(`${code} treino`, l?.trainingPoints, r?.trainingPoints);
    add(`${code} valor`, l?.finalValue, r?.finalValue);
  }
  return { left, right, differences };
}