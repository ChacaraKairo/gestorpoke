import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { z } from "zod";
import { listBuilds } from "./builds";
import {
  closeDatabase,
  createPokemon,
  createTeam,
  executeImport,
  getDashboardSummary,
  getDatabase,
  listPokemon,
  listTeams,
  removePokemon,
  validateImport,
} from "./database";

const createPokemonSchema = z.object({
  speciesName: z.string().trim().min(1),
  nationalDexNumber: z.number().int().positive().nullable().optional(),
  nickname: z.string().trim().nullable().optional(),
  formName: z.string().trim().default("default"),
  types: z.array(z.string().trim().min(1)).max(2).default([]),
  ownershipStatus: z.enum(["permanent", "trial", "visitor"]),
  acquisitionSource: z.enum(["champions", "pokemon_home", "other"]),
  buildName: z.string().trim().min(1),
  ability: z.string().trim().nullable().optional(),
  statAlignment: z.string().trim().nullable().optional(),
});

const createTeamSchema = z.object({
  name: z.string().trim().min(1),
  format: z.enum(["single", "double"]),
  description: z.string().trim().nullable().optional(),
  buildIds: z.array(z.number().int().positive()).max(6),
});

function registerIpc(): void {
  ipcMain.handle("dashboard:get-summary", () => getDashboardSummary());
  ipcMain.handle("pokemon:list", () => listPokemon());
  ipcMain.handle("pokemon:create", (_event, input: unknown) => createPokemon(createPokemonSchema.parse(input)));
  ipcMain.handle("pokemon:remove", (_event, id: unknown) => {
    const parsedId = z.number().int().positive().parse(id);
    removePokemon(parsedId);
  });
  ipcMain.handle("builds:list", () => listBuilds());
  ipcMain.handle("teams:list", () => listTeams());
  ipcMain.handle("teams:create", (_event, input: unknown) => createTeam(createTeamSchema.parse(input)));
  ipcMain.handle("imports:validate", (_event, jsonText: unknown) => validateImport(z.string().parse(jsonText)));
  ipcMain.handle("imports:execute", (_event, jsonText: unknown) => executeImport(z.string().parse(jsonText)));
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#11162a",
    title: "GestorPoke",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  getDatabase();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", closeDatabase);
