import { contextBridge, ipcRenderer } from "electron";
import type { AppApi, CreateBattleInput, CreatePokemonInput, ImportResolution, UpdatePokemonInput, UpsertBuildInput, UpsertTeamInput } from "../shared/contracts";

const api: AppApi = {
  dashboard:{ getSummary:()=>ipcRenderer.invoke("dashboard:get-summary") },
  pokemon:{ list:()=>ipcRenderer.invoke("pokemon:list"), get:(id:number)=>ipcRenderer.invoke("pokemon:get",id), create:(input:CreatePokemonInput)=>ipcRenderer.invoke("pokemon:create",input), update:(id:number,input:UpdatePokemonInput)=>ipcRenderer.invoke("pokemon:update",id,input), remove:(id:number)=>ipcRenderer.invoke("pokemon:remove",id) },
  pokedex:{ list:()=>ipcRenderer.invoke("pokedex:list"), status:()=>ipcRenderer.invoke("pokedex:status"), synchronize:()=>ipcRenderer.invoke("pokedex:synchronize") },
  moves:{ list:()=>ipcRenderer.invoke("moves:list"), synchronize:()=>ipcRenderer.invoke("moves:synchronize") },
  abilities:{ list:()=>ipcRenderer.invoke("abilities:list"), synchronize:()=>ipcRenderer.invoke("abilities:synchronize") },
  items:{ list:()=>ipcRenderer.invoke("items:list"), synchronize:()=>ipcRenderer.invoke("items:synchronize") },
  compatibility:{ get:(ownedPokemonId:number)=>ipcRenderer.invoke("compatibility:get",ownedPokemonId), synchronize:(ownedPokemonId:number)=>ipcRenderer.invoke("compatibility:synchronize",ownedPokemonId) },
  images:{ cache:(url:string)=>ipcRenderer.invoke("images:cache",url) },
  builds:{ list:()=>ipcRenderer.invoke("builds:list"), get:(id:number)=>ipcRenderer.invoke("builds:get",id), create:(input:UpsertBuildInput)=>ipcRenderer.invoke("builds:create",input), update:(id:number,input:UpsertBuildInput)=>ipcRenderer.invoke("builds:update",id,input), remove:(id:number)=>ipcRenderer.invoke("builds:remove",id), duplicate:(id:number)=>ipcRenderer.invoke("builds:duplicate",id), setPrimary:(id:number)=>ipcRenderer.invoke("builds:set-primary",id), compare:(leftId:number,rightId:number)=>ipcRenderer.invoke("builds:compare",leftId,rightId) },
  teams:{ list:()=>ipcRenderer.invoke("teams:list"), get:(id:number)=>ipcRenderer.invoke("teams:get",id), create:(input:UpsertTeamInput)=>ipcRenderer.invoke("teams:create",input), update:(id:number,input:UpsertTeamInput)=>ipcRenderer.invoke("teams:update",id,input), remove:(id:number)=>ipcRenderer.invoke("teams:remove",id), validate:(id:number)=>ipcRenderer.invoke("teams:validate",id), analyze:(id:number)=>ipcRenderer.invoke("teams:analyze",id) },
  battles:{ list:()=>ipcRenderer.invoke("battles:list"), create:(input:CreateBattleInput)=>ipcRenderer.invoke("battles:create",input), remove:(id:number)=>ipcRenderer.invoke("battles:remove",id), stats:()=>ipcRenderer.invoke("battles:stats") },
  imports:{ validate:(jsonText:string)=>ipcRenderer.invoke("imports:validate",jsonText), preview:(jsonText:string)=>ipcRenderer.invoke("imports:preview",jsonText), execute:(jsonText:string)=>ipcRenderer.invoke("imports:execute",jsonText), executeResolved:(jsonText:string,resolutions:ImportResolution[])=>ipcRenderer.invoke("imports:execute-resolved",jsonText,resolutions) },
  data:{ backup:()=>ipcRenderer.invoke("data:backup"), restore:()=>ipcRenderer.invoke("data:restore"), exportJson:()=>ipcRenderer.invoke("data:export-json") },
};
contextBridge.exposeInMainWorld("gestorPoke",api);
