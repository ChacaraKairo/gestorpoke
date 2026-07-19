import Database from "better-sqlite3";
import { dialog } from "electron";
import { copyFileSync, statSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { FileOperationResult } from "../shared/contracts";
import { getBuild, listBuilds } from "./builds";
import { getCatalogStatus } from "./catalog";
import { closeDatabase, getDatabase, getDatabaseFilePath, listPokemon } from "./database";
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
  const result = await dialog.showSaveDialog({
    title: "Exportar dados do GestorPoke",
    defaultPath: `gestorpoke-export-${timestamp()}.json`,
    filters: [{ name: "Arquivo JSON", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return canceled();

  const builds = listBuilds().map((build) => getBuild(build.id));
  const teams = listTeams().map((team) => getTeam(team.id));
  const payload = {
    schemaVersion: 2,
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