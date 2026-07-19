import type { BattleRecord, BattleStats, CreateBattleInput } from "../shared/contracts";
import { getDatabase } from "./database";
import { getTeam } from "./teams";

function ensureBattleTables(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS battles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      opponent TEXT,
      result TEXT NOT NULL CHECK (result IN ('win','loss','draw')),
      selected_build_ids_json TEXT NOT NULL DEFAULT '[]',
      lead_build_ids_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_battles_team ON battles(team_id);
    CREATE INDEX IF NOT EXISTS idx_battles_played_at ON battles(played_at DESC);
  `);
}

function parseIds(value: unknown): number[] {
  try {
    const parsed: unknown = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is number => Number.isInteger(item) && item > 0) : [];
  } catch {
    return [];
  }
}

function mapBattle(row: Record<string, unknown>): BattleRecord {
  return {
    id: Number(row.id),
    teamId: Number(row.team_id),
    teamName: String(row.team_name),
    format: row.battle_format as BattleRecord["format"],
    opponent: row.opponent == null ? null : String(row.opponent),
    result: row.result as BattleRecord["result"],
    selectedBuildIds: parseIds(row.selected_build_ids_json),
    leadBuildIds: parseIds(row.lead_build_ids_json),
    notes: row.notes == null ? null : String(row.notes),
    playedAt: String(row.played_at),
  };
}

export function listBattles(): BattleRecord[] {
  ensureBattleTables();
  return (getDatabase().prepare(`
    SELECT b.*, t.name AS team_name, t.battle_format
    FROM battles b
    JOIN teams t ON t.id = b.team_id
    ORDER BY b.played_at DESC, b.id DESC
  `).all() as Array<Record<string, unknown>>).map(mapBattle);
}

export function createBattle(input: CreateBattleInput): BattleRecord {
  ensureBattleTables();
  const team = getTeam(input.teamId);
  const allowedIds = new Set(team.members.map((member) => member.id));
  if (!input.selectedBuildIds.length) throw new Error("Escolha os participantes da batalha.");
  if (input.selectedBuildIds.some((id) => !allowedIds.has(id))) throw new Error("Todos os participantes devem pertencer à equipe selecionada.");
  if (input.leadBuildIds.some((id) => !input.selectedBuildIds.includes(id))) throw new Error("A inicial deve estar entre os participantes escolhidos.");
  const expectedSelected = team.format === "double" ? 4 : 3;
  const expectedLeads = team.format === "double" ? 2 : 1;
  if (input.selectedBuildIds.length !== expectedSelected) throw new Error(`Selecione exatamente ${expectedSelected} participantes para este formato.`);
  if (input.leadBuildIds.length !== expectedLeads) throw new Error(`Selecione exatamente ${expectedLeads} integrante(s) inicial(is).`);
  if (new Set(input.selectedBuildIds).size !== input.selectedBuildIds.length || new Set(input.leadBuildIds).size !== input.leadBuildIds.length) throw new Error("Não repita integrantes na preparação da batalha.");

  const result = getDatabase().prepare(`
    INSERT INTO battles (team_id, opponent, result, selected_build_ids_json, lead_build_ids_json, notes, played_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.teamId,
    input.opponent?.trim() || null,
    input.result,
    JSON.stringify(input.selectedBuildIds),
    JSON.stringify(input.leadBuildIds),
    input.notes?.trim() || null,
    input.playedAt || new Date().toISOString(),
  );
  const id = Number(result.lastInsertRowid);
  const row = getDatabase().prepare(`
    SELECT b.*, t.name AS team_name, t.battle_format
    FROM battles b JOIN teams t ON t.id = b.team_id WHERE b.id = ?
  `).get(id) as Record<string, unknown>;
  return mapBattle(row);
}

export function removeBattle(id: number): void {
  ensureBattleTables();
  const result = getDatabase().prepare("DELETE FROM battles WHERE id = ?").run(id);
  if (result.changes === 0) throw new Error("Batalha não encontrada.");
}

export function getBattleStats(): BattleStats {
  ensureBattleTables();
  const totals = getDatabase().prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) AS wins,
           SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) AS losses,
           SUM(CASE WHEN result='draw' THEN 1 ELSE 0 END) AS draws
    FROM battles
  `).get() as Record<string, unknown>;
  const mostUsed = getDatabase().prepare(`
    SELECT t.name, COUNT(*) AS total
    FROM battles b JOIN teams t ON t.id=b.team_id
    GROUP BY b.team_id ORDER BY total DESC, t.name COLLATE NOCASE LIMIT 1
  `).get() as { name: string } | undefined;
  const total = Number(totals.total ?? 0);
  const wins = Number(totals.wins ?? 0);
  return {
    total,
    wins,
    losses: Number(totals.losses ?? 0),
    draws: Number(totals.draws ?? 0),
    winRate: total ? Number(((wins / total) * 100).toFixed(1)) : 0,
    mostUsedTeam: mostUsed?.name ?? null,
  };
}