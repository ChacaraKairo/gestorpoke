import { FormEvent, useMemo, useState } from "react";
import type { OwnedPokemonDetail, PokemonSummary, UpdatePokemonInput } from "../../shared/contracts";
import "./pokemon-manager.css";

function artworkUrl(number: number | null): string | null {
  return number == null ? null : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${number}.png`;
}

function titleize(value: string): string {
  return value.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function emptyForm(detail: OwnedPokemonDetail): UpdatePokemonInput {
  return {
    nickname: detail.nickname,
    gender: detail.gender,
    ownershipStatus: detail.ownershipStatus,
    acquisitionSource: detail.acquisitionSource,
    notes: detail.notes,
  };
}

export function PokemonManagerOverlay() {
  const [open, setOpen] = useState(false);
  const [pokemon, setPokemon] = useState<PokemonSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OwnedPokemonDetail | null>(null);
  const [form, setForm] = useState<UpdatePokemonInput | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => pokemon.filter((item) => `${item.speciesName} ${item.nickname ?? ""}`.toLowerCase().includes(query.toLowerCase())), [pokemon, query]);

  async function show() {
    setOpen(true);
    setBusy(true);
    try { setPokemon(await window.gestorPoke.pokemon.list()); }
    finally { setBusy(false); }
  }

  async function selectPokemon(id: number) {
    setSelectedId(id);
    setBusy(true);
    setMessage(null);
    try {
      const data = await window.gestorPoke.pokemon.get(id);
      setDetail(data);
      setForm(emptyForm(data));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar o Pokémon.");
    } finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!detail || !form) return;
    setBusy(true);
    try {
      const updated = await window.gestorPoke.pokemon.update(detail.id, form);
      setDetail(updated);
      setForm(emptyForm(updated));
      setPokemon(await window.gestorPoke.pokemon.list());
      setMessage("Dados do Pokémon atualizados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally { setBusy(false); }
  }

  return <>
    <button className="pokemon-manager-trigger" type="button" onClick={() => void show()}><span>◉</span> Fichas Pokémon</button>
    {open ? <div className="pokemon-manager-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="pokemon-manager-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="pokemon-manager-header"><div><span className="eyebrow">Gerenciamento da coleção</span><h1>Fichas dos Pokémon</h1></div><button className="danger-button" type="button" onClick={() => setOpen(false)}>Fechar</button></header>
        <div className="pokemon-manager-layout">
          <aside className="pokemon-manager-list">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar Pokémon..." />
            <div>{filtered.map((item) => <button type="button" className={selectedId === item.id ? "active" : ""} key={item.id} onClick={() => void selectPokemon(item.id)}><img src={item.imageUrl ?? artworkUrl(item.nationalDexNumber) ?? ""} alt="" /><span><strong>{item.nickname || titleize(item.speciesName)}</strong><small>{titleize(item.speciesName)} · {item.buildCount} builds</small></span></button>)}</div>
          </aside>
          <main className="pokemon-manager-content">
            {busy ? <div className="pokemon-manager-empty">Carregando...</div> : null}
            {!busy && !detail ? <div className="pokemon-manager-empty">Selecione um Pokémon para abrir sua ficha.</div> : null}
            {!busy && detail && form ? <form onSubmit={save}>
              <section className="pokemon-profile-hero">
                <img src={detail.imageUrl ?? artworkUrl(detail.nationalDexNumber) ?? ""} alt={detail.speciesName} />
                <div><span className="eyebrow">#{String(detail.nationalDexNumber ?? 0).padStart(4,"0")} · {titleize(detail.formName)}</span><h2>{detail.nickname || titleize(detail.speciesName)}</h2><p>{detail.types.map(titleize).join(" / ")}</p><small>Cadastrado em {new Date(detail.createdAt).toLocaleDateString("pt-BR")}</small></div>
              </section>
              <div className="pokemon-profile-form">
                <label>Apelido<input value={form.nickname ?? ""} onChange={(event) => setForm({ ...form, nickname:event.target.value })} /></label>
                <label>Sexo<select value={form.gender} onChange={(event) => setForm({ ...form, gender:event.target.value as UpdatePokemonInput["gender"] })}><option value="unknown">Não informado</option><option value="male">Masculino</option><option value="female">Feminino</option><option value="genderless">Sem gênero</option></select></label>
                <label>Status<select value={form.ownershipStatus} onChange={(event) => setForm({ ...form, ownershipStatus:event.target.value as UpdatePokemonInput["ownershipStatus"] })}><option value="permanent">Permanente</option><option value="trial">Teste</option><option value="visitor">Visitante</option></select></label>
                <label>Origem<select value={form.acquisitionSource} onChange={(event) => setForm({ ...form, acquisitionSource:event.target.value as UpdatePokemonInput["acquisitionSource"] })}><option value="champions">Pokémon Champions</option><option value="pokemon_home">Pokémon HOME</option><option value="other">Outra</option></select></label>
                <label className="wide">Notas<textarea rows={5} value={form.notes ?? ""} onChange={(event) => setForm({ ...form, notes:event.target.value })} /></label>
              </div>
              <section className="pokemon-build-summary"><div className="section-heading"><div><span className="eyebrow">Configurações</span><h3>Builds deste exemplar</h3></div></div>{detail.builds.length ? detail.builds.map((build) => <article key={build.id}><div><strong>{build.buildName}</strong><small>{build.format === "both" ? "Individual e Dupla" : build.format === "double" ? "Dupla" : "Individual"}</small></div><span>{build.ability || "Sem habilidade"}</span><span>{build.heldItem || "Sem item"}</span></article>) : <p>Nenhuma build cadastrada.</p>}</section>
              {message ? <div className="status-message">{message}</div> : null}
              <div className="form-actions"><button className="primary-button" disabled={busy}>Salvar alterações</button></div>
            </form> : null}
          </main>
        </div>
      </section>
    </div> : null}
  </>;
}