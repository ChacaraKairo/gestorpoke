import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import logoUrl from "./assets/logo.png";
import type {
  BuildDetail,
  BuildMove,
  BuildStat,
  BuildSummary,
  CreatePokemonInput,
  DashboardSummary,
  PokedexEntry,
  PokemonSummary,
  StatCode,
  TeamSummary,
  UpsertBuildInput,
} from "../../shared/contracts";
import { statCodes } from "../../shared/contracts";

type Page = "home" | "pokedex" | "pokemon" | "builds" | "teams" | "import" | "settings";

const emptyDashboard: DashboardSummary = { ownedPokemon: 0, builds: 0, teams: 0, recentPokemon: [] };
const statLabels: Record<StatCode, string> = {
  hp: "HP",
  attack: "Ataque",
  defense: "Defesa",
  specialAttack: "Ataque especial",
  specialDefense: "Defesa especial",
  speed: "Velocidade",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

function buildPokedexFromPokemon(pokemon: PokemonSummary[]): PokedexEntry[] {
  const entries = new Map<string, PokedexEntry>();
  pokemon.forEach((item) => {
    const key = `${item.speciesName.toLowerCase()}::${item.formName.toLowerCase()}`;
    const current = entries.get(key);
    if (current) {
      current.ownedCount += 1;
      current.buildCount += item.buildCount;
    } else {
      entries.set(key, {
        id: item.id,
        speciesName: item.speciesName,
        nationalDexNumber: item.nationalDexNumber,
        formName: item.formName,
        types: item.types,
        ownedCount: 1,
        buildCount: item.buildCount,
        firstSeenAt: item.createdAt,
      });
    }
  });
  return Array.from(entries.values()).sort((a, b) => (a.nationalDexNumber ?? 99999) - (b.nationalDexNumber ?? 99999));
}

function PokemonCard({ pokemon, onRemove }: { pokemon: PokemonSummary; onRemove?: (id: number) => void }) {
  const displayName = pokemon.nickname || pokemon.speciesName;
  return (
    <article className="pokemon-card" tabIndex={0}>
      <div className="pokemon-orb">{pokemon.nationalDexNumber ? String(pokemon.nationalDexNumber).padStart(3, "0") : "?"}</div>
      <div className="pokemon-card__body">
        <span className="eyebrow">{pokemon.speciesName}</span><h3>{displayName}</h3>
        <div className="badge-row">{pokemon.types.length ? pokemon.types.map((type) => <span className="type-badge" key={type}>{type}</span>) : <span className="type-badge muted">tipo não informado</span>}</div>
        <dl className="mini-data">
          <div><dt>Habilidade</dt><dd>{pokemon.ability || "Não informada"}</dd></div>
          <div><dt>Item</dt><dd>{pokemon.heldItem || "Nenhum"}</dd></div>
          <div><dt>Alinhamento</dt><dd>{pokemon.statAlignment || "Não informado"}</dd></div>
          <div><dt>Builds</dt><dd>{pokemon.buildCount}</dd></div>
        </dl>
      </div>
      {onRemove ? <button className="danger-button" type="button" onClick={() => onRemove(pokemon.id)}>Excluir</button> : null}
    </article>
  );
}

function HomePage({ summary, goTo }: { summary: DashboardSummary; goTo: (page: Page) => void }) {
  return <section className="page-stack">
    <header className="hero-panel"><div><span className="eyebrow">Central do treinador</span><h1>Monte, compare e aperfeiçoe suas equipes.</h1><p>Organize Pokémon, builds, golpes, itens e equipes individuais ou em dupla.</p></div><button className="primary-button" onClick={() => goTo("pokemon")}>Cadastrar Pokémon</button></header>
    <div className="summary-grid">
      <button className="summary-card" onClick={() => goTo("pokemon")}><strong>{summary.ownedPokemon}</strong><span>Pokémon</span></button>
      <button className="summary-card" onClick={() => goTo("builds")}><strong>{summary.builds}</strong><span>Builds</span></button>
      <button className="summary-card" onClick={() => goTo("teams")}><strong>{summary.teams}</strong><span>Equipes</span></button>
      <button className="summary-card accent" onClick={() => goTo("import")}><strong>JSON</strong><span>Importar em lote</span></button>
    </div>
    <section className="glass-panel"><div className="section-heading"><div><span className="eyebrow">Coleção</span><h2>Adicionados recentemente</h2></div></div>{summary.recentPokemon.length ? <div className="card-grid">{summary.recentPokemon.map((item) => <PokemonCard key={item.id} pokemon={item} />)}</div> : <div className="empty-state">Sua coleção ainda está vazia.</div>}</section>
  </section>;
}

function PokedexPage({ entries }: { entries: PokedexEntry[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => entries.filter((entry) => `${entry.speciesName} ${entry.formName} ${entry.nationalDexNumber ?? ""} ${entry.types.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [entries, query]);
  return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Catálogo local</span><h1>Pokédex</h1><p>Espécies descobertas por cadastro ou importação.</p></div></header><div className="toolbar"><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar espécie, número, forma ou tipo..."/><span>{filtered.length} registros</span></div><div className="pokedex-grid">{filtered.map((entry) => <article className="pokedex-card" key={entry.id}><div className="pokedex-number">#{String(entry.nationalDexNumber ?? 0).padStart(4, "0")}</div><div><span className="eyebrow">{entry.formName}</span><h3>{entry.speciesName}</h3><div className="badge-row">{entry.types.map((type) => <span className="type-badge" key={type}>{type}</span>)}</div></div><dl className="pokedex-stats"><div><dt>Exemplares</dt><dd>{entry.ownedCount}</dd></div><div><dt>Builds</dt><dd>{entry.buildCount}</dd></div></dl></article>)}</div></section>;
}

function PokemonPage({ pokemon, refresh }: { pokemon: PokemonSummary[]; refresh: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePokemonInput>({ speciesName: "", nationalDexNumber: null, nickname: "", formName: "default", types: [], ownershipStatus: "permanent", acquisitionSource: "champions", buildName: "Build principal", ability: "", statAlignment: "", heldItem: "" });
  const filtered = useMemo(() => pokemon.filter((item) => [item.speciesName, item.nickname, item.ability, item.heldItem].some((value) => value?.toLowerCase().includes(query.toLowerCase()))), [pokemon, query]);
  async function submit(event: FormEvent) { event.preventDefault(); try { setError(null); await window.gestorPoke.pokemon.create({ ...form, speciesName: form.speciesName.trim(), nickname: form.nickname?.trim() || null, ability: form.ability?.trim() || null, statAlignment: form.statAlignment?.trim() || null, heldItem: form.heldItem?.trim() || null }); setShowForm(false); setForm({ ...form, speciesName: "", nationalDexNumber: null, nickname: "", ability: "", statAlignment: "", heldItem: "" }); await refresh(); } catch (error) { setError(getErrorMessage(error)); } }
  async function remove(id: number) { if (!confirm("Excluir este Pokémon e suas builds?")) return; try { await window.gestorPoke.pokemon.remove(id); await refresh(); } catch (error) { setError(getErrorMessage(error)); } }
  return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Box local</span><h1>Meus Pokémon</h1><p>Cadastre exemplares e crie configurações competitivas.</p></div><button className="primary-button" onClick={() => setShowForm(!showForm)}>{showForm ? "Fechar" : "Novo Pokémon"}</button></header>{showForm ? <form className="glass-panel form-grid" onSubmit={submit}><label>Espécie<input required value={form.speciesName} onChange={(e) => setForm({...form, speciesName:e.target.value})}/></label><label>Nº Pokédex<input type="number" min="1" value={form.nationalDexNumber ?? ""} onChange={(e) => setForm({...form, nationalDexNumber:e.target.value ? Number(e.target.value):null})}/></label><label>Apelido<input value={form.nickname ?? ""} onChange={(e) => setForm({...form,nickname:e.target.value})}/></label><label>Forma<input value={form.formName} onChange={(e) => setForm({...form,formName:e.target.value})}/></label><label>Habilidade<input value={form.ability ?? ""} onChange={(e) => setForm({...form,ability:e.target.value})}/></label><label>Item equipado<input value={form.heldItem ?? ""} onChange={(e) => setForm({...form,heldItem:e.target.value})}/></label><label>Stat Alignment<input value={form.statAlignment ?? ""} onChange={(e) => setForm({...form,statAlignment:e.target.value})}/></label><label>Status<select value={form.ownershipStatus} onChange={(e) => setForm({...form,ownershipStatus:e.target.value as CreatePokemonInput["ownershipStatus"]})}><option value="permanent">Permanente</option><option value="trial">Teste</option><option value="visitor">Visitante</option></select></label><label>Origem<select value={form.acquisitionSource} onChange={(e) => setForm({...form,acquisitionSource:e.target.value as CreatePokemonInput["acquisitionSource"]})}><option value="champions">Champions</option><option value="pokemon_home">Pokémon HOME</option><option value="other">Outra</option></select></label><label>Nome da build<input required value={form.buildName} onChange={(e) => setForm({...form,buildName:e.target.value})}/></label>{error ? <div className="error-message span-2">{error}</div>:null}<div className="form-actions span-2"><button className="primary-button">Salvar</button></div></form>:null}<div className="toolbar"><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar..."/><span>{filtered.length} registros</span></div><div className="card-grid">{filtered.map((item) => <PokemonCard key={item.id} pokemon={item} onRemove={remove}/>)}</div></section>;
}

function emptyBuild(pokemon: PokemonSummary[]): UpsertBuildInput {
  return { ownedPokemonId: pokemon[0]?.id ?? 0, name: "Nova build", format: "both", ability: null, statAlignment: null, heldItem: null, notes: null, moves: [], stats: statCodes.map((statCode) => ({ statCode, finalValue: null, trainingPoints: null, modifier: "neutral" })) };
}

function BuildsPage({ pokemon, refreshAll }: { pokemon: PokemonSummary[]; refreshAll: () => Promise<void> }) {
  const [builds, setBuilds] = useState<BuildSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<UpsertBuildInput>(() => emptyBuild(pokemon));
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => setBuilds(await window.gestorPoke.builds.list()), []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!form.ownedPokemonId && pokemon[0]) setForm((current) => ({...current, ownedPokemonId:pokemon[0].id})); }, [pokemon, form.ownedPokemonId]);
  async function edit(id: number) { try { const detail = await window.gestorPoke.builds.get(id); setSelectedId(id); setForm({ ownedPokemonId: detail.ownedPokemonId, name: detail.buildName, format: detail.format, ability: detail.ability, statAlignment: detail.statAlignment, heldItem: detail.heldItem, notes: detail.notes, moves: detail.moves, stats: detail.stats }); } catch (error) { setError(getErrorMessage(error)); } }
  function setMove(slot: 1|2|3|4, field: keyof BuildMove, value: string) { const moves = [...form.moves]; const index = moves.findIndex((move) => move.slot === slot); const current: BuildMove = index >= 0 ? moves[index] : { slot, name:"", type:null, pp:null }; const next = { ...current, [field]: field === "pp" ? (value ? Number(value) : null) : value || null } as BuildMove; if (index >= 0) moves[index] = next; else moves.push(next); setForm({...form,moves}); }
  function setStat(code: StatCode, field: keyof BuildStat, value: string) { setForm({...form, stats: form.stats.map((stat) => stat.statCode === code ? {...stat,[field]: field === "modifier" ? value : value ? Number(value):null} as BuildStat : stat)}); }
  async function save(event: FormEvent) { event.preventDefault(); try { setError(null); const clean = {...form, moves: form.moves.filter((move) => move.name.trim())}; if (selectedId) await window.gestorPoke.builds.update(selectedId, clean); else await window.gestorPoke.builds.create(clean); setSelectedId(null); setForm(emptyBuild(pokemon)); await Promise.all([load(),refreshAll()]); } catch (error) { setError(getErrorMessage(error)); } }
  async function remove(id: number) { if (!confirm("Excluir esta build?")) return; try { await window.gestorPoke.builds.remove(id); await Promise.all([load(),refreshAll()]); } catch (error) { setError(getErrorMessage(error)); } }
  async function duplicate(id: number) { try { await window.gestorPoke.builds.duplicate(id); await Promise.all([load(),refreshAll()]); } catch (error) { setError(getErrorMessage(error)); } }
  return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Centro de treinamento</span><h1>Builds</h1><p>Edite golpes, atributos, habilidade, item e alinhamento.</p></div><button className="primary-button" onClick={() => {setSelectedId(null);setForm(emptyBuild(pokemon));}}>Nova build</button></header><div className="build-layout"><aside className="glass-panel build-list">{builds.map((build) => <button className={selectedId===build.id?"active":""} key={build.id} onClick={() => void edit(build.id)}><strong>{build.pokemonName}</strong><span>{build.buildName}</span><small>{build.heldItem || "Sem item"}</small></button>)}</aside><form className="glass-panel build-editor" onSubmit={save}><div className="form-grid"><label>Pokémon<select required value={form.ownedPokemonId} onChange={(e) => setForm({...form,ownedPokemonId:Number(e.target.value)})}><option value="">Selecione</option>{pokemon.map((item) => <option key={item.id} value={item.id}>{item.nickname || item.speciesName}</option>)}</select></label><label>Nome<input required value={form.name} onChange={(e) => setForm({...form,name:e.target.value})}/></label><label>Formato<select value={form.format} onChange={(e) => setForm({...form,format:e.target.value as UpsertBuildInput["format"]})}><option value="both">Ambos</option><option value="single">Individual</option><option value="double">Dupla</option></select></label><label>Habilidade<input value={form.ability ?? ""} onChange={(e) => setForm({...form,ability:e.target.value})}/></label><label>Item<input value={form.heldItem ?? ""} onChange={(e) => setForm({...form,heldItem:e.target.value})}/></label><label>Stat Alignment<input value={form.statAlignment ?? ""} onChange={(e) => setForm({...form,statAlignment:e.target.value})}/></label></div><h2>Golpes</h2><div className="moves-grid">{([1,2,3,4] as const).map((slot) => { const move=form.moves.find((item)=>item.slot===slot); return <div className="move-editor" key={slot}><strong>Slot {slot}</strong><input placeholder="Nome" value={move?.name ?? ""} onChange={(e)=>setMove(slot,"name",e.target.value)}/><input placeholder="Tipo" value={move?.type ?? ""} onChange={(e)=>setMove(slot,"type",e.target.value)}/><input type="number" min="0" placeholder="PP" value={move?.pp ?? ""} onChange={(e)=>setMove(slot,"pp",e.target.value)}/></div>;})}</div><h2>Atributos</h2><div className="stats-editor">{form.stats.map((stat)=><div key={stat.statCode}><strong>{statLabels[stat.statCode]}</strong><input type="number" min="0" placeholder="Valor final" value={stat.finalValue ?? ""} onChange={(e)=>setStat(stat.statCode,"finalValue",e.target.value)}/><input type="number" min="0" placeholder="Treino" value={stat.trainingPoints ?? ""} onChange={(e)=>setStat(stat.statCode,"trainingPoints",e.target.value)}/><select value={stat.modifier} onChange={(e)=>setStat(stat.statCode,"modifier",e.target.value)}><option value="neutral">Neutro</option><option value="increased">Aumentado</option><option value="decreased">Reduzido</option></select></div>)}</div><label>Observações<textarea rows={4} value={form.notes ?? ""} onChange={(e)=>setForm({...form,notes:e.target.value})}/></label>{error?<div className="error-message">{error}</div>:null}<div className="form-actions">{selectedId?<><button type="button" className="danger-button" onClick={()=>void remove(selectedId)}>Excluir</button><button type="button" className="secondary-button" onClick={()=>void duplicate(selectedId)}>Duplicar</button></>:null}<button className="primary-button">{selectedId?"Salvar alterações":"Criar build"}</button></div></form></div></section>;
}

function TeamsPage({ teams, builds, refresh }: { teams: TeamSummary[]; builds: BuildSummary[]; refresh: () => Promise<void> }) {
  const [showForm,setShowForm]=useState(false); const [name,setName]=useState(""); const [format,setFormat]=useState<"single"|"double">("single"); const [description,setDescription]=useState(""); const [selected,setSelected]=useState<number[]>([]); const [error,setError]=useState<string|null>(null);
  function toggle(id:number){ setSelected((current)=>current.includes(id)?current.filter((item)=>item!==id):current.length<6?[...current,id]:current); }
  async function submit(event:FormEvent){event.preventDefault();try{setError(null);await window.gestorPoke.teams.create({name,format,description:description||null,buildIds:selected});setName("");setDescription("");setSelected([]);setShowForm(false);await refresh();}catch(error){setError(getErrorMessage(error));}}
  return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Sala de estratégia</span><h1>Equipes</h1><p>Escolha até seis builds para batalhas individuais ou em dupla.</p></div><button className="primary-button" onClick={()=>setShowForm(!showForm)}>Nova equipe</button></header>{showForm?<form className="glass-panel" onSubmit={submit}><div className="form-grid"><label>Nome<input required value={name} onChange={(e)=>setName(e.target.value)}/></label><label>Formato<select value={format} onChange={(e)=>setFormat(e.target.value as "single"|"double")}><option value="single">Individual</option><option value="double">Dupla</option></select></label><label className="span-2">Estratégia<textarea rows={3} value={description} onChange={(e)=>setDescription(e.target.value)}/></label></div><h2>Integrantes ({selected.length}/6)</h2><div className="team-picker">{builds.map((build)=><button type="button" className={selected.includes(build.id)?"selected":""} key={build.id} onClick={()=>toggle(build.id)}><strong>{build.pokemonName}</strong><span>{build.buildName}</span><small>{build.heldItem||"Sem item"}</small></button>)}</div>{error?<div className="error-message">{error}</div>:null}<div className="form-actions"><button className="primary-button">Criar equipe</button></div></form>:null}<div className="team-grid">{teams.map((team)=><article className="team-card" key={team.id}><span className="eyebrow">{team.format==="single"?"Individual":"Dupla"}</span><h2>{team.name}</h2><div className="team-slots">{Array.from({length:6},(_,i)=><span key={i}>{i<team.memberCount?"●":"+"}</span>)}</div><p>{team.description||"Sem descrição."}</p><strong>{team.memberCount}/6 integrantes</strong></article>)}</div></section>;
}

const sampleJson=`{"schemaVersion":1,"game":"pokemon-champions","pokemon":[{"species":{"nationalDexNumber":604,"name":"Eelektross","form":"default","types":["electric"]},"ownedPokemon":{"ownershipStatus":"permanent","acquisitionSource":"champions"},"build":{"name":"Build importada","format":"both","ability":"Levitate","heldItem":"Leftovers","statAlignment":"Lonely","moves":[]}}]}`;
function ImportPage({onImported}:{onImported:()=>Promise<void>}){const[jsonText,setJsonText]=useState(sampleJson);const[status,setStatus]=useState("Valide antes de importar.");const[valid,setValid]=useState(false);async function validate(){try{const result=await window.gestorPoke.imports.validate(jsonText);setValid(result.valid);setStatus(result.valid?`${result.count} registro(s) válido(s).`:result.errors.join("\n"));}catch(error){setStatus(getErrorMessage(error));}}async function execute(){try{const result=await window.gestorPoke.imports.execute(jsonText);setStatus(`${result.importedPokemon} Pokémon importados.`);setValid(false);await onImported();}catch(error){setStatus(getErrorMessage(error));}}return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Scanner de dados</span><h1>Importar JSON</h1><p>Importe um ou vários Pokémon.</p></div></header><section className="import-layout"><div className="glass-panel import-editor"><label className="file-picker">Carregar arquivo<input type="file" accept=".json,application/json" onChange={async(e)=>{const file=e.target.files?.[0];if(file){setJsonText(await file.text());setValid(false);}}}/></label><textarea value={jsonText} onChange={(e)=>{setJsonText(e.target.value);setValid(false);}}/><div className="form-actions"><button type="button" className="secondary-button" onClick={()=>void validate()}>Validar</button><button type="button" className="primary-button" disabled={!valid} onClick={()=>void execute()}>Importar</button></div></div><aside className={`scanner-panel ${valid?"is-valid":""}`}><div className="scanner-ring"/><pre>{status}</pre></aside></section></section>;}
function SettingsPage(){return <section className="page-stack"><header className="page-header"><div><span className="eyebrow">Sistema</span><h1>Configurações</h1><p>Dados locais protegidos em SQLite.</p></div></header><div className="settings-grid"><article className="glass-panel"><h2>Banco local</h2><p>Chaves estrangeiras e modo WAL ativos.</p></article><article className="glass-panel"><h2>Segurança</h2><p>Renderer isolado e IPC validado com Zod.</p></article><article className="glass-panel"><h2>Distribuição</h2><p>AppImage para Linux e NSIS para Windows.</p></article></div></section>;}

export function App(){const[page,setPage]=useState<Page>("home");const[summary,setSummary]=useState(emptyDashboard);const[pokemon,setPokemon]=useState<PokemonSummary[]>([]);const[pokedex,setPokedex]=useState<PokedexEntry[]>([]);const[teams,setTeams]=useState<TeamSummary[]>([]);const[builds,setBuilds]=useState<BuildSummary[]>([]);const[error,setError]=useState<string|null>(null);const refresh=useCallback(async()=>{try{const[dashboardData,pokemonData,teamData,buildData]=await Promise.all([window.gestorPoke.dashboard.getSummary(),window.gestorPoke.pokemon.list(),window.gestorPoke.teams.list(),window.gestorPoke.builds.list()]);const pokedexData=window.gestorPoke.pokedex?await window.gestorPoke.pokedex.list():buildPokedexFromPokemon(pokemonData);setSummary(dashboardData);setPokemon(pokemonData);setTeams(teamData);setBuilds(buildData);setPokedex(pokedexData);setError(null);}catch(caught){setError(getErrorMessage(caught));}},[]);useEffect(()=>{void refresh();},[refresh]);const navigation:[Page,string,string][]=[["home","Início","◆"],["pokedex","Pokédex","◎"],["pokemon","Meus Pokémon","◉"],["builds","Builds","✦"],["teams","Equipes","⬡"],["import","Importar","⇩"],["settings","Configurações","⚙"]];return <div className="app-shell"><aside className="side-menu"><div className="brand"><img className="brand-logo" src={logoUrl} alt="GestorPoke"/><div><strong>GestorPoke</strong><small>Battle assistant</small></div></div><nav>{navigation.map(([id,label,icon])=><button className={page===id?"active":""} key={id} onClick={()=>setPage(id)}><span>{icon}</span>{label}</button>)}</nav><div className="side-note"><span>Modo local</span><strong>Pokémon Champions</strong></div></aside><main className="main-content">{error?<div className="error-message">{error}</div>:null}{page==="home"?<HomePage summary={summary} goTo={setPage}/>:null}{page==="pokedex"?<PokedexPage entries={pokedex}/>:null}{page==="pokemon"?<PokemonPage pokemon={pokemon} refresh={refresh}/>:null}{page==="builds"?<BuildsPage pokemon={pokemon} refreshAll={refresh}/>:null}{page==="teams"?<TeamsPage teams={teams} builds={builds} refresh={refresh}/>:null}{page==="import"?<ImportPage onImported={refresh}/>:null}{page==="settings"?<SettingsPage/>:null}</main><footer className="control-bar"><span><kbd>Enter</kbd> Confirmar</span><span><kbd>Esc</kbd> Voltar</span><span><kbd>Tab</kbd> Trocar área</span><span>Projeto não oficial</span></footer></div>;}
