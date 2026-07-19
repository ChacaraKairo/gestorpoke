import { contextBridge, ipcRenderer } from "electron";
import type { AppApi, CreatePokemonInput, UpdatePokemonInput, UpsertBuildInput, UpsertTeamInput } from "../shared/contracts";

const api: AppApi = {
  dashboard:{ getSummary:()=>ipcRenderer.invoke("dashboard:get-summary") },
  pokemon:{ list:()=>ipcRenderer.invoke("pokemon:list"), get:(id:number)=>ipcRenderer.invoke("pokemon:get",id), create:(input:CreatePokemonInput)=>ipcRenderer.invoke("pokemon:create",input), update:(id:number,input:UpdatePokemonInput)=>ipcRenderer.invoke("pokemon:update",id,input), remove:(id:number)=>ipcRenderer.invoke("pokemon:remove",id) },
  pokedex:{ list:()=>ipcRenderer.invoke("pokedex:list"), status:()=>ipcRenderer.invoke("pokedex:status"), synchronize:()=>ipcRenderer.invoke("pokedex:synchronize") },
  moves:{ list:()=>ipcRenderer.invoke("moves:list"), synchronize:()=>ipcRenderer.invoke("moves:synchronize") },
  abilities:{ list:()=>ipcRenderer.invoke("abilities:list"), synchronize:()=>ipcRenderer.invoke("abilities:synchronize") },
  items:{ list:()=>ipcRenderer.invoke("items:list"), synchronize:()=>ipcRenderer.invoke("items:synchronize") },
  compatibility:{ get:(ownedPokemonId:number)=>ipcRenderer.invoke("compatibility:get",ownedPokemonId), synchronize:(ownedPokemonId:number)=>ipcRenderer.invoke("compatibility:synchronize",ownedPokemonId) },
  builds:{ list:()=>ipcRenderer.invoke("builds:list"), get:(id:number)=>ipcRenderer.invoke("builds:get",id), create:(input:UpsertBuildInput)=>ipcRenderer.invoke("builds:create",input), update:(id:number,input:UpsertBuildInput)=>ipcRenderer.invoke("builds:update",id,input), remove:(id:number)=>ipcRenderer.invoke("builds:remove",id), duplicate:(id:number)=>ipcRenderer.invoke("builds:duplicate",id) },
  teams:{ list:()=>ipcRenderer.invoke("teams:list"), get:(id:number)=>ipcRenderer.invoke("teams:get",id), create:(input:UpsertTeamInput)=>ipcRenderer.invoke("teams:create",input), update:(id:number,input:UpsertTeamInput)=>ipcRenderer.invoke("teams:update",id,input), remove:(id:number)=>ipcRenderer.invoke("teams:remove",id), validate:(id:number)=>ipcRenderer.invoke("teams:validate",id) },
  imports:{ validate:(jsonText:string)=>ipcRenderer.invoke("imports:validate",jsonText), execute:(jsonText:string)=>ipcRenderer.invoke("imports:execute",jsonText) },
  data:{ backup:()=>ipcRenderer.invoke("data:backup"), exportJson:()=>ipcRenderer.invoke("data:export-json") },
};
contextBridge.exposeInMainWorld("gestorPoke",api);