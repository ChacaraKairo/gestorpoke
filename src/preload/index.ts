import { contextBridge, ipcRenderer } from "electron";
import type {
  AppApi,
  CreatePokemonInput,
  CreateTeamInput,
  UpsertBuildInput,
} from "../shared/contracts";

const api: AppApi = {
  dashboard: {
    getSummary: () => ipcRenderer.invoke("dashboard:get-summary"),
  },
  pokemon: {
    list: () => ipcRenderer.invoke("pokemon:list"),
    create: (input: CreatePokemonInput) => ipcRenderer.invoke("pokemon:create", input),
    remove: (id: number) => ipcRenderer.invoke("pokemon:remove", id),
  },
  pokedex: {
    list: () => ipcRenderer.invoke("pokedex:list"),
    status: () => ipcRenderer.invoke("pokedex:status"),
    synchronize: () => ipcRenderer.invoke("pokedex:synchronize"),
  },
  builds: {
    list: () => ipcRenderer.invoke("builds:list"),
    get: (id: number) => ipcRenderer.invoke("builds:get", id),
    create: (input: UpsertBuildInput) => ipcRenderer.invoke("builds:create", input),
    update: (id: number, input: UpsertBuildInput) => ipcRenderer.invoke("builds:update", id, input),
    remove: (id: number) => ipcRenderer.invoke("builds:remove", id),
    duplicate: (id: number) => ipcRenderer.invoke("builds:duplicate", id),
  },
  teams: {
    list: () => ipcRenderer.invoke("teams:list"),
    create: (input: CreateTeamInput) => ipcRenderer.invoke("teams:create", input),
  },
  imports: {
    validate: (jsonText: string) => ipcRenderer.invoke("imports:validate", jsonText),
    execute: (jsonText: string) => ipcRenderer.invoke("imports:execute", jsonText),
  },
};

contextBridge.exposeInMainWorld("gestorPoke", api);
