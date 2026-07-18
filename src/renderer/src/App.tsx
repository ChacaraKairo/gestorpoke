import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreatePokemonInput,
  DashboardSummary,
  PokemonSummary,
  TeamSummary,
} from "../../shared/contracts";

type Page = "home" | "pokemon" | "teams" | "import" | "settings";

const emptyDashboard: DashboardSummary = {
  ownedPokemon: 0,
  builds: 0,
  teams: 0,
  recentPokemon: [],
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

function PokemonCard({ pokemon, onRemove }: { pokemon: PokemonSummary; onRemove?: (id: number) => void }) {
  const displayName = pokemon.nickname || pokemon.speciesName;
  return (
    <article className="pokemon-card" tabIndex={0}>
      <div className="pokemon-orb" aria-hidden="true">
        {pokemon.nationalDexNumber ? String(pokemon.nationalDexNumber).padStart(3, "0") : "?"}
      </div>
      <div className="pokemon-card__body">
        <span className="eyebrow">{pokemon.speciesName}</span>
        <h3>{displayName}</h3>
        <div className="badge-row">
          {pokemon.types.length > 0 ? pokemon.types.map((type) => <span className="type-badge" key={type}>{type}</span>) : <span className="type-badge muted">tipo não informado</span>}
        </div>
        <dl className="mini-data">
          <div><dt>Habilidade</dt><dd>{pokemon.ability || "Não informada"}</dd></div>
          <div><dt>Item</dt><dd>{pokemon.heldItem || "Nenhum"}</dd></div>
          <div><dt>Alinhamento</dt><dd>{pokemon.statAlignment || "Não informado"}</dd></div>
          <div><dt>Builds</dt><dd>{pokemon.buildCount}</dd></div>
        </dl>
      </div>
      {onRemove ? (
        <button className="danger-button" type="button" onClick={() => onRemove(pokemon.id)} aria-label={`Excluir ${displayName}`}>
          Excluir
        </button>
      ) : null}
    </article>
  );
}

function HomePage({ summary, goTo }: { summary: DashboardSummary; goTo: (page: Page) => void }) {
  return (
    <section className="page-stack">
      <header className="hero-panel">
        <div>
          <span className="eyebrow">Central do treinador</span>
          <h1>Monte, compare e aperfeiçoe suas equipes.</h1>
          <p>Organize builds do Pokémon Champions, prepare seleções individuais ou em dupla e importe capturas convertidas em JSON.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => goTo("pokemon")}>Cadastrar Pokémon</button>
      </header>

      <div className="summary-grid">
        <button className="summary-card" type="button" onClick={() => goTo("pokemon")}><strong>{summary.ownedPokemon}</strong><span>Pokémon cadastrados</span></button>
        <button className="summary-card" type="button" onClick={() => goTo("pokemon")}><strong>{summary.builds}</strong><span>Builds registradas</span></button>
        <button className="summary-card" type="button" onClick={() => goTo("teams")}><strong>{summary.teams}</strong><span>Equipes montadas</span></button>
        <button className="summary-card accent" type="button" onClick={() => goTo("import")}><strong>JSON</strong><span>Importar em lote</span></button>
      </div>

      <section className="glass-panel">
        <div className="section-heading"><div><span className="eyebrow">Coleção</span><h2>Adicionados recentemente</h2></div></div>
        {summary.recentPokemon.length === 0 ? <div className="empty-state">Sua coleção ainda está vazia. Cadastre manualmente ou importe um arquivo JSON.</div> : (
          <div className="card-grid">{summary.recentPokemon.map((pokemon) => <PokemonCard key={pokemon.id} pokemon={pokemon} />)}</div>
        )}
      </section>
    </section>
  );
}

function PokemonPage({ pokemon, refresh }: { pokemon: PokemonSummary[]; refresh: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreatePokemonInput>({
    speciesName: "",
    nationalDexNumber: null,
    nickname: "",
    formName: "default",
    types: [],
    ownershipStatus: "permanent",
    acquisitionSource: "champions",
    buildName: "Build principal",
    ability: "",
    statAlignment: "",
    heldItem: "",
  });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return pokemon;
    return pokemon.filter((item) => [item.speciesName, item.nickname, item.ability, item.statAlignment, item.heldItem].some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalized)));
  }, [pokemon, query]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await window.gestorPoke.pokemon.create({
        ...form,
        speciesName: form.speciesName.trim(),
        nickname: form.nickname?.trim() || null,
        ability: form.ability?.trim() || null,
        statAlignment: form.statAlignment?.trim() || null,
        heldItem: form.heldItem?.trim() || null,
      });
      setForm({ ...form, speciesName: "", nationalDexNumber: null, nickname: "", ability: "", statAlignment: "", heldItem: "" });
      setShowForm(false);
      await refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number): Promise<void> {
    if (!window.confirm("Excluir este Pokémon e todas as suas builds?")) return;
    try {
      await window.gestorPoke.pokemon.remove(id);
      await refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div><span className="eyebrow">Box local</span><h1>Meus Pokémon</h1><p>Exemplares pessoais separados do catálogo de espécies.</p></div>
        <button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}>{showForm ? "Fechar cadastro" : "Novo Pokémon"}</button>
      </header>

      {showForm ? (
        <form className="glass-panel form-grid" onSubmit={(event) => void submit(event)}>
          <label>Espécie<input required value={form.speciesName} onChange={(event) => setForm({ ...form, speciesName: event.target.value })} placeholder="Eelektross" /></label>
          <label>Nº da Pokédex<input type="number" min="1" value={form.nationalDexNumber ?? ""} onChange={(event) => setForm({ ...form, nationalDexNumber: event.target.value ? Number(event.target.value) : null })} /></label>
          <label>Apelido<input value={form.nickname ?? ""} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></label>
          <label>Forma<input value={form.formName ?? "default"} onChange={(event) => setForm({ ...form, formName: event.target.value })} /></label>
          <label>Habilidade<input value={form.ability ?? ""} onChange={(event) => setForm({ ...form, ability: event.target.value })} placeholder="Levitate" /></label>
          <label>Item equipado<input value={form.heldItem ?? ""} onChange={(event) => setForm({ ...form, heldItem: event.target.value })} placeholder="Leftovers" /></label>
          <label>Stat Alignment<input value={form.statAlignment ?? ""} onChange={(event) => setForm({ ...form, statAlignment: event.target.value })} placeholder="Lonely" /></label>
          <label>Status<select value={form.ownershipStatus} onChange={(event) => setForm({ ...form, ownershipStatus: event.target.value as CreatePokemonInput["ownershipStatus"] })}><option value="permanent">Permanente</option><option value="trial">Teste</option><option value="visitor">Visitante</option></select></label>
          <label>Origem<select value={form.acquisitionSource} onChange={(event) => setForm({ ...form, acquisitionSource: event.target.value as CreatePokemonInput["acquisitionSource"] })}><option value="champions">Pokémon Champions</option><option value="pokemon_home">Pokémon HOME</option><option value="other">Outra</option></select></label>
          <label className="span-2">Nome da build<input required value={form.buildName} onChange={(event) => setForm({ ...form, buildName: event.target.value })} /></label>
          {error ? <div className="error-message span-2">{error}</div> : null}
          <div className="form-actions span-2"><button className="primary-button" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar Pokémon"}</button></div>
        </form>
      ) : null}

      <div className="toolbar"><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome, apelido, habilidade ou item..." /><span>{filtered.length} registro(s)</span></div>
      {filtered.length === 0 ? <div className="empty-state">Nenhum Pokémon encontrado.</div> : <div className="card-grid">{filtered.map((item) => <PokemonCard key={item.id} pokemon={item} onRemove={(id) => void remove(id)} />)}</div>}
    </section>
  );
}

function TeamsPage({ teams, refresh }: { teams: TeamSummary[]; refresh: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"single" | "double">("single");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await window.gestorPoke.teams.create({ name, format, description: description || null, buildIds: [] });
      setName("");
      setDescription("");
      setShowForm(false);
      await refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header"><div><span className="eyebrow">Sala de estratégia</span><h1>Equipes</h1><p>Crie times para batalhas individuais ou em dupla.</p></div><button className="primary-button" type="button" onClick={() => setShowForm((value) => !value)}>Nova equipe</button></header>
      {showForm ? <form className="glass-panel form-grid" onSubmit={(event) => void submit(event)}><label>Nome<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Formato<select value={format} onChange={(event) => setFormat(event.target.value as "single" | "double")}><option value="single">Individual</option><option value="double">Dupla</option></select></label><label className="span-2">Estratégia<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>{error ? <div className="error-message span-2">{error}</div> : null}<div className="form-actions span-2"><button className="primary-button" type="submit">Criar equipe</button></div></form> : null}
      {teams.length === 0 ? <div className="empty-state">Nenhuma equipe criada. A edição dos seis integrantes será a próxima evolução do MVP.</div> : <div className="team-grid">{teams.map((team) => <article className="team-card" key={team.id}><span className="eyebrow">{team.format === "single" ? "Individual" : "Dupla"}</span><h2>{team.name}</h2><div className="team-slots">{Array.from({ length: 6 }, (_, index) => <span key={index}>{index < team.memberCount ? "●" : "+"}</span>)}</div><p>{team.description || "Sem descrição estratégica."}</p><strong>{team.memberCount}/6 integrantes</strong></article>)}</div>}
    </section>
  );
}

const sampleJson = `{
  "schemaVersion": 1,
  "game": "pokemon-champions",
  "pokemon": [
    {
      "species": {
        "nationalDexNumber": 604,
        "name": "Eelektross",
        "form": "default",
        "types": ["electric"]
      },
      "ownedPokemon": {
        "gender": "male",
        "ownershipStatus": "permanent",
        "acquisitionSource": "champions"
      },
      "build": {
        "name": "Build importada",
        "format": "both",
        "statAlignment": "Lonely",
        "ability": "Levitate",
        "heldItem": "Leftovers",
        "moves": [
          { "slot": 1, "name": "Supercell Slam", "type": "electric", "pp": 16 },
          { "slot": 2, "name": "Superpower", "type": "fighting", "pp": 8 },
          { "slot": 3, "name": "Acid Spray", "type": "poison", "pp": 20 },
          { "slot": 4, "name": "Volt Switch", "type": "electric", "pp": 20 }
        ],
        "stats": {
          "hp": { "finalValue": 192, "trainingPoints": 32 },
          "attack": { "finalValue": 183, "trainingPoints": 32, "modifier": "increased" },
          "defense": { "finalValue": 90, "trainingPoints": 0, "modifier": "decreased" },
          "specialAttack": { "finalValue": 125, "trainingPoints": 0 },
          "specialDefense": { "finalValue": 102, "trainingPoints": 2 },
          "speed": { "finalValue": 70, "trainingPoints": 0 }
        }
      }
    }
  ]
}`;

function ImportPage({ onImported }: { onImported: () => Promise<void> }) {
  const [jsonText, setJsonText] = useState(sampleJson);
  const [status, setStatus] = useState<string>("Cole ou carregue um JSON e valide antes de importar.");
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);

  async function validate(): Promise<void> {
    setBusy(true);
    try {
      const result = await window.gestorPoke.imports.validate(jsonText);
      setValid(result.valid);
      setStatus(result.valid ? `${result.count} Pokémon pronto(s) para importação.` : result.errors.join("\n"));
    } catch (caught) {
      setValid(false);
      setStatus(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function execute(): Promise<void> {
    setBusy(true);
    try {
      const result = await window.gestorPoke.imports.execute(jsonText);
      setStatus(`${result.importedPokemon} Pokémon e ${result.importedBuilds} build(s) importados.${result.warnings.length ? `\nAvisos: ${result.warnings.join(" ")}` : ""}`);
      setValid(false);
      await onImported();
    } catch (caught) {
      setStatus(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setJsonText(await file.text());
    setValid(false);
    setStatus(`Arquivo carregado: ${file.name}. Valide o conteúdo.`);
  }

  return (
    <section className="page-stack">
      <header className="page-header"><div><span className="eyebrow">Scanner de dados</span><h1>Importar JSON</h1><p>Arquivos podem conter um ou vários Pokémon. Nada é gravado antes da validação.</p></div></header>
      <section className="import-layout">
        <div className="glass-panel import-editor"><label className="file-picker">Carregar arquivo .json<input type="file" accept="application/json,.json" onChange={(event) => void loadFile(event.target.files?.[0])} /></label><textarea value={jsonText} onChange={(event) => { setJsonText(event.target.value); setValid(false); }} spellCheck={false} aria-label="Conteúdo JSON" /><div className="form-actions"><button className="secondary-button" disabled={busy} type="button" onClick={() => void validate()}>Validar</button><button className="primary-button" disabled={!valid || busy} type="button" onClick={() => void execute()}>Importar registros</button></div></div>
        <aside className={`scanner-panel ${valid ? "is-valid" : ""}`}><div className="scanner-ring" aria-hidden="true" /><span className="eyebrow">Resultado</span><pre>{status}</pre><p>A importação usa uma transação SQLite: em caso de falha, o lote inteiro é cancelado.</p></aside>
      </section>
    </section>
  );
}

function SettingsPage() {
  return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Sistema</span><h1>Configurações</h1><p>O banco SQLite é salvo na pasta de dados do usuário do sistema operacional.</p></div></header><div className="settings-grid"><article className="glass-panel"><h2>Dados locais</h2><p>SQLite com chaves estrangeiras e modo WAL.</p></article><article className="glass-panel"><h2>Segurança</h2><p>Renderer isolado, sem acesso direto ao Node.js ou ao banco.</p></article><article className="glass-panel"><h2>Próximas opções</h2><p>Backup, restauração, tema, catálogo e pasta de imagens.</p></article></div></section>;
}

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [summary, setSummary] = useState<DashboardSummary>(emptyDashboard);
  const [pokemon, setPokemon] = useState<PokemonSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [dashboardData, pokemonData, teamData] = await Promise.all([
        window.gestorPoke.dashboard.getSummary(),
        window.gestorPoke.pokemon.list(),
        window.gestorPoke.teams.list(),
      ]);
      setSummary(dashboardData);
      setPokemon(pokemonData);
      setTeams(teamData);
      setFatalError(null);
    } catch (caught) {
      setFatalError(getErrorMessage(caught));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const navigation: Array<{ id: Page; label: string; icon: string }> = [
    { id: "home", label: "Início", icon: "◆" },
    { id: "pokemon", label: "Meus Pokémon", icon: "◉" },
    { id: "teams", label: "Equipes", icon: "⬡" },
    { id: "import", label: "Importar", icon: "⇩" },
    { id: "settings", label: "Configurações", icon: "⚙" },
  ];

  return (
    <div className="app-shell">
      <aside className="side-menu">
        <div className="brand"><span className="brand-mark">GP</span><div><strong>GestorPoke</strong><small>Battle assistant</small></div></div>
        <nav>{navigation.map((item) => <button className={page === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setPage(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="side-note"><span>Modo local</span><strong>Pokémon Champions</strong></div>
      </aside>
      <main className="main-content">
        {fatalError ? <div className="error-message">Falha ao carregar dados: {fatalError}</div> : null}
        {page === "home" ? <HomePage summary={summary} goTo={setPage} /> : null}
        {page === "pokemon" ? <PokemonPage pokemon={pokemon} refresh={refresh} /> : null}
        {page === "teams" ? <TeamsPage teams={teams} refresh={refresh} /> : null}
        {page === "import" ? <ImportPage onImported={refresh} /> : null}
        {page === "settings" ? <SettingsPage /> : null}
      </main>
      <footer className="control-bar"><span><kbd>Enter</kbd> Confirmar</span><span><kbd>Esc</kbd> Voltar</span><span><kbd>Tab</kbd> Trocar área</span><span>Projeto não oficial</span></footer>
    </div>
  );
}