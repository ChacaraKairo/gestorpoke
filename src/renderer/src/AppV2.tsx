import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import logoUrl from "./assets/logo.png";
import { statCodes } from "../../shared/contracts";
import type {
  BuildDetail,
  BuildMove,
  BuildStat,
  BuildSummary,
  CatalogStatus,
  CreatePokemonInput,
  DashboardSummary,
  MoveCatalogEntry,
  PokedexEntry,
  PokemonSummary,
  StatCode,
  TeamDetail,
  TeamSummary,
  UpsertBuildInput,
  UpsertTeamInput,
} from "../../shared/contracts";

import "./v2.css";

type Page = "home" | "pokedex" | "pokemon" | "builds" | "teams" | "moves" | "import" | "settings";

const emptyDashboard: DashboardSummary = { ownedPokemon: 0, builds: 0, teams: 0, recentPokemon: [] };
const statLabels: Record<StatCode, string> = {
  hp: "HP",
  attack: "Ataque",
  defense: "Defesa",
  specialAttack: "Ataque especial",
  specialDefense: "Defesa especial",
  speed: "Velocidade",
};
const alignments = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Docile", "Bold", "Relaxed", "Impish", "Lax",
  "Serious", "Timid", "Hasty", "Jolly", "Naive", "Bashful", "Modest", "Mild", "Quiet", "Rash",
  "Quirky", "Calm", "Gentle", "Sassy", "Careful",
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

function artworkUrl(number: number | null | undefined): string | null {
  return number == null
    ? null
    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${number}.png`;
}

function titleize(value: string): string {
  return value.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

type SearchOption = {
  id: number | string;
  label: string;
  subtitle?: string;
  imageUrl?: string | null;
};

function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: SearchOption[];
  value: number | string | null;
  onChange: (value: number | string, option: SearchOption) => void;
  placeholder: string;
}) {
  const selected = options.find((option) => String(option.id) === String(value));
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => setQuery(selected?.label ?? ""), [selected?.label]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || selected?.label === query) return options.slice(0, 40);
    return options.filter((option) => `${option.label} ${option.subtitle ?? ""}`.toLowerCase().includes(normalized)).slice(0, 40);
  }, [options, query, selected?.label]);

  return (
    <label className="search-select">
      <span>{label}</span>
      <input
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open ? (
        <div className="search-select__menu">
          {filtered.length ? filtered.map((option) => (
            <button
              type="button"
              key={option.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onChange(option.id, option); setQuery(option.label); setOpen(false); }}
            >
              {option.imageUrl ? <img src={option.imageUrl} alt="" loading="lazy" /> : <span className="option-dot" />}
              <span><strong>{option.label}</strong><small>{option.subtitle}</small></span>
            </button>
          )) : <div className="search-select__empty">Nenhum resultado.</div>}
        </div>
      ) : null}
    </label>
  );
}

function PokemonImage({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="pokemon-image-fallback">?</div>;
  return <img className="pokemon-image" src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />;
}

function PokemonCard({ pokemon, onOpen, onRemove }: {
  pokemon: PokemonSummary;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  const name = pokemon.nickname || pokemon.speciesName;
  return (
    <article className="pokemon-card-v2" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()}>
      <PokemonImage src={pokemon.imageUrl ?? artworkUrl(pokemon.nationalDexNumber)} name={name} />
      <div className="pokemon-card-v2__content">
        <span className="eyebrow">#{String(pokemon.nationalDexNumber ?? 0).padStart(4, "0")} · {pokemon.speciesName}</span>
        <h3>{name}</h3>
        <div className="badge-row">{pokemon.types.map((type) => <span className="type-badge" key={type}>{titleize(type)}</span>)}</div>
        <dl className="mini-data">
          <div><dt>Builds</dt><dd>{pokemon.buildCount}</dd></div>
          <div><dt>Habilidade</dt><dd>{pokemon.ability || "Não definida"}</dd></div>
          <div><dt>Item</dt><dd>{pokemon.heldItem || "Nenhum"}</dd></div>
        </dl>
      </div>
      {onRemove ? <button className="danger-button card-delete" type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }}>Excluir</button> : null}
    </article>
  );
}

function emptyBuild(pokemonId = 0): UpsertBuildInput {
  return {
    ownedPokemonId: pokemonId,
    name: "Nova build",
    format: "both",
    ability: null,
    statAlignment: null,
    heldItem: null,
    notes: null,
    moves: [],
    stats: statCodes.map((statCode) => ({ statCode, finalValue: null, trainingPoints: null, modifier: "neutral" })),
  };
}

export function AppV2() {
  const [page, setPage] = useState<Page>("home");
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [pokedex, setPokedex] = useState<PokedexEntry[]>([]);
  const [pokemon, setPokemon] = useState<PokemonSummary[]>([]);
  const [builds, setBuilds] = useState<BuildSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [moves, setMoves] = useState<MoveCatalogEntry[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus | null>(null);
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardData, pokedexData, pokemonData, buildData, teamData, moveData, status] = await Promise.all([
        window.gestorPoke.dashboard.getSummary(),
        window.gestorPoke.pokedex.list(),
        window.gestorPoke.pokemon.list(),
        window.gestorPoke.builds.list(),
        window.gestorPoke.teams.list(),
        window.gestorPoke.moves.list(),
        window.gestorPoke.pokedex.status(),
      ]);
      setDashboard(dashboardData);
      setPokedex(pokedexData);
      setPokemon(pokemonData);
      setBuilds(buildData);
      setTeams(teamData);
      setMoves(moveData);
      setCatalogStatus(status);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function openPokemonBuilds(id: number): void {
    setSelectedPokemonId(id);
    setPage("builds");
  }

  const nav: Array<{ id: Page; label: string; icon: string }> = [
    { id: "home", label: "Início", icon: "◆" },
    { id: "pokedex", label: "Pokédex", icon: "◎" },
    { id: "pokemon", label: "Meus Pokémon", icon: "◉" },
    { id: "builds", label: "Builds", icon: "◇" },
    { id: "teams", label: "Equipes", icon: "⬡" },
    { id: "moves", label: "Golpes", icon: "✦" },
    { id: "import", label: "Importar", icon: "⇩" },
    { id: "settings", label: "Configurações", icon: "⚙" },
  ];

  return (
    <div className="app-shell">
      <aside className="side-menu">
        <div className="brand"><img className="brand-logo" src={logoUrl} alt="GestorPoke" /><div><strong>GestorPoke</strong><small>Battle assistant</small></div></div>
        <nav>{nav.map((item) => <button className={page === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setPage(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="side-note"><span>Catálogo</span><strong>{catalogStatus?.speciesCount ?? 0} Pokémon</strong><small>{catalogStatus?.moveCount ?? 0} golpes</small></div>
      </aside>
      <main className="main-content">
        {loading ? <div className="loading-panel">Carregando dados...</div> : null}
        {error ? <div className="error-message">{error}</div> : null}
        {!loading && page === "home" ? <HomePage dashboard={dashboard} onNavigate={setPage} onOpenPokemon={openPokemonBuilds} /> : null}
        {!loading && page === "pokedex" ? <PokedexPage entries={pokedex} status={catalogStatus} onSync={refresh} /> : null}
        {!loading && page === "pokemon" ? <OwnedPokemonPage pokemon={pokemon} pokedex={pokedex} builds={builds} onRefresh={refresh} onOpen={openPokemonBuilds} /> : null}
        {!loading && page === "builds" ? <BuildsPage pokemon={pokemon} builds={builds} moves={moves} initialPokemonId={selectedPokemonId} onRefresh={refresh} /> : null}
        {!loading && page === "teams" ? <TeamsPage teams={teams} builds={builds} onRefresh={refresh} /> : null}
        {!loading && page === "moves" ? <MovesPage moves={moves} onRefresh={refresh} /> : null}
        {!loading && page === "import" ? <ImportPage onRefresh={refresh} /> : null}
        {!loading && page === "settings" ? <SettingsPage status={catalogStatus} onRefresh={refresh} /> : null}
      </main>
      <footer className="control-bar"><span><kbd>Enter</kbd> Abrir</span><span><kbd>Esc</kbd> Voltar</span><span><kbd>Tab</kbd> Navegar</span><span>Projeto não oficial</span></footer>
    </div>
  );
}

function HomePage({ dashboard, onNavigate, onOpenPokemon }: {
  dashboard: DashboardSummary;
  onNavigate: (page: Page) => void;
  onOpenPokemon: (id: number) => void;
}) {
  return <section className="page-stack">
    <header className="hero-panel"><div><span className="eyebrow">Central do treinador</span><h1>Monte, teste e aperfeiçoe suas equipes.</h1><p>Pokédex completa, builds por exemplar, golpes pesquisáveis e equipes separadas por formato.</p></div><button className="primary-button" onClick={() => onNavigate("pokemon")}>Cadastrar Pokémon</button></header>
    <div className="summary-grid">
      <button className="summary-card" onClick={() => onNavigate("pokedex")}><strong>DEX</strong><span>Pokédex completa</span></button>
      <button className="summary-card" onClick={() => onNavigate("pokemon")}><strong>{dashboard.ownedPokemon}</strong><span>Meus Pokémon</span></button>
      <button className="summary-card" onClick={() => onNavigate("builds")}><strong>{dashboard.builds}</strong><span>Builds</span></button>
      <button className="summary-card accent" onClick={() => onNavigate("teams")}><strong>{dashboard.teams}</strong><span>Equipes</span></button>
    </div>
    <section className="glass-panel"><div className="section-heading"><div><span className="eyebrow">Coleção</span><h2>Adicionados recentemente</h2></div></div>{dashboard.recentPokemon.length ? <div className="card-grid">{dashboard.recentPokemon.map((item) => <PokemonCard key={item.id} pokemon={item} onOpen={() => onOpenPokemon(item.id)} />)}</div> : <div className="empty-state">Sua coleção ainda está vazia.</div>}</section>
  </section>;
}

function PokedexPage({ entries, status, onSync }: { entries: PokedexEntry[]; status: CatalogStatus | null; onSync: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const types = useMemo(() => Array.from(new Set(entries.flatMap((entry) => entry.types))).sort(), [entries]);
  const filtered = useMemo(() => entries.filter((entry) => {
    const text = `${entry.speciesName} ${entry.formName} ${entry.nationalDexNumber ?? ""} ${entry.types.join(" ")}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (type === "all" || entry.types.includes(type));
  }), [entries, query, type]);
  async function synchronize() {
    setSyncing(true);
    try { await window.gestorPoke.pokedex.synchronize(); await onSync(); } finally { setSyncing(false); }
  }
  return <section className="page-stack">
    <header className="page-header"><div><span className="eyebrow">Catálogo completo</span><h1>Pokédex</h1><p>Todos os Pokémon aparecem, independentemente de você possuir ou não.</p></div><button className="primary-button" disabled={syncing} onClick={() => void synchronize()}>{syncing ? "Atualizando..." : "Atualizar catálogo"}</button></header>
    <div className="catalog-status"><span>{status?.speciesCount ?? entries.length} espécies</span><span>Fonte: {status?.source ?? "PokéAPI"}</span><span>Atualizado: {status?.synchronizedAt ? new Date(status.synchronizedAt).toLocaleString("pt-BR") : "Nunca"}</span></div>
    <div className="toolbar"><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome, número, forma ou tipo..." /><select className="filter-select" value={type} onChange={(event) => setType(event.target.value)}><option value="all">Todos os tipos</option>{types.map((item) => <option key={item} value={item}>{titleize(item)}</option>)}</select><span>{filtered.length} resultados</span></div>
    <div className="pokedex-grid-v2">{filtered.map((entry) => <article className="pokedex-card-v2" key={entry.id}><PokemonImage src={entry.imageUrl} name={entry.speciesName} /><div className="pokedex-number">#{String(entry.nationalDexNumber ?? 0).padStart(4, "0")}</div><h3>{titleize(entry.speciesName)}</h3><div className="badge-row">{entry.types.map((item) => <span className="type-badge" key={item}>{titleize(item)}</span>)}</div><footer><span>{entry.ownedCount ? `${entry.ownedCount} possuído(s)` : "Não possuído"}</span><strong>{entry.buildCount} builds</strong></footer></article>)}</div>
  </section>;
}

function OwnedPokemonPage({ pokemon, pokedex, builds, onRefresh, onOpen }: {
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
  const speciesOptions = useMemo<SearchOption[]>(() => pokedex.map((entry) => ({ id: entry.id, label: titleize(entry.speciesName), subtitle: `#${String(entry.nationalDexNumber ?? 0).padStart(4, "0")} · ${entry.types.map(titleize).join(" / ")}`, imageUrl: entry.imageUrl })), [pokedex]);
  const abilities = useMemo(() => Array.from(new Set(builds.map((build) => build.ability).filter(Boolean) as string[])).sort(), [builds]);
  const items = useMemo(() => Array.from(new Set(builds.map((build) => build.heldItem).filter(Boolean) as string[])).sort(), [builds]);
  const filtered = pokemon.filter((item) => `${item.speciesName} ${item.nickname ?? ""} ${item.ability ?? ""} ${item.heldItem ?? ""}`.toLowerCase().includes(query.toLowerCase()));

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
      <SearchSelect label="Espécie" options={speciesOptions} value={pokedex.find((entry) => entry.speciesName === form.speciesName)?.id ?? null} placeholder="Digite para pesquisar todos os Pokémon..." onChange={(id) => { const entry = pokedex.find((item) => item.id === Number(id)); if (entry) setForm((current) => ({ ...current, speciesName: entry.speciesName, nationalDexNumber: entry.nationalDexNumber, formName: entry.formName, types: entry.types })); }} />
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

function BuildsPage({ pokemon, builds, moves, initialPokemonId, onRefresh }: {
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
  useEffect(() => { if (initialPokemonId) { setPokemonFilter(initialPokemonId); setForm(emptyBuild(initialPokemonId)); } }, [initialPokemonId]);
  const visibleBuilds = builds.filter((build) => !pokemonFilter || build.ownedPokemonId === pokemonFilter);
  const pokemonOptions = pokemon.map((item) => ({ id: item.id, label: item.nickname || titleize(item.speciesName), subtitle: `#${String(item.nationalDexNumber ?? 0).padStart(4, "0")}`, imageUrl: item.imageUrl ?? artworkUrl(item.nationalDexNumber) }));
  const moveOptions = moves.filter((move) => move.availability !== "unavailable").map((move) => ({ id: move.id, label: titleize(move.name), subtitle: `${titleize(move.type ?? "sem tipo")} · ${titleize(move.category ?? "")}` }));

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

  return <section className="page-stack">
    <header className="page-header"><div><span className="eyebrow">Centro de treinamento</span><h1>Builds</h1><p>{pokemonFilter ? "Mostrando as builds do Pokémon selecionado." : "Escolha um Pokémon para visualizar suas builds."}</p></div><button className="primary-button" onClick={() => { setSelectedBuildId(null); setForm(emptyBuild(pokemonFilter ?? pokemon[0]?.id ?? 0)); }}>Nova build</button></header>
    <div className="build-layout-v2">
      <aside className="glass-panel build-sidebar">
        <SearchSelect label="Filtrar por Pokémon" options={pokemonOptions} value={pokemonFilter} placeholder="Pesquisar meus Pokémon..." onChange={(id) => { setPokemonFilter(Number(id)); setSelectedBuildId(null); setForm(emptyBuild(Number(id))); }} />
        <button className="secondary-button" onClick={() => setPokemonFilter(null)}>Mostrar todas</button>
        <div className="build-list-v2">{visibleBuilds.map((build) => <button className={selectedBuildId === build.id ? "active" : ""} key={build.id} onClick={() => void edit(build.id)}><PokemonImage src={build.imageUrl} name={build.pokemonName} /><span><strong>{build.pokemonName}</strong><small>{build.buildName}</small><em>{build.heldItem || "Sem item"}</em></span></button>)}</div>
      </aside>
      <form className="glass-panel build-editor-v2" onSubmit={save}>
        <div className="form-grid">
          <SearchSelect label="Pokémon" options={pokemonOptions} value={form.ownedPokemonId || null} placeholder="Pesquisar Pokémon..." onChange={(id) => setForm({ ...form, ownedPokemonId: Number(id) })} />
          <label>Nome da build<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Formato<select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value as UpsertBuildInput["format"] })}><option value="single">Individual</option><option value="double">Dupla</option><option value="both">Ambos</option></select></label>
          <label>Habilidade<input value={form.ability ?? ""} onChange={(event) => setForm({ ...form, ability: event.target.value })} /></label>
          <label>Item equipado<input value={form.heldItem ?? ""} onChange={(event) => setForm({ ...form, heldItem: event.target.value })} /></label>
          <label>Stat Alignment<select value={form.statAlignment ?? ""} onChange={(event) => setForm({ ...form, statAlignment: event.target.value || null })}><option value="">Selecione</option>{alignments.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <h2>Golpes</h2>
        <div className="move-slots-v2">{([1,2,3,4] as const).map((slot) => { const selected = form.moves.find((move) => move.slot === slot); return <div className="move-slot-v2" key={slot}><span>Slot {slot}</span><SearchSelect label="Golpe" options={moveOptions} value={moves.find((move) => move.name === selected?.name)?.id ?? null} placeholder="Pesquisar todos os golpes..." onChange={(id) => { const move = moves.find((item) => item.id === Number(id)); if (move) setMove(slot, move); }} /><small>{selected ? `${titleize(selected.type ?? "")} · ${selected.pp ?? "—"} PP` : "Nenhum golpe selecionado"}</small></div>; })}</div>
        <h2>Atributos</h2>
        <div className="stats-grid-v2">{form.stats.map((stat) => <div key={stat.statCode}><strong>{statLabels[stat.statCode]}</strong><label>Valor<input type="number" min="0" value={stat.finalValue ?? ""} onChange={(event) => setStat(stat.statCode, "finalValue", event.target.value)} /></label><label>Treino<input type="number" min="0" value={stat.trainingPoints ?? ""} onChange={(event) => setStat(stat.statCode, "trainingPoints", event.target.value)} /></label><select value={stat.modifier} onChange={(event) => setStat(stat.statCode, "modifier", event.target.value)}><option value="neutral">Neutro</option><option value="increased">Aumentado</option><option value="decreased">Reduzido</option></select></div>)}</div>
        <label className="notes-field">Observações<textarea rows={4} value={form.notes ?? ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        {message ? <div className="status-message">{message}</div> : null}
        <div className="form-actions"><button className="primary-button" disabled={!form.ownedPokemonId}>Salvar build</button>{selectedBuildId ? <button className="danger-button" type="button" onClick={() => void remove()}>Excluir</button> : null}</div>
      </form>
    </div>
  </section>;
}

function TeamsPage({ teams, builds, onRefresh }: { teams: TeamSummary[]; builds: BuildSummary[]; onRefresh: () => Promise<void> }) {
  const [formatTab, setFormatTab] = useState<"single" | "double">("single");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [form, setForm] = useState<UpsertTeamInput>({ name: "Nova equipe", format: "single", description: null, buildIds: [] });
  const [message, setMessage] = useState<string | null>(null);
  const visibleTeams = teams.filter((team) => team.format === formatTab);
  const compatibleBuilds = builds.filter((build) => build.format === "both" || build.format === form.format);

  async function edit(id: number) {
    const detail = await window.gestorPoke.teams.get(id);
    setSelectedTeamId(id);
    setFormatTab(detail.format);
    setForm({ name: detail.name, format: detail.format, description: detail.description, buildIds: detail.members.map((member) => member.id) });
  }

  function toggleBuild(id: number) {
    setForm((current) => current.buildIds.includes(id)
      ? { ...current, buildIds: current.buildIds.filter((item) => item !== id) }
      : current.buildIds.length < 6 ? { ...current, buildIds: [...current.buildIds, id] } : current);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      if (selectedTeamId) await window.gestorPoke.teams.update(selectedTeamId, form);
      else await window.gestorPoke.teams.create(form);
      setMessage("Equipe salva com sucesso.");
      setSelectedTeamId(null);
      setForm({ name: "Nova equipe", format: formatTab, description: null, buildIds: [] });
      await onRefresh();
    } catch (caught) { setMessage(errorMessage(caught)); }
  }

  async function remove() {
    if (!selectedTeamId || !window.confirm("Excluir esta equipe?")) return;
    await window.gestorPoke.teams.remove(selectedTeamId);
    setSelectedTeamId(null);
    setForm({ name: "Nova equipe", format: formatTab, description: null, buildIds: [] });
    await onRefresh();
  }

  return <section className="page-stack">
    <header className="page-header"><div><span className="eyebrow">Sala de estratégia</span><h1>Equipes</h1><p>Equipes individuais e duplas ficam separadas e podem ser editadas.</p></div><button className="primary-button" onClick={() => { setSelectedTeamId(null); setForm({ name: "Nova equipe", format: formatTab, description: null, buildIds: [] }); }}>Nova equipe</button></header>
    <div className="format-tabs"><button className={formatTab === "single" ? "active" : ""} onClick={() => { setFormatTab("single"); setForm((current) => ({ ...current, format: "single" })); }}>Batalha Individual</button><button className={formatTab === "double" ? "active" : ""} onClick={() => { setFormatTab("double"); setForm((current) => ({ ...current, format: "double" })); }}>Batalha Dupla</button></div>
    <div className="team-layout-v2">
      <aside className="team-list-v2">{visibleTeams.length ? visibleTeams.map((team) => <button className={selectedTeamId === team.id ? "active" : ""} key={team.id} onClick={() => void edit(team.id)}><strong>{team.name}</strong><small>{team.memberCount}/6 integrantes</small></button>) : <div className="empty-state">Nenhuma equipe neste formato.</div>}</aside>
      <form className="glass-panel team-editor-v2" onSubmit={save}>
        <div className="form-grid"><label>Nome<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Formato<select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value as UpsertTeamInput["format"] })}><option value="single">Individual</option><option value="double">Dupla</option></select></label><label className="span-2">Estratégia<textarea rows={3} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div>
        <h2>Selecione até 6 builds</h2>
        <div className="team-build-picker">{compatibleBuilds.map((build) => <button type="button" className={form.buildIds.includes(build.id) ? "selected" : ""} key={build.id} onClick={() => toggleBuild(build.id)}><PokemonImage src={build.imageUrl} name={build.pokemonName} /><span><strong>{build.pokemonName}</strong><small>{build.buildName}</small><em>{build.heldItem || "Sem item"}</em></span></button>)}</div>
        <div className="selected-team-strip">{Array.from({ length: 6 }, (_, index) => { const build = builds.find((item) => item.id === form.buildIds[index]); return <div key={index}>{build ? <><PokemonImage src={build.imageUrl} name={build.pokemonName} /><span>{build.pokemonName}</span></> : <span>Slot {index + 1}</span>}</div>; })}</div>
        {message ? <div className="status-message">{message}</div> : null}
        <div className="form-actions"><button className="primary-button">Salvar equipe</button>{selectedTeamId ? <button className="danger-button" type="button" onClick={() => void remove()}>Excluir</button> : null}</div>
      </form>
    </div>
  </section>;
}

function MovesPage({ moves, onRefresh }: { moves: MoveCatalogEntry[]; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<"all" | MoveCatalogEntry["availability"]>("all");
  const [syncing, setSyncing] = useState(false);
  const filtered = moves.filter((move) => `${move.name} ${move.type ?? ""} ${move.category ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (availability === "all" || move.availability === availability));
  async function sync() { setSyncing(true); try { await window.gestorPoke.moves.synchronize(); await onRefresh(); } finally { setSyncing(false); } }
  return <section className="page-stack">
    <header className="page-header"><div><span className="eyebrow">Catálogo de movimentos</span><h1>Golpes</h1><p>O estado indica se o golpe já foi confirmado no Pokémon Champions.</p></div><button className="primary-button" disabled={syncing} onClick={() => void sync()}>{syncing ? "Sincronizando..." : "Atualizar golpes"}</button></header>
    <div className="info-banner">O site oficial não fornece uma lista completa de compatibilidade. Golpes ainda não verificados aparecem como “A confirmar”, evitando informações inventadas.</div>
    <div className="toolbar"><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar golpe, tipo ou categoria..." /><select className="filter-select" value={availability} onChange={(event) => setAvailability(event.target.value as typeof availability)}><option value="all">Todos</option><option value="confirmed">Confirmados no Champions</option><option value="unknown">A confirmar</option><option value="unavailable">Indisponíveis</option></select><span>{filtered.length} golpes</span></div>
    <div className="moves-table"><header><span>Golpe</span><span>Tipo</span><span>Categoria</span><span>Poder</span><span>Precisão</span><span>PP</span><span>Disponibilidade</span></header>{filtered.map((move) => <article key={move.id}><strong>{titleize(move.name)}</strong><span>{titleize(move.type ?? "—")}</span><span>{titleize(move.category ?? "—")}</span><span>{move.power ?? "—"}</span><span>{move.accuracy ?? "—"}</span><span>{move.pp ?? "—"}</span><span className={`availability ${move.availability}`}>{move.availability === "confirmed" ? "Confirmado" : move.availability === "unavailable" ? "Indisponível" : "A confirmar"}</span></article>)}</div>
  </section>;
}

function ImportPage({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [json, setJson] = useState("");
  const [status, setStatus] = useState("Cole ou carregue um JSON para validar.");
  const [valid, setValid] = useState(false);
  async function validate() { const result = await window.gestorPoke.imports.validate(json); setValid(result.valid); setStatus(result.valid ? `${result.count} Pokémon prontos para importar.` : result.errors.join("\n")); }
  async function execute() { const result = await window.gestorPoke.imports.execute(json); setStatus(`${result.importedPokemon} Pokémon e ${result.importedBuilds} builds importados.`); setValid(false); await onRefresh(); }
  return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Scanner de dados</span><h1>Importar JSON</h1><p>Um arquivo pode conter vários Pokémon e builds.</p></div></header><div className="import-layout"><div className="glass-panel import-editor"><label className="file-picker">Carregar arquivo<input type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setJson); }} /></label><textarea value={json} onChange={(event) => { setJson(event.target.value); setValid(false); }} rows={24} /><div className="form-actions"><button className="secondary-button" onClick={() => void validate()}>Validar</button><button className="primary-button" disabled={!valid} onClick={() => void execute()}>Importar</button></div></div><aside className={`scanner-panel ${valid ? "is-valid" : ""}`}><span className="eyebrow">Resultado</span><pre>{status}</pre></aside></div></section>;
}

function SettingsPage({ status, onRefresh }: { status: CatalogStatus | null; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function syncAll() { setBusy(true); try { await window.gestorPoke.pokedex.synchronize(); await window.gestorPoke.moves.synchronize(); await onRefresh(); } finally { setBusy(false); } }
  return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Sistema</span><h1>Configurações</h1><p>Gerencie os catálogos locais usados pelos seletores.</p></div></header><div className="settings-grid"><article className="glass-panel"><h2>Pokédex</h2><strong>{status?.speciesCount ?? 0} espécies</strong><p>Todos os Pokémon aparecem independentemente da coleção.</p></article><article className="glass-panel"><h2>Golpes</h2><strong>{status?.moveCount ?? 0} movimentos</strong><p>Disponibilidade no Champions é rastreada separadamente.</p></article><article className="glass-panel"><h2>Sincronização</h2><button className="primary-button" disabled={busy} onClick={() => void syncAll()}>{busy ? "Atualizando..." : "Atualizar todos os catálogos"}</button></article></div></section>;
}
