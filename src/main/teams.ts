import type { TeamDetail, TeamMember, TeamSummary, UpsertTeamInput } from "../shared/contracts";
import { getOfficialArtworkUrl } from "./catalog";
import { getDatabase } from "./database";

function validateTeamInput(input: UpsertTeamInput): void {
  if (!input.name.trim()) throw new Error("Informe o nome da equipe.");
  if (input.buildIds.length > 6) throw new Error("Uma equipe pode ter no máximo seis integrantes.");
  if (new Set(input.buildIds).size !== input.buildIds.length) {
    throw new Error("A mesma build não pode ocupar duas posições.");
  }
}

export function listTeams(): TeamSummary[] {
  const rows = getDatabase().prepare(`
    SELECT t.id, t.name, t.battle_format, t.description, t.created_at,
           COUNT(tm.id) AS member_count
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id
    GROUP BY t.id
    ORDER BY t.battle_format, t.name COLLATE NOCASE
  `).all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    format: row.battle_format as TeamSummary["format"],
    description: row.description == null ? null : String(row.description),
    memberCount: Number(row.member_count),
    createdAt: String(row.created_at),
  }));
}

export function getTeam(id: number): TeamDetail {
  const team = getDatabase().prepare(`
    SELECT t.id, t.name, t.battle_format, t.description, t.created_at,
           COUNT(tm.id) AS member_count
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id
    WHERE t.id = ?
    GROUP BY t.id
  `).get(id) as Record<string, unknown> | undefined;

  if (!team) throw new Error("Equipe não encontrada.");

  const rows = getDatabase().prepare(`
    SELECT
      tm.position,
      b.id,
      b.owned_pokemon_id,
      s.name AS species_name,
      s.national_dex_number,
      COALESCE(op.nickname, s.name) AS pokemon_name,
      b.name AS build_name,
      b.battle_format,
      b.ability,
      b.stat_alignment,
      b.held_item
    FROM team_members tm
    JOIN builds b ON b.id = tm.build_id
    JOIN owned_pokemon op ON op.id = b.owned_pokemon_id
    JOIN species s ON s.id = op.species_id
    WHERE tm.team_id = ?
    ORDER BY tm.position
  `).all(id) as Array<Record<string, unknown>>;

  const members: TeamMember[] = rows.map((row) => ({
    position: Number(row.position),
    id: Number(row.id),
    ownedPokemonId: Number(row.owned_pokemon_id),
    speciesName: String(row.species_name),
    pokemonName: String(row.pokemon_name),
    imageUrl: getOfficialArtworkUrl(row.national_dex_number == null ? null : Number(row.national_dex_number)),
    buildName: String(row.build_name),
    format: row.battle_format as TeamMember["format"],
    ability: row.ability == null ? null : String(row.ability),
    statAlignment: row.stat_alignment == null ? null : String(row.stat_alignment),
    heldItem: row.held_item == null ? null : String(row.held_item),
  }));

  return {
    id: Number(team.id),
    name: String(team.name),
    format: team.battle_format as TeamDetail["format"],
    description: team.description == null ? null : String(team.description),
    memberCount: Number(team.member_count),
    createdAt: String(team.created_at),
    members,
  };
}

function replaceMembers(teamId: number, buildIds: number[]): void {
  const db = getDatabase();
  db.prepare("DELETE FROM team_members WHERE team_id = ?").run(teamId);
  const insert = db.prepare("INSERT INTO team_members (team_id, build_id, position) VALUES (?, ?, ?)");
  buildIds.forEach((buildId, index) => insert.run(teamId, buildId, index + 1));
}

export function createTeam(input: UpsertTeamInput): TeamDetail {
  validateTeamInput(input);
  const db = getDatabase();
  const id = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO teams (name, battle_format, description)
      VALUES (?, ?, ?)
    `).run(input.name.trim(), input.format, input.description?.trim() || null);
    const teamId = Number(result.lastInsertRowid);
    replaceMembers(teamId, input.buildIds);
    return teamId;
  })();
  return getTeam(id);
}

export function updateTeam(id: number, input: UpsertTeamInput): TeamDetail {
  validateTeamInput(input);
  const db = getDatabase();
  db.transaction(() => {
    const result = db.prepare(`
      UPDATE teams
      SET name = ?, battle_format = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(input.name.trim(), input.format, input.description?.trim() || null, id);
    if (result.changes === 0) throw new Error("Equipe não encontrada.");
    replaceMembers(id, input.buildIds);
  })();
  return getTeam(id);
}

export function removeTeam(id: number): void {
  const result = getDatabase().prepare("DELETE FROM teams WHERE id = ?").run(id);
  if (result.changes === 0) throw new Error("Equipe não encontrada.");
}
