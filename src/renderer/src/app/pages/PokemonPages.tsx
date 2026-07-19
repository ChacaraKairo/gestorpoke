import { type FormEvent, useEffect, useMemo, useState } from "react";
import type {
  BuildMove,
  BuildStat,
  BuildSummary,
  CompatibleMove,
  CreatePokemonInput,
  MoveCatalogEntry,
  PokedexEntry,
  PokemonCompatibility,
  PokemonSummary,
  StatCode,
  UpsertBuildInput,
} from "../../../../shared/contracts";
import {
  alignments,
  artworkUrl,
  emptyBuild,
  errorMessage,
  PokemonCard,
  PokemonImage,
  SearchSelect,
  type SearchOption,
  statLabels,
  titleize,
} from "../ui";

export function OwnedPokemonPage({ pokemon, pokedex, builds, onRefresh, onOpen }: {
  pokemon: PokemonSummary[];
  pokedex: PokedexEntry[];
  builds: BuildSummary[];
  onRefresh: () => Promise<void>;
  onOpen: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreatePokemonInput>({ speciesName: "", nationalDexNumber: null, nickname: "", formName: "default", types: [], ownershipStatus: "permanent", acquisitionSource: "champions", buildName: "Build principal", ability: null, statAlignment: null, heldItem: null });
  const [formError, setFormError] = useState<string | null>(null);
  const speciesOptions = useMemo<SearchOption[]>(() => pokedex.map((entry) => ({ id: entry.id, label: titleize(entry.speciesName), subtitle: `#${String(entry.nationalDexNumber ?? 0).padStart(4, "0")} · ${entry.types.map(titleize).join(" / ")} · ${titleize(entry.formName)}`, imageUrl: entry.imageUrl })), [pokedex]);
  const abilities = useMemo(() => Array.from(new Set(builds.map((build) => build.ability).filter(Boolean) as string[])).sort(), [builds]);
  const items = useMemo(() => Array.from(new Set(builds.map((build) => build.heldItem).filter(Boolean) as string[])).sort(), [builds]);
  const filtered = pokemon.filter((item) => `${item.speciesName} ${item.formName} ${item.nickname ?? ""} ${item.ability ?? ""} ${item.heldItem ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setFormError(null);
      await window.gestorPoke.pokemon.create(form);
      setShowForm(false);
      setForm({ speciesName: "", nationalDexNumber: null, nickname: "", formName: "default", types: [], ownershipStatus: "permanent", acquisitionSource: "champions", buildName: "Build principal", ability: null, statAlignment: null, heldItem: null });
      await onRefresh();
    } catch (caught) { setFormError(errorMessage(caught)); }
  }

  async function remove(id: number) {
    if (!window.confirm("Excluir este Pokémon e todas as suas builds?")) return;
    await window.gestorPoke.pokemon.remove(id);
    await onRefresh();
  }

  return <section className="page-stack">
    <header className="page-header"><div><span className="eyebrow">Box local</span><h1>Meus Pokémon</h1><p>Clique em um card para abrir somente as builds daquele exemplar.</p></div><button className="primary-button" onClick={() => setShowForm((value) => !value)}>{showForm ? "Fechar" : "Novo Pokémon"}</button></header>
    {showForm ? <form className="glass-panel form-grid" onSubmit={submit}>
      <SearchSelect label="Espécie e forma" options={speciesOptions} value={pokedex.find((entry) => entry.speciesName === form.speciesName && entry.formName === form.formName)?.id ?? null} placeholder="Digite para pesquisar espécie ou forma..." onChange={(id) => { const entry = pokedex.find((item) => item.id === Number(id)); if (entry) setForm((current) => ({ ...current, speciesName: entry.speciesName, nationalDexNumber: entry.nationalDexNumber, formName: entry.formName, types: entry.types })); }} />
      <label>Apelido<input value={form.nickname ?? ""} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></label>
      <label>Habilidade<input list="abilities-list" value={form.ability ?? ""} onChange={(event) => setForm({ ...form, ability: event.target.value })} placeholder="Pesquisar ou digitar..." /><datalist id="abilities-list">{abilities.map((item) => <option value={item} key={item} />)}</datalist></label>
      <label>Item equipado<input list="items-list" value={form.heldItem ?? ""} onChange={(event) => setForm({ ...form, heldItem: event.target.value })} placeholder="Pesquisar ou digitar..." /><datalist id="items-list">{items.map((item) => <option value={item} key={item} />)}</datalist></label>
      <label>Stat Alignment<select value={form.statAlignment ?? ""} onChange={(event) => setForm({ ...form, statAlignment: event.target.value || null })}><option value="">Selecione</option>{alignments.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Status<select value={form.ownershipStatus} onChange={(event) => setForm({ ...form, ownershipStatus: event.target.value as CreatePokemonInput["ownershipStatus"] })}><option value="permanent">Permanente</option><option value="trial">Teste</option><option value="visitor">Visitante</option></select></label>
      <label>Origem<select value={form.acquisitionSource} onChange={(event) => setForm({ ...form, acquisitionSource: event.target.value as CreatePokemonInput["acquisitionSource"] })}><option value="champions">Pokémon Champions</option><option value="pokemon_home">Pokémon HOME</option><option value="other">Outra</option></select></label>
      <label>Nome da primeira build<input required value={form.buildName} onChange={(event) => setForm({ ...form, buildName: event.target.value })} /></label>
      {formError ? <div className="error-message span-2">{formError}</div> : null}
      <div className="form-actions span-2"><button className="primary-button" disabled={!form.speciesName}>Salvar Pokémon</button></div>
    </form> : null}
    <div className="toolbar"><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar meus Pokémon..." /><span>{filtered.length} registros</span></div>
    {filtered.length ? <div className="card-grid">{filtered.map((item) => <PokemonCard key={item.id} pokemon={item} onOpen={() => onOpen(item.id)} onRemove={() => void remove(item.id)} />)}</div> : <div className="empty-state">Nenhum Pokémon encontrado.</div>}
  </section>;
}

export function BuildsPage({ pokemon, builds, moves, initialPokemonId, onRefresh }: {
  pokemon: PokemonSummary[];
  builds: BuildSummary[];
  moves: MoveCatalogEntry[];
  initialPokemonId: number | null;
  onRefresh: () => Promise<void>;
}) {
  const [pokemonFilter, setPokemonFilter] = useState<number | null>(initialPokemonId);
  const [selectedBuildId, setSelectedBuildId] = useState<number | null>(null);
  const [form, setForm] = useState<UpsertBuildInput>(() => emptyBuild(initialPokemonId ?? pokemon[0]?.id ?? 0));
  const [message, setMessage] = useState<string | null>(null);
  const [compatibility, setCompatibility] = useState<PokemonCompatibility | null>(null);
  const [syncingCompatibility, setSyncingCompatibility] = useState(false);
  const [showAllMoves, setShowAllMoves] = useState(false);

  useEffect(() => { if (initialPokemonId) window.queueMicrotask(() => { setPokemonFilter(initialPokemonId); setForm(emptyBuild(initialPokemonId)); }); }, [initialPokemonId]);
  useEffect(() => {
    if (!form.ownedPokemonId) { window.queueMicrotask(() => setCompatibility(null)); return; }
    void window.gestorPoke.compatibility.get(form.ownedPokemonId).then(setCompatibility).catch(() => setCompatibility(null));
  }, [form.ownedPokemonId]);

  const visibleBuilds = builds.filter((build) => !pokemonFilter || build.ownedPokemonId === pokemonFilter);
  const pokemonOptions = pokemon.map((item) => ({ id: item.id, label: item.nickname || titleize(item.speciesName), subtitle: `#${String(item.nationalDexNumber ?? 0).padStart(4, "0")} · ${titleize(item.formName)}`, imageUrl: item.imageUrl ?? artworkUrl(item.nationalDexNumber) }));
  const availableMoves: Array<MoveCatalogEntry | CompatibleMove> = compatibility?.synchronizedAt && !showAllMoves ? compatibility.moves : moves.filter((move) => move.availability !== "unavailable");
  const moveOptions = availableMoves.map((move) => {
    const methods = "methods" in move ? move.methods : [];
    return { id: move.id, label: titleize(move.name), subtitle: `${titleize(move.type ?? "sem tipo")} · ${titleize(move.category ?? "")} ${methods.length ? `· ${methods.map(titleize).join(", ")}` : ""}` };
  });

  async function edit(id: number) {
    const detail = await window.gestorPoke.builds.get(id);
    setSelectedBuildId(id);
    setPokemonFilter(detail.ownedPokemonId);
    setForm({ ownedPokemonId: detail.ownedPokemonId, name: detail.buildName, format: detail.format, ability: detail.ability, statAlignment: detail.statAlignment, heldItem: detail.heldItem, notes: detail.notes, moves: detail.moves, stats: detail.stats });
  }

  function setMove(slot: BuildMove["slot"], move: MoveCatalogEntry) {
    const next: BuildMove = { slot, name: move.name, type: move.type, pp: move.pp };
    setForm((current) => ({ ...current, moves: [...current.moves.filter((item) => item.slot !== slot), next] }));
  }

  function setStat(code: StatCode, field: keyof BuildStat, value: string) {
    setForm((current) => ({ ...current, stats: current.stats.map((stat) => stat.statCode === code ? { ...stat, [field]: field === "modifier" ? value : value ? Number(value) : null } as BuildStat : stat) }));
  }

  async function synchronizeCompatibility() {
    if (!form.ownedPokemonId) return;
    setSyncingCompatibility(true);
    try {
      const result = await window.gestorPoke.compatibility.synchronize(form.ownedPokemonId);
      setCompatibility(result);
      setShowAllMoves(false);
      setMessage(`Compatibilidade sincronizada para ${titleize(result.speciesName)} — ${titleize(result.formName)}.`);
    } catch (caught) { setMessage(errorMessage(caught)); }
    finally { setSyncingCompatibility(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      if (selectedBuildId) await window.gestorPoke.builds.update(selectedBuildId, form);
      else await window.gestorPoke.builds.create(form);
      setMessage("Build salva com sucesso.");
      setSelectedBuildId(null);
      setForm(emptyBuild(pokemonFilter ?? pokemon[0]?.id ?? 0));
      await onRefresh();
    } catch (caught) { setMessage(errorMessage(caught)); }
  }

  async function remove() {
    if (!selectedBuildId || !window.confirm("Excluir esta build?")) return;
    await window.gestorPoke.builds.remove(selectedBuildId);
    setSelectedBuildId(null);
    setForm(emptyBuild(pokemonFilter ?? pokemon[0]?.id ?? 0));
    await onRefresh();
  }

  async function duplicate() {
    if (!selectedBuildId) return;
    await window.gestorPoke.builds.duplicate(selectedBuildId);
    setMessage("Build duplicada.");
    await onRefresh();
  }

  async function setPrimary() {
    if (!selectedBuildId) return;
    await window.gestorPoke.builds.setPrimary(selectedBuildId);
    setMessage("Build principal atualizada.");
    await onRefresh();
  }

  return <section className="page-stack">
    <header className="page-header"><div><span className="eyebrow">Centro de treinamento</span><h1>Builds</h1><p>{pokemonFilter ? "Mostrando as builds do Pokémon selecionado." : "Escolha um Pokémon para visualizar suas builds."}</p></div><button className="primary-button" onClick={() => { setSelectedBuildId(null); setForm(emptyBuild(pokemonFilter ?? pokemon[0]?.id ?? 0)); }}>Nova build</button></header>
    <div className="build-layout-v2">
      <aside className="glass-panel build-sidebar">
        <SearchSelect label="Filtrar por Pokémon" options={pokemonOptions} value={pokemonFilter} placeholder="Pesquisar meus Pokémon..." onChange={(id) => { setPokemonFilter(Number(id)); setSelectedBuildId(null); setForm(emptyBuild(Number(id))); }} />
        <button className="secondary-button" onClick={() => setPokemonFilter(null)}>Mostrar todas</button>
        <div className="build-list-v2">{visibleBuilds.map((build) => <button className={selectedBuildId === build.id ? "active" : ""} key={build.id} onClick={() => void edit(build.id)}><PokemonImage src={build.imageUrl} name={build.pokemonName} /><span><strong>{build.isPrimary ? "★ " : ""}{build.pokemonName}</strong><small>{build.buildName}</small><em>{build.heldItem || "Sem item"}</em></span></button>)}</div>
      </aside>
      <form className="glass-panel build-editor-v2" onSubmit={save}>
        <section className="build-compatibility-inline">
          <div className="build-compatibility-inline__header"><div><span className="eyebrow">Compatibilidade por forma</span><strong>{compatibility ? `${titleize(compatibility.speciesName)} · ${titleize(compatibility.formName)}` : "Selecione um Pokémon"}</strong><small>{compatibility?.synchronizedAt ? `Sincronizado em ${new Date(compatibility.synchronizedAt).toLocaleString("pt-BR")}` : "Sincronize para filtrar habilidade e golpes válidos."}</small></div><button type="button" className="secondary-button" disabled={!form.ownedPokemonId || syncingCompatibility} onClick={() => void synchronizeCompatibility()}>{syncingCompatibility ? "Sincronizando..." : "Sincronizar forma"}</button></div>
          {compatibility?.synchronizedAt ? <label className="compatibility-mode"><input type="checkbox" checked={showAllMoves} onChange={(event) => setShowAllMoves(event.target.checked)} />Mostrar catálogo completo em modo avançado</label> : null}
        </section>
        <div className="form-grid">
          <SearchSelect label="Pokémon" options={pokemonOptions} value={form.ownedPokemonId || null} placeholder="Pesquisar Pokémon..." onChange={(id) => { setForm({ ...form, ownedPokemonId: Number(id), ability: null, moves: [] }); setShowAllMoves(false); }} />
          <label>Nome da build<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Formato<select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value as UpsertBuildInput["format"] })}><option value="single">Individual</option><option value="double">Dupla</option><option value="both">Ambos</option></select></label>
          <label>Habilidade<input list="compatible-abilities" value={form.ability ?? ""} onChange={(event) => setForm({ ...form, ability: event.target.value })} /><datalist id="compatible-abilities">{(compatibility?.abilities ?? []).map((ability) => <option key={ability.id} value={titleize(ability.name)}>{ability.hidden ? "Oculta" : "Normal"}</option>)}</datalist></label>
          <label>Item equipado<input value={form.heldItem ?? ""} onChange={(event) => setForm({ ...form, heldItem: event.target.value })} /></label>
          <label>Stat Alignment<select value={form.statAlignment ?? ""} onChange={(event) => setForm({ ...form, statAlignment: event.target.value || null })}><option value="">Selecione</option>{alignments.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <h2>Golpes</h2>
        <div className="move-slots-v2">{([1,2,3,4] as const).map((slot) => { const selected = form.moves.find((move) => move.slot === slot); return <div className="move-slot-v2" key={slot}><span>Slot {slot}</span><SearchSelect label="Golpe" options={moveOptions} value={availableMoves.find((move) => move.name === selected?.name)?.id ?? null} placeholder="Pesquisar golpes compatíveis..." onChange={(id) => { const move = availableMoves.find((item) => item.id === Number(id)); if (move) setMove(slot, move); }} /><small>{selected ? `${titleize(selected.type ?? "")} · ${selected.pp ?? "—"} PP` : "Nenhum golpe selecionado"}</small></div>; })}</div>
        <h2>Atributos</h2>
        <div className="stats-grid-v2">{form.stats.map((stat) => <div key={stat.statCode}><strong>{statLabels[stat.statCode]}</strong><label>Valor<input type="number" min="0" value={stat.finalValue ?? ""} onChange={(event) => setStat(stat.statCode, "finalValue", event.target.value)} /></label><label>Treino<input type="number" min="0" max="252" value={stat.trainingPoints ?? ""} onChange={(event) => setStat(stat.statCode, "trainingPoints", event.target.value)} /></label><select value={stat.modifier} onChange={(event) => setStat(stat.statCode, "modifier", event.target.value)}><option value="neutral">Neutro</option><option value="increased">Aumentado</option><option value="decreased">Reduzido</option></select></div>)}</div>
        <label className="notes-field">Observações<textarea rows={4} value={form.notes ?? ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        {message ? <div className="status-message">{message}</div> : null}
        <div className="form-actions"><button className="primary-button" disabled={!form.ownedPokemonId}>Salvar build</button>{selectedBuildId ? <><button className="secondary-button" type="button" onClick={() => void setPrimary()}>Marcar principal</button><button className="secondary-button" type="button" onClick={() => void duplicate()}>Duplicar</button><button className="danger-button" type="button" onClick={() => void remove()}>Excluir</button></> : null}</div>
      </form>
    </div>
  </section>;
}
