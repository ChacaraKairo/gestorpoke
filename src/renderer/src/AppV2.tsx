import { useCallback, useEffect, useState } from "react";
import type { BuildSummary, CatalogStatus, DashboardSummary, MoveCatalogEntry, PokedexEntry, PokemonSummary, TeamSummary } from "../../shared/contracts";
import logoUrl from "./assets/logo.png";
import { HomePage, MovesPage, PokedexPage, SettingsPage } from "./app/pages/CatalogPages";
import { BuildsPage, OwnedPokemonPage } from "./app/pages/PokemonPages";
import { ImportPage, TeamsPage } from "./app/pages/TeamImportPages";
import { emptyDashboard, errorMessage, type Page } from "./app/ui";
import "./v2.css";
import "./app/modular-pages.css";

export function AppV2() {
  const [page, setPage] = useState<Page>("home");
  const [dashboard, setDashboard] = useState<DashboardSummary>(emptyDashboard);
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

  return <div className="app-shell">
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
  </div>;
}
