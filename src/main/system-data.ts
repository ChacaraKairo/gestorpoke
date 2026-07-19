import Database from "better-sqlite3";
import { dialog } from "electron";
import { copyFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { statCodes, type BuildDetail, type BuildStat, type FileOperationResult, type JsonImportResult, type TeamDetail, type UpsertBuildInput, type UpsertTeamInput } from "../shared/contracts";
import { createBuild, getBuild, listBuilds, updateBuild } from "./builds";
import { getCatalogStatus } from "./catalog";
import { closeDatabase, getDatabase, getDatabaseFilePath, listPokemon } from "./database";
import { createTeam, getTeam, listTeams, updateTeam } from "./teams";

function canceled(): FileOperationResult {
  return { canceled: true, filePath: null, bytes: 0, createdAt: null };
}

function canceledImport(): JsonImportResult {
  return { ...canceled(), importedBuilds: 0, updatedBuilds: 0, importedTeams: 0, updatedTeams: 0, warnings: [] };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function writeJsonFile(title: string, defaultPath: string, payload: unknown): Promise<FileOperationResult> {
  return dialog.showSaveDialog({
    title,
    defaultPath,
    filters: [{ name: "Arquivo JSON", extensions: ["json"] }],
  }).then((result) => {
    if (result.canceled || !result.filePath) return canceled();
    writeFileSync(result.filePath, JSON.stringify(payload, null, 2), "utf8");
    const info = statSync(result.filePath);
    const exportedAt = typeof payload === "object" && payload !== null && "exportedAt" in payload ? String(payload.exportedAt) : new Date().toISOString();
    return { canceled: false, filePath: result.filePath, bytes: info.size, createdAt: exportedAt };
  });
}

async function chooseJsonFile(title: string): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title,
    properties: ["openFile"],
    filters: [{ name: "Arquivo JSON", extensions: ["json"] }],
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
}

function ownedPokemonSnapshot(ownedPokemonId: number): { speciesName: string; formName: string; nickname: string | null; pokemonName: string; nationalDexNumber: number | null } {
  const row = getDatabase().prepare(`
    SELECT s.name AS species_name, s.form_name, s.national_dex_number, op.nickname, COALESCE(op.nickname, s.name) AS pokemon_name
    FROM owned_pokemon op
    JOIN species s ON s.id = op.species_id
    WHERE op.id = ?
  `).get(ownedPokemonId) as Record<string, unknown> | undefined;
  if (!row) throw new Error("Pokémon da build não encontrado.");
  return {
    speciesName: String(row.species_name),
    formName: String(row.form_name),
    nickname: row.nickname == null ? null : String(row.nickname),
    pokemonName: String(row.pokemon_name),
    nationalDexNumber: row.national_dex_number == null ? null : Number(row.national_dex_number),
  };
}

function buildPayload(build: BuildDetail): ExportedBuildRecord {
  return { pokemon: ownedPokemonSnapshot(build.ownedPokemonId), build };
}

type ExportedBuildRecord = { pokemon: ReturnType<typeof ownedPokemonSnapshot>; build: BuildDetail };
type ExportedTeamRecord = { team: TeamDetail; members: Array<{ pokemon: ReturnType<typeof ownedPokemonSnapshot>; build: BuildDetail; position: number }> };

function teamPayload(team: TeamDetail): ExportedTeamRecord {
  return {
    team,
    members: team.members.map((member) => ({ pokemon: ownedPokemonSnapshot(member.ownedPokemonId), build: getBuild(member.id), position: member.position })),
  };
}

const buildMoveJsonSchema = z.object({ slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), name: z.string().trim().min(1), type: z.string().trim().nullable().optional(), pp: z.number().int().nonnegative().nullable().optional() });
const buildStatJsonSchema = z.object({ statCode: z.enum(statCodes), finalValue: z.number().int().nonnegative().nullable().optional(), trainingPoints: z.number().int().nonnegative().nullable().optional(), modifier: z.enum(["increased", "decreased", "neutral"]).default("neutral") });
const pokemonMatcherSchema = z.object({ speciesName: z.string().trim().min(1), formName: z.string().trim().default("default"), nickname: z.string().trim().nullable().optional(), pokemonName: z.string().trim().optional(), nationalDexNumber: z.number().int().positive().nullable().optional() });
const buildJsonSchema = z.object({
  id: z.number().int().positive().optional(),
  ownedPokemonId: z.number().int().positive().optional(),
  buildName: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  format: z.enum(["single", "double", "both"]).default("both"),
  ability: z.string().trim().nullable().optional(),
  statAlignment: z.string().trim().nullable().optional(),
  heldItem: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  moves: z.array(buildMoveJsonSchema).max(4).default([]),
  stats: z.array(buildStatJsonSchema).max(6).default([]),
}).refine((value) => value.buildName || value.name, "Informe o nome da build.");
const exportedBuildRecordSchema = z.object({ pokemon: pokemonMatcherSchema, build: buildJsonSchema });
const exportedBuildFileSchema = z.object({ schemaVersion: z.literal(1), application: z.literal("GestorPoke"), kind: z.literal("builds"), builds: z.array(exportedBuildRecordSchema).min(1) });
const exportedTeamRecordSchema = z.object({
  team: z.object({ name: z.string().trim().min(1), format: z.enum(["single", "double"]), regulationKey: z.enum(["open", "pokemon-champions-active-208"]).default("open"), description: z.string().trim().nullable().optional() }),
  members: z.array(z.object({ pokemon: pokemonMatcherSchema, build: buildJsonSchema, position: z.number().int().min(1).max(6).optional() })).max(6),
});
const exportedTeamFileSchema = z.object({ schemaVersion: z.literal(1), application: z.literal("GestorPoke"), kind: z.literal("teams"), teams: z.array(exportedTeamRecordSchema).min(1) });

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function findOwnedPokemonId(pokemon: z.infer<typeof pokemonMatcherSchema>): number | null {
  const rows = getDatabase().prepare(`
    SELECT op.id, s.name AS species_name, s.form_name, op.nickname, COALESCE(op.nickname, s.name) AS pokemon_name
    FROM owned_pokemon op
    JOIN species s ON s.id = op.species_id
    WHERE s.name = ? COLLATE NOCASE AND s.form_name = ? COLLATE NOCASE
    ORDER BY op.id
  `).all(pokemon.speciesName, pokemon.formName || "default") as Array<Record<string, unknown>>;
  if (!rows.length) return null;
  const nickname = normalize(pokemon.nickname);
  const pokemonName = normalize(pokemon.pokemonName);
  const exact = rows.find((row) => normalize(String(row.nickname ?? "")) === nickname && (nickname || !row.nickname));
  if (exact) return Number(exact.id);
  const named = rows.find((row) => normalize(String(row.pokemon_name)) === pokemonName);
  if (named) return Number(named.id);
  return rows.length === 1 ? Number(rows[0]?.id) : null;
}

function toBuildInput(ownedPokemonId: number, build: z.infer<typeof buildJsonSchema>): UpsertBuildInput {
  const statsByCode = new Map(build.stats.map((stat) => [stat.statCode, stat]));
  return {
    ownedPokemonId,
    name: build.buildName ?? build.name ?? "Build importada",
    format: build.format,
    ability: build.ability ?? null,
    statAlignment: build.statAlignment ?? null,
    heldItem: build.heldItem ?? null,
    notes: build.notes ?? null,
    moves: build.moves.map((move) => ({ slot: move.slot, name: move.name, type: move.type ?? null, pp: move.pp ?? null })),
    stats: statCodes.map((statCode): BuildStat => {
      const stat = statsByCode.get(statCode);
      return { statCode, finalValue: stat?.finalValue ?? null, trainingPoints: stat?.trainingPoints ?? null, modifier: stat?.modifier ?? "neutral" };
    }),
  };
}

function findBuildId(ownedPokemonId: number, buildName: string): number | null {
  const row = getDatabase().prepare("SELECT id FROM builds WHERE owned_pokemon_id = ? AND name = ? COLLATE NOCASE ORDER BY id LIMIT 1").get(ownedPokemonId, buildName) as { id: number } | undefined;
  return row?.id ?? null;
}

function upsertImportedBuild(record: z.infer<typeof exportedBuildRecordSchema>): { id: number | null; created: boolean; warning: string | null } {
  const ownedPokemonId = findOwnedPokemonId(record.pokemon);
  if (!ownedPokemonId) return { id: null, created: false, warning: `Pokémon não encontrado para build ${record.build.buildName ?? record.build.name}: ${record.pokemon.speciesName} (${record.pokemon.formName}).` };
  const input = toBuildInput(ownedPokemonId, record.build);
  const existingId = findBuildId(ownedPokemonId, input.name);
  const detail = existingId ? updateBuild(existingId, input) : createBuild(input);
  return { id: detail.id, created: !existingId, warning: null };
}

export async function createDatabaseBackup(): Promise<FileOperationResult> {
  const result = await dialog.showSaveDialog({
    title: "Criar backup do GestorPoke",
    defaultPath: `gestorpoke-backup-${timestamp()}.sqlite`,
    filters: [{ name: "Banco SQLite", extensions: ["sqlite", "db"] }],
  });
  if (result.canceled || !result.filePath) return canceled();
  await getDatabase().backup(result.filePath);
  const info = statSync(result.filePath);
  return { canceled: false, filePath: result.filePath, bytes: info.size, createdAt: new Date().toISOString() };
}

export async function restoreDatabaseBackup(): Promise<FileOperationResult> {
  const result = await dialog.showOpenDialog({
    title: "Restaurar backup do GestorPoke",
    properties: ["openFile"],
    filters: [{ name: "Banco SQLite", extensions: ["sqlite", "db"] }],
  });
  const source = result.filePaths[0];
  if (result.canceled || !source) return canceled();

  const verification = new Database(source, { readonly: true, fileMustExist: true });
  try {
    const integrity = verification.pragma("integrity_check") as Array<{ integrity_check: string }>;
    if (!integrity.length || integrity.some((row) => row.integrity_check !== "ok")) throw new Error("O arquivo selecionado não passou na verificação de integridade do SQLite.");
    const tables = verification.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    if (!tables.some((table) => table.name === "owned_pokemon") || !tables.some((table) => table.name === "builds")) throw new Error("O arquivo não parece ser um backup válido do GestorPoke.");
  } finally {
    verification.close();
  }

  const target = getDatabaseFilePath();
  const safetyCopy = `${target}.before-restore-${timestamp()}.sqlite`;
  await getDatabase().backup(safetyCopy);
  closeDatabase();
  copyFileSync(source, target);
  getDatabase();
  const info = statSync(target);
  return { canceled: false, filePath: target, bytes: info.size, createdAt: new Date().toISOString() };
}

export async function exportCompleteJson(): Promise<FileOperationResult> {
  const builds = listBuilds().map((build) => getBuild(build.id));
  const teams = listTeams().map((team) => getTeam(team.id));
  const payload = {
    schemaVersion: 2,
    application: "GestorPoke",
    exportedAt: new Date().toISOString(),
    catalog: getCatalogStatus(),
    pokemon: listPokemon(),
    builds,
    teams,
  };
  return writeJsonFile("Exportar dados do GestorPoke", `gestorpoke-export-${timestamp()}.json`, payload);
}

export async function exportBuildsJson(): Promise<FileOperationResult> {
  const payload = {
    schemaVersion: 1,
    application: "GestorPoke",
    kind: "builds",
    exportedAt: new Date().toISOString(),
    builds: listBuilds().map((build) => buildPayload(getBuild(build.id))),
  };
  return writeJsonFile("Exportar builds do GestorPoke", `gestorpoke-builds-${timestamp()}.json`, payload);
}

export async function importBuildsJson(): Promise<JsonImportResult> {
  const filePath = await chooseJsonFile("Importar builds do GestorPoke");
  if (!filePath) return canceledImport();
  const data = exportedBuildFileSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  let importedBuilds = 0;
  let updatedBuilds = 0;
  const warnings: string[] = [];
  getDatabase().transaction(() => {
    for (const record of data.builds) {
      const result = upsertImportedBuild(record);
      if (result.warning) warnings.push(result.warning);
      else if (result.created) importedBuilds++;
      else updatedBuilds++;
    }
  })();
  const info = statSync(filePath);
  return { canceled: false, filePath, bytes: info.size, createdAt: new Date().toISOString(), importedBuilds, updatedBuilds, importedTeams: 0, updatedTeams: 0, warnings };
}

export async function exportTeamsJson(): Promise<FileOperationResult> {
  const payload = {
    schemaVersion: 1,
    application: "GestorPoke",
    kind: "teams",
    exportedAt: new Date().toISOString(),
    teams: listTeams().map((team) => teamPayload(getTeam(team.id))),
  };
  return writeJsonFile("Exportar equipes do GestorPoke", `gestorpoke-equipes-${timestamp()}.json`, payload);
}

function findTeamId(name: string, format: "single" | "double"): number | null {
  const row = getDatabase().prepare("SELECT id FROM teams WHERE name = ? COLLATE NOCASE AND battle_format = ? ORDER BY id LIMIT 1").get(name, format) as { id: number } | undefined;
  return row?.id ?? null;
}

export async function importTeamsJson(): Promise<JsonImportResult> {
  const filePath = await chooseJsonFile("Importar equipes do GestorPoke");
  if (!filePath) return canceledImport();
  const data = exportedTeamFileSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
  let importedBuilds = 0;
  let updatedBuilds = 0;
  let importedTeams = 0;
  let updatedTeams = 0;
  const warnings: string[] = [];
  getDatabase().transaction(() => {
    for (const record of data.teams) {
      const orderedMembers = record.members.slice().sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
      const buildIds: number[] = [];
      for (const member of orderedMembers) {
        const buildResult = upsertImportedBuild(member);
        if (buildResult.warning) {
          warnings.push(`${record.team.name}: ${buildResult.warning}`);
          continue;
        }
        if (buildResult.id) buildIds.push(buildResult.id);
        if (buildResult.created) importedBuilds++;
        else updatedBuilds++;
      }
      const input: UpsertTeamInput = {
        name: record.team.name,
        format: record.team.format,
        regulationKey: record.team.regulationKey,
        description: record.team.description ?? null,
        buildIds,
      };
      const existingId = findTeamId(input.name, input.format);
      if (existingId) {
        updateTeam(existingId, input);
        updatedTeams++;
      } else {
        createTeam(input);
        importedTeams++;
      }
    }
  })();
  const info = statSync(filePath);
  return { canceled: false, filePath, bytes: info.size, createdAt: new Date().toISOString(), importedBuilds, updatedBuilds, importedTeams, updatedTeams, warnings };
}
