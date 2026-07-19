import type { TeamDetail, TeamMember, TeamSummary, TeamValidationIssue, TeamValidationResult, UpsertTeamInput } from "../shared/contracts";
import { getOfficialArtworkUrl } from "./catalog";
import { isPokemonChampionsActiveSpecies, POKEMON_CHAMPIONS_REGULATION_KEY } from "./champions-regulation";
import { getDatabase } from "./database";

type TeamInputWithRegulation = UpsertTeamInput & { regulationKey?: "open" | typeof POKEMON_CHAMPIONS_REGULATION_KEY };
type TeamSummaryWithRegulation = TeamSummary & { regulationKey: "open" | typeof POKEMON_CHAMPIONS_REGULATION_KEY };
type TeamDetailWithRegulation = TeamDetail & { regulationKey: "open" | typeof POKEMON_CHAMPIONS_REGULATION_KEY };

function ensureTeamRegulationColumn(): void {
  const db = getDatabase();
  const columns = db.pragma("table_info(teams)") as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "regulation_key")) db.exec("ALTER TABLE teams ADD COLUMN regulation_key TEXT NOT NULL DEFAULT 'open'");
  db.exec("CREATE INDEX IF NOT EXISTS idx_teams_regulation ON teams(regulation_key)");
}

function validateTeamInput(input: TeamInputWithRegulation): void {
  if (!input.name.trim()) throw new Error("Informe o nome da equipe.");
  if (input.buildIds.length > 6) throw new Error("Uma equipe pode ter no máximo seis integrantes.");
  if (new Set(input.buildIds).size !== input.buildIds.length) throw new Error("A mesma build não pode ocupar duas posições.");
  if (input.regulationKey === POKEMON_CHAMPIONS_REGULATION_KEY && input.buildIds.length) {
    const placeholders = input.buildIds.map(() => "?").join(", ");
    const rows = getDatabase().prepare(`SELECT b.id AS build_id, s.name AS species_name FROM builds b JOIN owned_pokemon op ON op.id=b.owned_pokemon_id JOIN species s ON s.id=op.species_id WHERE b.id IN (${placeholders})`).all(...input.buildIds) as Array<{ build_id: number; species_name: string }>;
    if (rows.length !== input.buildIds.length) throw new Error("Uma ou mais builds selecionadas não existem.");
    const blocked = rows.filter((row) => !isPokemonChampionsActiveSpecies(row.species_name));
    if (blocked.length) throw new Error(`Estes Pokémon não estão na lista ativa do Pokémon Champions: ${blocked.map((row) => row.species_name).join(", ")}.`);
  }
}

export function listTeams(): TeamSummaryWithRegulation[] {
  ensureTeamRegulationColumn();
  const rows = getDatabase().prepare(`SELECT t.id,t.name,t.battle_format,t.description,t.regulation_key,t.created_at,COUNT(tm.id) AS member_count FROM teams t LEFT JOIN team_members tm ON tm.team_id=t.id GROUP BY t.id ORDER BY t.battle_format,t.name COLLATE NOCASE`).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({ id:Number(row.id), name:String(row.name), format:row.battle_format as TeamSummary["format"], description:row.description==null?null:String(row.description), regulationKey:row.regulation_key===POKEMON_CHAMPIONS_REGULATION_KEY?POKEMON_CHAMPIONS_REGULATION_KEY:"open", memberCount:Number(row.member_count), createdAt:String(row.created_at) }));
}

export function getTeam(id: number): TeamDetailWithRegulation {
  ensureTeamRegulationColumn();
  const team = getDatabase().prepare(`SELECT t.id,t.name,t.battle_format,t.description,t.regulation_key,t.created_at,COUNT(tm.id) AS member_count FROM teams t LEFT JOIN team_members tm ON tm.team_id=t.id WHERE t.id=? GROUP BY t.id`).get(id) as Record<string, unknown> | undefined;
  if (!team) throw new Error("Equipe não encontrada.");
  const rows = getDatabase().prepare(`SELECT tm.position,b.id,b.owned_pokemon_id,s.name AS species_name,s.national_dex_number,COALESCE(op.nickname,s.name) AS pokemon_name,b.name AS build_name,b.battle_format,b.ability,b.stat_alignment,b.held_item FROM team_members tm JOIN builds b ON b.id=tm.build_id JOIN owned_pokemon op ON op.id=b.owned_pokemon_id JOIN species s ON s.id=op.species_id WHERE tm.team_id=? ORDER BY tm.position`).all(id) as Array<Record<string, unknown>>;
  const members: TeamMember[] = rows.map((row) => ({ position:Number(row.position), id:Number(row.id), ownedPokemonId:Number(row.owned_pokemon_id), speciesName:String(row.species_name), pokemonName:String(row.pokemon_name), imageUrl:getOfficialArtworkUrl(row.national_dex_number==null?null:Number(row.national_dex_number)), buildName:String(row.build_name), format:row.battle_format as TeamMember["format"], ability:row.ability==null?null:String(row.ability), statAlignment:row.stat_alignment==null?null:String(row.stat_alignment), heldItem:row.held_item==null?null:String(row.held_item) }));
  return { id:Number(team.id), name:String(team.name), format:team.battle_format as TeamDetail["format"], description:team.description==null?null:String(team.description), regulationKey:team.regulation_key===POKEMON_CHAMPIONS_REGULATION_KEY?POKEMON_CHAMPIONS_REGULATION_KEY:"open", memberCount:Number(team.member_count), createdAt:String(team.created_at), members };
}

export function validateTeam(id: number): TeamValidationResult {
  const team = getTeam(id);
  const issues: TeamValidationIssue[] = [];
  if (team.members.length === 0) issues.push({ code:"empty", severity:"error", message:"A equipe não possui integrantes." });
  else if (team.members.length < 6) issues.push({ code:"incomplete", severity:"warning", message:`A equipe possui ${team.members.length}/6 integrantes.` });
  else issues.push({ code:"size-ok", severity:"success", message:"A equipe possui seis integrantes." });

  const species = new Map<string, number>();
  const items = new Map<string, number>();
  for (const member of team.members) {
    const speciesKey = member.speciesName.toLowerCase();
    species.set(speciesKey, (species.get(speciesKey) ?? 0) + 1);
    if (member.heldItem) items.set(member.heldItem.toLowerCase(), (items.get(member.heldItem.toLowerCase()) ?? 0) + 1);
    if (member.format !== "both" && member.format !== team.format) issues.push({ code:`format-${member.id}`, severity:"error", message:`${member.pokemonName}: build incompatível com ${team.format === "double" ? "Dupla" : "Individual"}.` });
    if (!member.ability) issues.push({ code:`ability-${member.id}`, severity:"warning", message:`${member.pokemonName}: habilidade não definida.` });
    if (!member.heldItem) issues.push({ code:`item-${member.id}`, severity:"warning", message:`${member.pokemonName}: item não definido.` });
    const moveCount = Number((getDatabase().prepare("SELECT COUNT(*) AS total FROM build_moves WHERE build_id=?").get(member.id) as { total:number }).total);
    if (moveCount < 4) issues.push({ code:`moves-${member.id}`, severity:"warning", message:`${member.pokemonName}: apenas ${moveCount}/4 golpes definidos.` });
    if (team.regulationKey === POKEMON_CHAMPIONS_REGULATION_KEY && !isPokemonChampionsActiveSpecies(member.speciesName)) issues.push({ code:`champions-${member.id}`, severity:"error", message:`${member.pokemonName}: espécie fora da lista ativa do Pokémon Champions.` });
  }
  for (const [name, count] of species) if (count > 1) issues.push({ code:`species-${name}`, severity:"error", message:`Espécie repetida na equipe: ${name} (${count} vezes).` });
  for (const [name, count] of items) if (count > 1) issues.push({ code:`item-repeat-${name}`, severity:"warning", message:`Item repetido: ${name} (${count} vezes).` });
  if (!issues.some((issue) => issue.severity === "error")) issues.push({ code:"valid", severity:"success", message:"Nenhum erro crítico encontrado." });
  return { teamId:id, valid:!issues.some((issue) => issue.severity === "error"), issues };
}

function replaceMembers(teamId:number, buildIds:number[]):void { const db=getDatabase(); db.prepare("DELETE FROM team_members WHERE team_id=?").run(teamId); const insert=db.prepare("INSERT INTO team_members (team_id,build_id,position) VALUES (?,?,?)"); buildIds.forEach((buildId,index)=>insert.run(teamId,buildId,index+1)); }
export function createTeam(input:TeamInputWithRegulation):TeamDetailWithRegulation { ensureTeamRegulationColumn(); validateTeamInput(input); const db=getDatabase(); const regulationKey=input.regulationKey===POKEMON_CHAMPIONS_REGULATION_KEY?POKEMON_CHAMPIONS_REGULATION_KEY:"open"; const id=db.transaction(()=>{ const result=db.prepare("INSERT INTO teams (name,battle_format,description,regulation_key) VALUES (?,?,?,?)").run(input.name.trim(),input.format,input.description?.trim()||null,regulationKey); const teamId=Number(result.lastInsertRowid); replaceMembers(teamId,input.buildIds); return teamId; })(); return getTeam(id); }
export function updateTeam(id:number,input:TeamInputWithRegulation):TeamDetailWithRegulation { ensureTeamRegulationColumn(); validateTeamInput(input); const db=getDatabase(); const regulationKey=input.regulationKey===POKEMON_CHAMPIONS_REGULATION_KEY?POKEMON_CHAMPIONS_REGULATION_KEY:"open"; db.transaction(()=>{ const result=db.prepare("UPDATE teams SET name=?,battle_format=?,description=?,regulation_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(input.name.trim(),input.format,input.description?.trim()||null,regulationKey,id); if(result.changes===0) throw new Error("Equipe não encontrada."); replaceMembers(id,input.buildIds); })(); return getTeam(id); }
export function removeTeam(id:number):void { ensureTeamRegulationColumn(); const result=getDatabase().prepare("DELETE FROM teams WHERE id=?").run(id); if(result.changes===0) throw new Error("Equipe não encontrada."); }
