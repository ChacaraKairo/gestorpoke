import {
  pokemonImportFileSchema,
  type ImportPreview,
  type ImportResolution,
  type ImportResult,
  type PokemonImportRecord,
} from "../shared/contracts";
import { executeImport, getDatabase, listPokemon } from "./database";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function previewImport(jsonText: string): ImportPreview {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    const result = pokemonImportFileSchema.safeParse(parsed);
    if (!result.success) {
      return {
        valid: false,
        count: 0,
        duplicates: [],
        errors: result.error.issues.map((issue) => `${issue.path.join(".") || "arquivo"}: ${issue.message}`),
      };
    }
    const existing = listPokemon();
    const duplicates = result.data.pokemon.flatMap((record, index) => {
      const species = normalize(record.species.name);
      const nickname = normalize(record.ownedPokemon.nickname);
      const matches = existing.filter((pokemon) => normalize(pokemon.speciesName) === species && (!nickname || normalize(pokemon.nickname) === nickname));
      return matches.length ? [{
        index,
        speciesName: record.species.name,
        nickname: record.ownedPokemon.nickname ?? null,
        existingPokemonIds: matches.map((pokemon) => pokemon.id),
      }] : [];
    });
    return { valid: true, count: result.data.pokemon.length, errors: [], duplicates };
  } catch (error) {
    return { valid: false, count: 0, duplicates: [], errors: [error instanceof Error ? error.message : "JSON inválido."] };
  }
}

function insertBuildForPokemon(ownedPokemonId: number, record: PokemonImportRecord): string[] {
  const db = getDatabase();
  const buildResult = db.prepare(`
    INSERT INTO builds (owned_pokemon_id, name, battle_format, ability, stat_alignment, held_item, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    ownedPokemonId,
    record.build.name,
    record.build.format,
    record.build.ability ?? null,
    record.build.statAlignment ?? null,
    record.build.heldItem ?? null,
    record.build.notes ?? null,
  );
  const buildId = Number(buildResult.lastInsertRowid);
  const insertMove = db.prepare("INSERT INTO build_moves (build_id, slot, name, type, pp) VALUES (?, ?, ?, ?, ?)");
  for (const move of record.build.moves) insertMove.run(buildId, move.slot, move.name, move.type ?? null, move.pp ?? null);
  const insertStat = db.prepare("INSERT INTO build_stats (build_id, stat_code, final_value, training_points, modifier) VALUES (?, ?, ?, ?, ?)");
  for (const [statCode, value] of Object.entries(record.build.stats ?? {})) {
    if (value) insertStat.run(buildId, statCode, value.finalValue ?? null, value.trainingPoints ?? null, value.modifier ?? "neutral");
  }
  return record.build.moves.length < 4 ? [`${record.species.name}: build mesclada com menos de quatro movimentos.`] : [];
}

function removeExistingPokemon(id: number): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM team_members WHERE build_id IN (SELECT id FROM builds WHERE owned_pokemon_id = ?)`).run(id);
  db.prepare("DELETE FROM owned_pokemon WHERE id = ?").run(id);
}

export function executeImportWithPolicies(jsonText: string, resolutions: ImportResolution[]): ImportResult {
  const parsed: unknown = JSON.parse(jsonText);
  const data = pokemonImportFileSchema.parse(parsed);
  const resolutionMap = new Map(resolutions.map((resolution) => [resolution.index, resolution]));
  const createRecords: PokemonImportRecord[] = [];
  let importedBuilds = 0;
  const warnings: string[] = [];

  getDatabase().transaction(() => {
    data.pokemon.forEach((record, index) => {
      const resolution = resolutionMap.get(index) ?? { index, policy: "create" as const };
      if (resolution.policy === "ignore") {
        warnings.push(`${record.species.name}: registro ignorado pela política de importação.`);
        return;
      }
      if (resolution.policy === "merge") {
        if (!resolution.targetPokemonId) throw new Error(`Selecione o Pokémon de destino para mesclar ${record.species.name}.`);
        warnings.push(...insertBuildForPokemon(resolution.targetPokemonId, record));
        importedBuilds += 1;
        return;
      }
      if (resolution.policy === "replace") {
        if (!resolution.targetPokemonId) throw new Error(`Selecione o Pokémon que será substituído por ${record.species.name}.`);
        removeExistingPokemon(resolution.targetPokemonId);
      }
      createRecords.push(record);
    });
  })();

  let importedPokemon = 0;
  if (createRecords.length) {
    const result = executeImport(JSON.stringify({ ...data, pokemon: createRecords }));
    importedPokemon += result.importedPokemon;
    importedBuilds += result.importedBuilds;
    warnings.push(...result.warnings);
  }
  return { importedPokemon, importedBuilds, warnings };
}
