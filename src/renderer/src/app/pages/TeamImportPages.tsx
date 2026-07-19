import { type FormEvent, useMemo, useState } from "react";
import type { BuildSummary, TeamSummary, UpsertTeamInput } from "../../../../shared/contracts";
import { isPokemonChampionsActiveSpecies, POKEMON_CHAMPIONS_REGULATION_KEY } from "../../../../shared/champions-roster";
import { errorMessage, PokemonImage } from "../ui";

function validateDraft(form: UpsertTeamInput, builds: BuildSummary[]): Array<{ severity: "error" | "warning" | "success"; message: string }> {
  const selected = form.buildIds.map((id) => builds.find((build) => build.id === id)).filter((build): build is BuildSummary => Boolean(build));
  const issues: Array<{ severity: "error" | "warning" | "success"; message: string }> = [];
  if (!selected.length) issues.push({ severity: "error", message: "Selecione pelo menos um integrante." });
  else if (selected.length < 6) issues.push({ severity: "warning", message: `${selected.length}/6 integrantes selecionados.` });
  else issues.push({ severity: "success", message: "Seis integrantes selecionados." });

  const species = new Map<string, number>();
  const items = new Map<string, number>();
  selected.forEach((build) => {
    const speciesKey = build.speciesName.toLowerCase();
    species.set(speciesKey, (species.get(speciesKey) ?? 0) + 1);
    if (build.heldItem) items.set(build.heldItem.toLowerCase(), (items.get(build.heldItem.toLowerCase()) ?? 0) + 1);
    if (build.format !== "both" && build.format !== form.format) issues.push({ severity: "error", message: `${build.pokemonName}: build incompatível com o formato.` });
    if (form.regulationKey === POKEMON_CHAMPIONS_REGULATION_KEY && !isPokemonChampionsActiveSpecies(build.speciesName)) issues.push({ severity: "error", message: `${build.pokemonName}: fora da lista ativa do Champions.` });
    if (!build.ability) issues.push({ severity: "warning", message: `${build.pokemonName}: habilidade não definida.` });
    if (!build.heldItem) issues.push({ severity: "warning", message: `${build.pokemonName}: item não definido.` });
  });
  species.forEach((count, name) => { if (count > 1) issues.push({ severity: "error", message: `Espécie repetida: ${name}.` }); });
  items.forEach((count, name) => { if (count > 1) issues.push({ severity: "warning", message: `Item repetido: ${name}.` }); });
  if (!issues.some((issue) => issue.severity === "error")) issues.push({ severity: "success", message: "Nenhum erro crítico na seleção atual." });
  return issues;
}

export function TeamsPage({ teams, builds, onRefresh }: { teams: TeamSummary[]; builds: BuildSummary[]; onRefresh: () => Promise<void> }) {
  const [formatTab, setFormatTab] = useState<"single" | "double">("single");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [form, setForm] = useState<UpsertTeamInput>({ name: "Nova equipe", format: "single", regulationKey: "open", description: null, buildIds: [] });
  const [message, setMessage] = useState<string | null>(null);
  const visibleTeams = teams.filter((team) => team.format === formatTab);
  const compatibleBuilds = builds.filter((build) => build.format === "both" || build.format === form.format).filter((build) => form.regulationKey !== POKEMON_CHAMPIONS_REGULATION_KEY || isPokemonChampionsActiveSpecies(build.speciesName));
  const draftIssues = useMemo(() => validateDraft(form, builds), [form, builds]);

  async function edit(id: number) {
    const detail = await window.gestorPoke.teams.get(id);
    setSelectedTeamId(id);
    setFormatTab(detail.format);
    setForm({ name: detail.name, format: detail.format, regulationKey: detail.regulationKey, description: detail.description, buildIds: detail.members.map((member) => member.id) });
  }

  function toggleBuild(id: number) {
    setForm((current) => current.buildIds.includes(id)
      ? { ...current, buildIds: current.buildIds.filter((item) => item !== id) }
      : current.buildIds.length < 6 ? { ...current, buildIds: [...current.buildIds, id] } : current);
  }

  function moveBuild(index: number, direction: -1 | 1) {
    setForm((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.buildIds.length) return current;
      const next = [...current.buildIds];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return { ...current, buildIds: next };
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      if (draftIssues.some((issue) => issue.severity === "error")) throw new Error("Corrija os erros críticos antes de salvar a equipe.");
      if (selectedTeamId) await window.gestorPoke.teams.update(selectedTeamId, form);
      else await window.gestorPoke.teams.create(form);
      setMessage("Equipe salva com sucesso.");
      setSelectedTeamId(null);
      setForm({ name: "Nova equipe", format: formatTab, regulationKey: "open", description: null, buildIds: [] });
      await onRefresh();
    } catch (caught) { setMessage(errorMessage(caught)); }
  }

  async function remove() {
    if (!selectedTeamId || !window.confirm("Excluir esta equipe?")) return;
    await window.gestorPoke.teams.remove(selectedTeamId);
    setSelectedTeamId(null);
    setForm({ name: "Nova equipe", format: formatTab, regulationKey: "open", description: null, buildIds: [] });
    await onRefresh();
  }

  return <section className="page-stack">
    <header className="page-header"><div><span className="eyebrow">Sala de estratégia</span><h1>Equipes</h1><p>Monte, reordene e valide a equipe antes de salvar.</p></div><button className="primary-button" onClick={() => { setSelectedTeamId(null); setForm({ name: "Nova equipe", format: formatTab, regulationKey: "open", description: null, buildIds: [] }); }}>Nova equipe</button></header>
    <div className="format-tabs"><button className={formatTab === "single" ? "active" : ""} onClick={() => { setFormatTab("single"); setForm((current) => ({ ...current, format: "single" })); }}>Batalha Individual</button><button className={formatTab === "double" ? "active" : ""} onClick={() => { setFormatTab("double"); setForm((current) => ({ ...current, format: "double" })); }}>Batalha Dupla</button></div>
    <div className="team-layout-v2">
      <aside className="team-list-v2">{visibleTeams.length ? visibleTeams.map((team) => <button className={selectedTeamId === team.id ? "active" : ""} key={team.id} onClick={() => void edit(team.id)}><strong>{team.name}</strong><small>{team.memberCount}/6 integrantes</small><em>{team.regulationKey === POKEMON_CHAMPIONS_REGULATION_KEY ? "Champions" : "Aberta"}</em></button>) : <div className="empty-state">Nenhuma equipe neste formato.</div>}</aside>
      <form className="glass-panel team-editor-v2" onSubmit={save}>
        <div className="form-grid"><label>Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Formato<select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value as UpsertTeamInput["format"] })}><option value="single">Individual</option><option value="double">Dupla</option></select></label><label>Regulamentação<select value={form.regulationKey ?? "open"} onChange={(event) => setForm((current) => ({ ...current, regulationKey: event.target.value as UpsertTeamInput["regulationKey"], buildIds: event.target.value === POKEMON_CHAMPIONS_REGULATION_KEY ? current.buildIds.filter((id) => { const build = builds.find((item) => item.id === id); return build && isPokemonChampionsActiveSpecies(build.speciesName); }) : current.buildIds }))}><option value="open">Modo aberto</option><option value={POKEMON_CHAMPIONS_REGULATION_KEY}>Pokémon Champions · 208 espécies</option></select></label><label className="span-2">Estratégia<textarea rows={3} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div>
        <h2>Selecione até 6 builds</h2>
        <div className="team-build-picker">{compatibleBuilds.map((build) => <button type="button" className={form.buildIds.includes(build.id) ? "selected" : ""} key={build.id} onClick={() => toggleBuild(build.id)}><PokemonImage src={build.imageUrl} name={build.pokemonName} /><span><strong>{build.isPrimary ? "★ " : ""}{build.pokemonName}</strong><small>{build.buildName}</small><em>{build.heldItem || "Sem item"}</em></span></button>)}</div>
        <div className="selected-team-strip">{Array.from({ length: 6 }, (_, index) => { const build = builds.find((item) => item.id === form.buildIds[index]); return <div key={index}>{build ? <><PokemonImage src={build.imageUrl} name={build.pokemonName} /><span>{build.pokemonName}</span><div className="slot-order-controls"><button type="button" disabled={index === 0} onClick={() => moveBuild(index, -1)}>↑</button><button type="button" disabled={index >= form.buildIds.length - 1} onClick={() => moveBuild(index, 1)}>↓</button><button type="button" onClick={() => toggleBuild(build.id)}>×</button></div></> : <span>Slot {index + 1}</span>}</div>; })}</div>
        <section className="draft-validation"><h3>Validação em tempo real</h3>{draftIssues.map((issue, index) => <div key={`${issue.message}-${index}`} className={`validation-issue ${issue.severity}`}><span>{issue.severity === "success" ? "✓" : issue.severity === "warning" ? "⚠" : "✕"}</span><p>{issue.message}</p></div>)}</section>
        {message ? <div className="status-message">{message}</div> : null}
        <div className="form-actions"><button className="primary-button">Salvar equipe</button>{selectedTeamId ? <button className="danger-button" type="button" onClick={() => void remove()}>Excluir</button> : null}</div>
      </form>
    </div>
  </section>;
}

export function ImportPage({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [json, setJson] = useState("");
  const [status, setStatus] = useState("Cole ou carregue um JSON para validar.");
  const [valid, setValid] = useState(false);
  async function validate() { const result = await window.gestorPoke.imports.preview(json); setValid(result.valid); setStatus(result.valid ? `${result.count} Pokémon válidos. ${result.duplicates.length} duplicidade(s). Use “Revisar importação” para escolher criar, mesclar, substituir ou ignorar.` : result.errors.join("\n")); }
  async function execute() { const result = await window.gestorPoke.imports.execute(json); setStatus(`${result.importedPokemon} Pokémon e ${result.importedBuilds} builds importados.`); setValid(false); await onRefresh(); }
  return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Scanner de dados</span><h1>Importar JSON</h1><p>Valide o arquivo aqui; duplicidades devem ser tratadas pela tela “Revisar importação”.</p></div></header><div className="import-layout"><div className="glass-panel import-editor"><label className="file-picker">Carregar arquivo<input type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then((text) => { setJson(text); setValid(false); }); }} /></label><textarea value={json} onChange={(event) => { setJson(event.target.value); setValid(false); }} rows={24} /><div className="form-actions"><button className="secondary-button" type="button" onClick={() => void validate()}>Validar e revisar</button><button className="primary-button" type="button" disabled={!valid} onClick={() => void execute()}>Importar sem duplicidades</button></div></div><aside className={`scanner-panel ${valid ? "is-valid" : ""}`}><span className="eyebrow">Resultado</span><pre>{status}</pre></aside></div></section>;
}
