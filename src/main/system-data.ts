import { dialog } from "electron";
import { statSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { FileOperationResult } from "../shared/contracts";
import { getBuild, listBuilds } from "./builds";
import { getCatalogStatus } from "./catalog";
import { getDatabase, listPokemon } from "./database";
import { getTeam, listTeams } from "./teams";

function canceled(): FileOperationResult {
  return { canceled: true, filePath: null, bytes: 0, createdAt: null };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
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

export async function exportCompleteJson(): Promise<FileOperationResult> {
  const result = await dialog.showSaveDialog({
    title: "Exportar dados do GestorPoke",
    defaultPath: `gestorpoke-export-${timestamp()}.json`,
    filters: [{ name: "Arquivo JSON", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return canceled();

  const builds = listBuilds().map((build) => getBuild(build.id));
  const teams = listTeams().map((team) => getTeam(team.id));
  const payload = {
    schemaVersion: 1,
    application: "GestorPoke",
    exportedAt: new Date().toISOString(),
    fileName: basename(result.filePath),
    catalog: getCatalogStatus(),
    pokemon: listPokemon(),
    builds,
    teams,
  };
  writeFileSync(result.filePath, JSON.stringify(payload, null, 2), "utf8");
  const info = statSync(result.filePath);
  return { canceled: false, filePath: result.filePath, bytes: info.size, createdAt: payload.exportedAt };
}
