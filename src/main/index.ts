import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { z } from "zod";
import { createBattle, getBattleStats, listBattles, removeBattle } from "./battles";
import { compareBuilds, createBuild, duplicateBuild, getBuild, listBuilds, removeBuild, setPrimaryBuild, updateBuild } from "./builds";
import { getCatalogStatus, listAbilities, listItems, listMoves, synchronizeAbilities, synchronizeItems, synchronizeMoves, synchronizePokedex } from "./catalog";
import { getPokemonCompatibility, synchronizePokemonCompatibility } from "./compatibility";
import { closeDatabase, createPokemon, executeImport, getDashboardSummary, getDatabase, listPokemon, removePokemon, validateImport } from "./database";
import { cacheImageAsDataUrl } from "./image-cache";
import { executeImportWithPolicies, previewImport } from "./import-review";
import { getOwnedPokemonDetail, updateOwnedPokemon } from "./pokemon-management";
import { listPokedex } from "./pokedex";
import { createDatabaseBackup, exportCompleteJson, restoreDatabaseBackup } from "./system-data";
import { analyzeTeam } from "./team-analysis";
import { createTeam, getTeam, listTeams, removeTeam, updateTeam, validateTeam } from "./teams";

const positiveIdSchema = z.number().int().positive();
const createPokemonSchema = z.object({ speciesName:z.string().trim().min(1), nationalDexNumber:z.number().int().positive().nullable().optional(), nickname:z.string().trim().nullable().optional(), formName:z.string().trim().default("default"), types:z.array(z.string().trim().min(1)).max(2).default([]), ownershipStatus:z.enum(["permanent","trial","visitor"]), acquisitionSource:z.enum(["champions","pokemon_home","other"]), buildName:z.string().trim().min(1), ability:z.string().trim().nullable().optional(), statAlignment:z.string().trim().nullable().optional(), heldItem:z.string().trim().nullable().optional() });
const updatePokemonSchema = z.object({ nickname:z.string().trim().nullable().optional(), gender:z.enum(["male","female","genderless","unknown"]), ownershipStatus:z.enum(["permanent","trial","visitor"]), acquisitionSource:z.enum(["champions","pokemon_home","other"]), notes:z.string().trim().max(10000).nullable().optional() });
const upsertTeamSchema = z.object({ name:z.string().trim().min(1), format:z.enum(["single","double"]), description:z.string().trim().nullable().optional(), regulationKey:z.enum(["open","pokemon-champions-active-208"]).default("open"), buildIds:z.array(positiveIdSchema).max(6) });
const buildMoveSchema = z.object({ slot:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4)]), name:z.string().trim().min(1), type:z.string().trim().nullable(), pp:z.number().int().nonnegative().nullable() });
const buildStatSchema = z.object({ statCode:z.enum(["hp","attack","defense","specialAttack","specialDefense","speed"]), finalValue:z.number().int().nonnegative().nullable(), trainingPoints:z.number().int().nonnegative().nullable(), modifier:z.enum(["increased","decreased","neutral"]) });
const upsertBuildSchema = z.object({ ownedPokemonId:positiveIdSchema, name:z.string().trim().min(1), format:z.enum(["single","double","both"]), ability:z.string().trim().nullable().optional(), statAlignment:z.string().trim().nullable().optional(), heldItem:z.string().trim().nullable().optional(), notes:z.string().trim().nullable().optional(), moves:z.array(buildMoveSchema).max(4), stats:z.array(buildStatSchema).max(6) });
const battleSchema = z.object({ teamId:positiveIdSchema, opponent:z.string().trim().max(200).nullable().optional(), result:z.enum(["win","loss","draw"]), selectedBuildIds:z.array(positiveIdSchema).min(1).max(6), leadBuildIds:z.array(positiveIdSchema).min(1).max(2), notes:z.string().trim().max(10000).nullable().optional(), playedAt:z.string().datetime().optional() });
const importResolutionSchema = z.object({ index:z.number().int().nonnegative(), policy:z.enum(["create","ignore","replace","merge"]), targetPokemonId:positiveIdSchema.nullable().optional() });

function registerIpc(): void {
  ipcMain.handle("dashboard:get-summary", () => getDashboardSummary());
  ipcMain.handle("pokemon:list", () => listPokemon());
  ipcMain.handle("pokemon:get", (_event,id:unknown) => getOwnedPokemonDetail(positiveIdSchema.parse(id)));
  ipcMain.handle("pokemon:create", (_event,input:unknown) => createPokemon(createPokemonSchema.parse(input)));
  ipcMain.handle("pokemon:update", (_event,id:unknown,input:unknown) => updateOwnedPokemon(positiveIdSchema.parse(id),updatePokemonSchema.parse(input)));
  ipcMain.handle("pokemon:remove", (_event,id:unknown) => removePokemon(positiveIdSchema.parse(id)));
  ipcMain.handle("pokedex:list", () => listPokedex());
  ipcMain.handle("pokedex:status", () => getCatalogStatus());
  ipcMain.handle("pokedex:synchronize", () => synchronizePokedex());
  ipcMain.handle("moves:list", () => listMoves());
  ipcMain.handle("moves:synchronize", () => synchronizeMoves());
  ipcMain.handle("abilities:list", () => listAbilities());
  ipcMain.handle("abilities:synchronize", () => synchronizeAbilities());
  ipcMain.handle("items:list", () => listItems());
  ipcMain.handle("items:synchronize", () => synchronizeItems());
  ipcMain.handle("compatibility:get", (_event,id:unknown) => getPokemonCompatibility(positiveIdSchema.parse(id)));
  ipcMain.handle("compatibility:synchronize", (_event,id:unknown) => synchronizePokemonCompatibility(positiveIdSchema.parse(id)));
  ipcMain.handle("images:cache", (_event,url:unknown) => cacheImageAsDataUrl(z.string().url().max(2000).parse(url)));
  ipcMain.handle("builds:list", () => listBuilds());
  ipcMain.handle("builds:get", (_event,id:unknown) => getBuild(positiveIdSchema.parse(id)));
  ipcMain.handle("builds:create", (_event,input:unknown) => createBuild(upsertBuildSchema.parse(input)));
  ipcMain.handle("builds:update", (_event,id:unknown,input:unknown) => updateBuild(positiveIdSchema.parse(id),upsertBuildSchema.parse(input)));
  ipcMain.handle("builds:remove", (_event,id:unknown) => removeBuild(positiveIdSchema.parse(id)));
  ipcMain.handle("builds:duplicate", (_event,id:unknown) => duplicateBuild(positiveIdSchema.parse(id)));
  ipcMain.handle("builds:set-primary", (_event,id:unknown) => setPrimaryBuild(positiveIdSchema.parse(id)));
  ipcMain.handle("builds:compare", (_event,left:unknown,right:unknown) => compareBuilds(positiveIdSchema.parse(left),positiveIdSchema.parse(right)));
  ipcMain.handle("teams:list", () => listTeams());
  ipcMain.handle("teams:get", (_event,id:unknown) => getTeam(positiveIdSchema.parse(id)));
  ipcMain.handle("teams:create", (_event,input:unknown) => createTeam(upsertTeamSchema.parse(input)));
  ipcMain.handle("teams:update", (_event,id:unknown,input:unknown) => updateTeam(positiveIdSchema.parse(id),upsertTeamSchema.parse(input)));
  ipcMain.handle("teams:remove", (_event,id:unknown) => removeTeam(positiveIdSchema.parse(id)));
  ipcMain.handle("teams:validate", (_event,id:unknown) => validateTeam(positiveIdSchema.parse(id)));
  ipcMain.handle("teams:analyze", (_event,id:unknown) => analyzeTeam(positiveIdSchema.parse(id)));
  ipcMain.handle("battles:list", () => listBattles());
  ipcMain.handle("battles:create", (_event,input:unknown) => createBattle(battleSchema.parse(input)));
  ipcMain.handle("battles:remove", (_event,id:unknown) => removeBattle(positiveIdSchema.parse(id)));
  ipcMain.handle("battles:stats", () => getBattleStats());
  ipcMain.handle("imports:validate", (_event,jsonText:unknown) => validateImport(z.string().max(10_000_000).parse(jsonText)));
  ipcMain.handle("imports:preview", (_event,jsonText:unknown) => previewImport(z.string().max(10_000_000).parse(jsonText)));
  ipcMain.handle("imports:execute", (_event,jsonText:unknown) => executeImport(z.string().max(10_000_000).parse(jsonText)));
  ipcMain.handle("imports:execute-resolved", (_event,jsonText:unknown,resolutions:unknown) => executeImportWithPolicies(z.string().max(10_000_000).parse(jsonText),z.array(importResolutionSchema).parse(resolutions)));
  ipcMain.handle("data:backup", () => createDatabaseBackup());
  ipcMain.handle("data:restore", () => restoreDatabaseBackup());
  ipcMain.handle("data:export-json", () => exportCompleteJson());
}

function createWindow(): void {
  const window = new BrowserWindow({ width:1440,height:900,minWidth:1024,minHeight:700,show:false,icon:join(app.getAppPath(),"build/icon.png"),backgroundColor:"#11162a",title:"GestorPoke",webPreferences:{ preload:join(__dirname,"../preload/index.js"),contextIsolation:true,nodeIntegration:false,sandbox:true } });
  window.once("ready-to-show",()=>window.show());
  window.webContents.setWindowOpenHandler(({url})=>{ if(url.startsWith("https://")) void shell.openExternal(url); return {action:"deny"}; });
  window.webContents.on("will-navigate",(event,url)=>{ if(!url.startsWith("file://")&&!url.startsWith(process.env.ELECTRON_RENDERER_URL??"file://")) event.preventDefault(); });
  if(process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL); else void window.loadFile(join(__dirname,"../renderer/index.html"));
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.whenReady().then(async()=>{ getDatabase(); registerIpc(); const catalog=getCatalogStatus(); if(!catalog.synchronizedAt){ try{ await synchronizePokedex(); } catch(error){ console.error("Não foi possível sincronizar a Pokédex completa no primeiro início.",error); } } createWindow(); app.on("activate",()=>{ if(BrowserWindow.getAllWindows().length===0) createWindow(); }); });
app.on("window-all-closed",()=>{ if(process.platform!=="darwin") app.quit(); });
app.on("before-quit",closeDatabase);
