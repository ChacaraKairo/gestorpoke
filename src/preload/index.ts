import { contextBridge, ipcRenderer } from "electron";
import type { AppApi, CreatePokemonInput, CreateTeamInput } from "../shared/contracts";

const api: AppApi = {
  dashboard: {
    getSummary: () => ipcRenderer.invoke("dashboard:get-summary"),
  },
  pokemon: {
    list: () => ipcRenderer.invoke("pokemon:list"),
    create: (input: CreatePokemonInput) => ipcRenderer.invoke("pokemon:create", input),
    remove: (id: number) => ipcRenderer.invoke("pokemon:remove", id),
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
