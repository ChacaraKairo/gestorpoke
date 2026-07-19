import { useEffect, useMemo, useState } from "react";
import type {
  BattleRecord,
  BattleStats,
  BuildComparison,
  BuildSummary,
  ImportPreview,
  JsonImportResult,
  TeamAnalysis,
  TeamDetail,
  TeamSummary,
  TeamValidationResult,
} from "../../shared/contracts";
import "./competitive-workspace.css";

function titleize(value: string): string {
  return value.split("-").map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join(" ");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

export function CompetitiveWorkspaceOverlay() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"builds" | "teams" | "battles" | "data">("builds");
  const [builds, setBuilds] = useState<BuildSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [battles, setBattles] = useState<BattleRecord[]>([]);
  const [stats, setStats] = useState<BattleStats | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    const [buildRows, teamRows, battleRows, battleStats] = await Promise.all([
      window.gestorPoke.builds.list(),
      window.gestorPoke.teams.list(),
      window.gestorPoke.battles.list(),
      window.gestorPoke.battles.stats(),
    ]);
    setBuilds(buildRows);
    setTeams(teamRows);
    setBattles(battleRows);
    setStats(battleStats);
  }

  useEffect(() => { if (open) void Promise.resolve().then(refresh); }, [open]);

  return <>
    <button className="competitive-trigger" type="button" onClick={() => setOpen(true)}>★ Central competitiva</button>
    {open ? <div className="competitive-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="competitive-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="competitive-header">
          <div><span className="eyebrow">GestorPoke</span><h1>Central competitiva</h1><p>Builds, equipes, análise, preparação e histórico em um só fluxo.</p></div>
          <button className="danger-button" type="button" onClick={() => setOpen(false)}>Fechar</button>
        </header>
        <nav className="competitive-tabs">
          <button className={tab === "builds" ? "active" : ""} onClick={() => setTab("builds")}>Builds</button>
          <button className={tab === "teams" ? "active" : ""} onClick={() => setTab("teams")}>Equipes</button>
          <button className={tab === "battles" ? "active" : ""} onClick={() => setTab("battles")}>Batalhas</button>
          <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>Dados</button>
        </nav>
        {message ? <div className="competitive-message">{message}</div> : null}
        <div className="competitive-body">
          {tab === "builds" ? <BuildWorkspace builds={builds} onChanged={refresh} setMessage={setMessage} /> : null}
          {tab === "teams" ? <TeamWorkspace teams={teams} onChanged={refresh} setMessage={setMessage} /> : null}
          {tab === "battles" ? <BattleWorkspace teams={teams} battles={battles} stats={stats} onChanged={refresh} setMessage={setMessage} /> : null}
          {tab === "data" ? <DataWorkspace busy={busy} setBusy={setBusy} setMessage={setMessage} /> : null}
        </div>
      </section>
    </div> : null}
  </>;
}

function BuildWorkspace({ builds, onChanged, setMessage }: { builds: BuildSummary[]; onChanged: () => Promise<void>; setMessage: (value: string | null) => void }) {
  const [leftId, setLeftId] = useState<number | null>(null);
  const [rightId, setRightId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<BuildComparison | null>(null);
  const grouped = useMemo(() => {
    const map = new Map<number, BuildSummary[]>();
    for (const build of builds) map.set(build.ownedPokemonId, [...(map.get(build.ownedPokemonId) ?? []), build]);
    return Array.from(map.values());
  }, [builds]);

  async function primary(id: number) {
    try { await window.gestorPoke.builds.setPrimary(id); setMessage("Build principal atualizada."); await onChanged(); }
    catch (error) { setMessage(errorMessage(error)); }
  }
  async function duplicate(id: number) {
    try { await window.gestorPoke.builds.duplicate(id); setMessage("Build duplicada."); await onChanged(); }
    catch (error) { setMessage(errorMessage(error)); }
  }
  async function compare() {
    if (!leftId || !rightId || leftId === rightId) return;
    try { setComparison(await window.gestorPoke.builds.compare(leftId, rightId)); }
    catch (error) { setMessage(errorMessage(error)); }
  }

  return <div className="workspace-stack">
    <section className="workspace-panel"><h2>Build principal e duplicação</h2>
      <div className="build-management-grid">{grouped.map((group) => <article key={group[0]?.ownedPokemonId}><h3>{group[0]?.pokemonName}</h3>{group.map((build) => <div className="managed-build" key={build.id}><span><strong>{build.buildName}</strong><small>{titleize(build.format)} · {build.ability || "Sem habilidade"} · {build.heldItem || "Sem item"}</small></span><div>{build.isPrimary ? <em>Principal</em> : <button onClick={() => void primary(build.id)}>Tornar principal</button>}<button onClick={() => void duplicate(build.id)}>Duplicar</button></div></div>)}</article>)}</div>
    </section>
    <section className="workspace-panel"><h2>Comparar builds</h2><div className="compare-controls"><select value={leftId ?? ""} onChange={(event) => setLeftId(Number(event.target.value) || null)}><option value="">Build A</option>{builds.map((build) => <option key={build.id} value={build.id}>{build.pokemonName} — {build.buildName}</option>)}</select><select value={rightId ?? ""} onChange={(event) => setRightId(Number(event.target.value) || null)}><option value="">Build B</option>{builds.map((build) => <option key={build.id} value={build.id}>{build.pokemonName} — {build.buildName}</option>)}</select><button className="primary-button" onClick={() => void compare()}>Comparar</button></div>
      {comparison ? <div className="comparison-table"><header><strong>Campo</strong><strong>{comparison.left.buildName}</strong><strong>{comparison.right.buildName}</strong></header>{comparison.differences.length ? comparison.differences.map((difference) => <div key={difference.field}><span>{difference.field}</span><span>{difference.left}</span><span>{difference.right}</span></div>) : <p>As builds não possuem diferenças registradas.</p>}</div> : null}
    </section>
  </div>;
}

function TeamWorkspace({ teams, onChanged, setMessage }: { teams: TeamSummary[]; onChanged: () => Promise<void>; setMessage: (value: string | null) => void }) {
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [validation, setValidation] = useState<TeamValidationResult | null>(null);
  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);

  async function select(id: number) {
    if (!id) { setTeam(null); return; }
    try {
      const [detail, result, teamAnalysis] = await Promise.all([window.gestorPoke.teams.get(id), window.gestorPoke.teams.validate(id), window.gestorPoke.teams.analyze(id)]);
      setTeam(detail); setValidation(result); setAnalysis(teamAnalysis);
    } catch (error) { setMessage(errorMessage(error)); }
  }
  async function move(index: number, direction: -1 | 1) {
    if (!team) return;
    const target = index + direction;
    if (target < 0 || target >= team.members.length) return;
    const members = [...team.members];
    [members[index], members[target]] = [members[target]!, members[index]!];
    try {
      const updated = await window.gestorPoke.teams.update(team.id, { name: team.name, format: team.format, regulationKey: team.regulationKey, description: team.description, buildIds: members.map((member) => member.id) });
      setTeam(updated); setMessage("Ordem da equipe atualizada."); await onChanged(); await select(team.id);
    } catch (error) { setMessage(errorMessage(error)); }
  }

  return <div className="workspace-stack"><section className="workspace-panel"><h2>Equipe e ordem dos slots</h2><select value={team?.id ?? ""} onChange={(event) => void select(Number(event.target.value))}><option value="">Selecione uma equipe</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.format === "double" ? "Dupla" : "Individual"}</option>)}</select>
    {team ? <div className="reorder-list">{team.members.map((member, index) => <article key={member.id}><strong>{index + 1}. {member.pokemonName}</strong><span>{member.buildName}{member.isPrimary ? " · Principal" : ""}</span><div><button disabled={index === 0} onClick={() => void move(index, -1)}>↑</button><button disabled={index === team.members.length - 1} onClick={() => void move(index, 1)}>↓</button></div></article>)}</div> : null}
  </section>
  {validation ? <section className="workspace-panel"><h2>Validação em tempo real</h2><div className="validation-list">{validation.issues.map((issue) => <p className={issue.severity} key={issue.code}>{issue.severity === "success" ? "✓" : issue.severity === "warning" ? "⚠" : "✕"} {issue.message}</p>)}</div></section> : null}
  {analysis ? <section className="workspace-panel"><h2>Cobertura ofensiva</h2><div className="analysis-counters"><span>Físicos <strong>{analysis.physicalMoves}</strong></span><span>Especiais <strong>{analysis.specialMoves}</strong></span><span>Status <strong>{analysis.statusMoves}</strong></span><span>Prioridade <strong>{analysis.priorityMoves}</strong></span></div><div className="coverage-grid">{analysis.coverage.map((row) => <article className={row.uncovered ? "uncovered" : "covered"} key={row.defendingType}><strong>{row.defendingType}</strong><span>{row.uncovered ? "Sem resposta super efetiva" : `${row.superEffectiveMoveCount} resposta(s)`}</span><small>{row.moveNames.join(", ") || "—"}</small></article>)}</div>{analysis.doubleBattleInsights.length ? <div className="double-insights"><h3>Análise de dupla</h3>{analysis.doubleBattleInsights.map((insight) => <p className={insight.severity} key={insight.code}>{insight.message}</p>)}</div> : null}</section> : null}</div>;
}

function BattleWorkspace({ teams, battles, stats, onChanged, setMessage }: { teams: TeamSummary[]; battles: BattleRecord[]; stats: BattleStats | null; onChanged: () => Promise<void>; setMessage: (value: string | null) => void }) {
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [leads, setLeads] = useState<number[]>([]);
  const [opponent, setOpponent] = useState("");
  const [result, setResult] = useState<"win" | "loss" | "draw">("win");
  const [notes, setNotes] = useState("");

  async function selectTeam(id: number) { setTeam(id ? await window.gestorPoke.teams.get(id) : null); setSelected([]); setLeads([]); }
  function toggle(id: number, list: number[], setter: (value: number[]) => void, max: number) { setter(list.includes(id) ? list.filter((item) => item !== id) : list.length < max ? [...list, id] : list); }
  async function save() {
    if (!team) return;
    try { await window.gestorPoke.battles.create({ teamId: team.id, opponent: opponent || null, result, selectedBuildIds: selected, leadBuildIds: leads, notes: notes || null }); setMessage("Batalha registrada no histórico."); setSelected([]); setLeads([]); setOpponent(""); setNotes(""); await onChanged(); }
    catch (error) { setMessage(errorMessage(error)); }
  }
  async function remove(id: number) { if (!window.confirm("Excluir este registro de batalha?")) return; await window.gestorPoke.battles.remove(id); await onChanged(); }

  const selectedMax = team?.format === "double" ? 4 : 3;
  const leadMax = team?.format === "double" ? 2 : 1;
  return <div className="workspace-stack">{stats ? <div className="battle-stats"><span>Total <strong>{stats.total}</strong></span><span>Vitórias <strong>{stats.wins}</strong></span><span>Derrotas <strong>{stats.losses}</strong></span><span>Taxa de vitória <strong>{stats.winRate}%</strong></span><span>Equipe mais usada <strong>{stats.mostUsedTeam || "—"}</strong></span></div> : null}
    <section className="workspace-panel"><h2>Preparar e registrar batalha</h2><select value={team?.id ?? ""} onChange={(event) => void selectTeam(Number(event.target.value))}><option value="">Escolha uma equipe</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{team ? <><p>Escolha {selectedMax} participantes e {leadMax} inicial(is).</p><div className="battle-member-grid">{team.members.map((member) => <article key={member.id}><strong>{member.pokemonName}</strong><small>{member.buildName}</small><label><input type="checkbox" checked={selected.includes(member.id)} onChange={() => toggle(member.id, selected, setSelected, selectedMax)} /> Participante</label><label><input type="checkbox" disabled={!selected.includes(member.id)} checked={leads.includes(member.id)} onChange={() => toggle(member.id, leads, setLeads, leadMax)} /> Inicial</label></article>)}</div><div className="battle-form"><input value={opponent} onChange={(event) => setOpponent(event.target.value)} placeholder="Adversário" /><select value={result} onChange={(event) => setResult(event.target.value as typeof result)}><option value="win">Vitória</option><option value="loss">Derrota</option><option value="draw">Empate</option></select><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Plano, decisões e ajustes para a próxima batalha" /><button className="primary-button" onClick={() => void save()}>Registrar batalha</button></div></> : null}</section>
    <section className="workspace-panel"><h2>Histórico</h2><div className="battle-history">{battles.map((battle) => <article key={battle.id}><div><strong>{battle.teamName}</strong><span className={battle.result}>{battle.result === "win" ? "Vitória" : battle.result === "loss" ? "Derrota" : "Empate"}</span></div><small>{new Date(battle.playedAt).toLocaleString("pt-BR")} · {battle.opponent || "Adversário não informado"}</small><p>{battle.notes || "Sem observações."}</p><button className="danger-button" onClick={() => void remove(battle.id)}>Excluir</button></article>)}</div></section>
  </div>;
}

function DataWorkspace({ busy, setBusy, setMessage }: { busy: boolean; setBusy: (value: boolean) => void; setMessage: (value: string | null) => void }) {
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  async function operation(action: () => Promise<{ canceled: boolean; filePath: string | null }>, success: string) { setBusy(true); try { const result = await action(); setMessage(result.canceled ? "Operação cancelada." : `${success}: ${result.filePath}`); } catch (error) { setMessage(errorMessage(error)); } finally { setBusy(false); } }
  async function importJsonOperation(action: () => Promise<JsonImportResult>, success: string) { setBusy(true); try { const result = await action(); if (result.canceled) { setMessage("Operação cancelada."); return; } const summary = [result.importedBuilds ? `${result.importedBuilds} build(s) criada(s)` : null, result.updatedBuilds ? `${result.updatedBuilds} build(s) atualizada(s)` : null, result.importedTeams ? `${result.importedTeams} equipe(s) criada(s)` : null, result.updatedTeams ? `${result.updatedTeams} equipe(s) atualizada(s)` : null].filter(Boolean).join(", ") || "nenhum registro alterado"; setMessage(`${success}: ${summary}.`); } catch (error) { setMessage(errorMessage(error)); } finally { setBusy(false); } }
  async function review() { try { setPreview(await window.gestorPoke.imports.preview(json)); } catch (error) { setMessage(errorMessage(error)); } }
  async function importData() { try { const result = await window.gestorPoke.imports.execute(json); setMessage(`${result.importedPokemon} Pokémon e ${result.importedBuilds} builds importados.`); setPreview(null); setJson(""); } catch (error) { setMessage(errorMessage(error)); } }
  return <div className="workspace-stack"><section className="workspace-panel"><h2>Backup e restauração</h2><div className="data-actions"><button disabled={busy} onClick={() => void operation(window.gestorPoke.data.backup, "Backup criado")}>Criar backup</button><button disabled={busy} onClick={() => void operation(window.gestorPoke.data.restore, "Backup restaurado")}>Restaurar backup</button><button disabled={busy} onClick={() => void operation(window.gestorPoke.data.exportJson, "JSON exportado")}>Exportar JSON completo</button><button disabled={busy} onClick={() => void operation(window.gestorPoke.data.exportBuilds, "Builds exportadas")}>Exportar builds</button><button disabled={busy} onClick={() => void importJsonOperation(window.gestorPoke.data.importBuilds, "Builds importadas")}>Importar builds</button><button disabled={busy} onClick={() => void operation(window.gestorPoke.data.exportTeams, "Equipes exportadas")}>Exportar equipes</button><button disabled={busy} onClick={() => void importJsonOperation(window.gestorPoke.data.importTeams, "Equipes importadas")}>Importar equipes</button></div><p className="warning-text">A restauração cria uma cópia de segurança automática do banco atual antes de substituir os dados.</p></section>
  <section className="workspace-panel"><h2>Importação com revisão</h2><input type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setJson); }} /><textarea rows={10} value={json} onChange={(event) => { setJson(event.target.value); setPreview(null); }} placeholder="Cole ou carregue o JSON" /><button onClick={() => void review()} disabled={!json.trim()}>Revisar</button>{preview ? <div className="import-preview"><strong>{preview.valid ? `${preview.count} registro(s) válido(s)` : "Arquivo inválido"}</strong>{preview.errors.map((error) => <p className="error" key={error}>{error}</p>)}{preview.duplicates.map((duplicate) => <p className="warning" key={duplicate.index}>Possível duplicidade: {duplicate.speciesName}{duplicate.nickname ? ` (${duplicate.nickname})` : ""} — IDs existentes: {duplicate.existingPokemonIds.join(", ")}</p>)}<button className="primary-button" disabled={!preview.valid} onClick={() => void importData()}>Confirmar importação</button></div> : null}</section></div>;
}
