import { useMemo, useState } from "react";
import type { CatalogStatus, DashboardSummary, MoveCatalogEntry, PokedexEntry } from "../../../../shared/contracts";
import { PokemonCard, PokemonImage, type Page, titleize } from "../ui";

export function HomePage({ dashboard, onNavigate, onOpenPokemon }: {
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

export function PokedexPage({ entries, status, onSync }: { entries: PokedexEntry[]; status: CatalogStatus | null; onSync: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const types = useMemo(() => Array.from(new Set(entries.flatMap((entry) => entry.types))).sort(), [entries]);
  const filtered = useMemo(() => entries.filter((entry) => {
    const text = `${entry.speciesName} ${entry.formName} ${entry.nationalDexNumber ?? ""} ${entry.types.join(" ")}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (type === "all" || entry.types.includes(type));
  }), [entries, query, type]);
  async function synchronize() { setSyncing(true); try { await window.gestorPoke.pokedex.synchronize(); await onSync(); } finally { setSyncing(false); } }
  return <section className="page-stack">
    <header className="page-header"><div><span className="eyebrow">Catálogo completo</span><h1>Pokédex</h1><p>Todos os Pokémon aparecem, independentemente de você possuir ou não.</p></div><button className="primary-button" disabled={syncing} onClick={() => void synchronize()}>{syncing ? "Atualizando..." : "Atualizar catálogo"}</button></header>
    <div className="catalog-status"><span>{status?.speciesCount ?? entries.length} espécies</span><span>Fonte: {status?.source ?? "PokéAPI"}</span><span>Atualizado: {status?.synchronizedAt ? new Date(status.synchronizedAt).toLocaleString("pt-BR") : "Nunca"}</span></div>
    <div className="toolbar"><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome, número, forma ou tipo..." /><select className="filter-select" value={type} onChange={(event) => setType(event.target.value)}><option value="all">Todos os tipos</option>{types.map((item) => <option key={item} value={item}>{titleize(item)}</option>)}</select><span>{filtered.length} resultados</span></div>
    <div className="pokedex-grid-v2">{filtered.map((entry) => <article className="pokedex-card-v2" key={entry.id}><PokemonImage src={entry.imageUrl} name={entry.speciesName} /><div className="pokedex-number">#{String(entry.nationalDexNumber ?? 0).padStart(4, "0")}</div><h3>{titleize(entry.speciesName)}</h3><div className="badge-row">{entry.types.map((item) => <span className="type-badge" key={item}>{titleize(item)}</span>)}</div><footer><span>{entry.ownedCount ? `${entry.ownedCount} possuído(s)` : "Não possuído"}</span><strong>{entry.buildCount} builds</strong></footer></article>)}</div>
  </section>;
}

export function MovesPage({ moves, onRefresh }: { moves: MoveCatalogEntry[]; onRefresh: () => Promise<void> }) {
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

export function SettingsPage({ status, onRefresh }: { status: CatalogStatus | null; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function syncAll() { setBusy(true); try { await Promise.all([window.gestorPoke.pokedex.synchronize(), window.gestorPoke.moves.synchronize(), window.gestorPoke.abilities.synchronize(), window.gestorPoke.items.synchronize()]); await onRefresh(); } finally { setBusy(false); } }
  return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Sistema</span><h1>Configurações</h1><p>Gerencie os catálogos locais usados pelos seletores.</p></div></header><div className="settings-grid"><article className="glass-panel"><h2>Pokédex</h2><strong>{status?.speciesCount ?? 0} espécies</strong><p>Todos os Pokémon aparecem independentemente da coleção.</p></article><article className="glass-panel"><h2>Golpes</h2><strong>{status?.moveCount ?? 0} movimentos</strong><p>Disponibilidade no Champions é rastreada separadamente.</p></article><article className="glass-panel"><h2>Habilidades</h2><strong>{status?.abilityCount ?? 0}</strong><p>Catálogo usado pelos formulários e compatibilidade.</p></article><article className="glass-panel"><h2>Itens</h2><strong>{status?.itemCount ?? 0}</strong><p>Itens com descrição e disponibilidade local.</p></article><article className="glass-panel"><h2>Sincronização</h2><button className="primary-button" disabled={busy} onClick={() => void syncAll()}>{busy ? "Atualizando..." : "Atualizar todos os catálogos"}</button></article></div></section>;
}
