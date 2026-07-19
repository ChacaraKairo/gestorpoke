import { useMemo, useState } from "react";
import type { PokemonCompatibility, PokemonSummary } from "../../shared/contracts";
import { normalizeType, typeColors, typeLabels } from "../../shared/type-system";
import "./compatibility.css";

function titleize(value: string): string {
  return value.split("-").map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join(" ");
}

export function CompatibilityOverlay() {
  const [open, setOpen] = useState(false);
  const [pokemon, setPokemon] = useState<PokemonSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compatibility, setCompatibility] = useState<PokemonCompatibility | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"moves" | "abilities">("moves");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function show(): Promise<void> {
    setOpen(true);
    const list = await window.gestorPoke.pokemon.list();
    setPokemon(list);
    if (list[0]) await selectPokemon(list[0].id);
  }

  async function selectPokemon(id: number): Promise<void> {
    setSelectedId(id);
    setBusy(true);
    try {
      setCompatibility(await window.gestorPoke.compatibility.get(id));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a compatibilidade.");
    } finally {
      setBusy(false);
    }
  }

  async function synchronize(): Promise<void> {
    if (!selectedId) return;
    setBusy(true);
    try {
      const result = await window.gestorPoke.compatibility.synchronize(selectedId);
      setCompatibility(result);
      setMessage(`${result.abilities.length} habilidades e ${result.moves.length} golpes sincronizados.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao sincronizar compatibilidade.");
    } finally {
      setBusy(false);
    }
  }

  const filteredMoves = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (compatibility?.moves ?? []).filter((move) =>
      `${move.name} ${move.type ?? ""} ${move.category ?? ""} ${move.methods.join(" ")}`.toLowerCase().includes(normalized),
    );
  }, [compatibility, query]);

  const filteredAbilities = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (compatibility?.abilities ?? []).filter((ability) =>
      `${ability.name} ${ability.description ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [compatibility, query]);

  return <>
    <button className="compatibility-trigger" type="button" onClick={() => void show()}>✦ Compatibilidade</button>
    {open ? <div className="compatibility-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="compatibility-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span className="eyebrow">Catálogo por espécie</span><h1>Golpes e habilidades compatíveis</h1></div>
          <button className="danger-button" type="button" onClick={() => setOpen(false)}>Fechar</button>
        </header>

        <div className="compatibility-toolbar">
          <label>Pokémon
            <select value={selectedId ?? ""} onChange={(event) => void selectPokemon(Number(event.target.value))}>
              {pokemon.map((item) => <option key={item.id} value={item.id}>{item.nickname || titleize(item.speciesName)}</option>)}
            </select>
          </label>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar golpe, tipo, método ou habilidade..." />
          <button className="primary-button" type="button" disabled={!selectedId || busy} onClick={() => void synchronize()}>
            {busy ? "Sincronizando..." : "Sincronizar compatibilidade"}
          </button>
        </div>

        {compatibility ? <div className="compatibility-status">
          <strong>{titleize(compatibility.speciesName)}</strong>
          <span>Forma: {titleize(compatibility.formName)}</span>
          <span>{compatibility.synchronizedAt ? `Atualizado em ${new Date(compatibility.synchronizedAt).toLocaleString("pt-BR")}` : "Ainda não sincronizado"}</span>
        </div> : null}
        {message ? <div className="status-message">{message}</div> : null}

        <div className="compatibility-tabs">
          <button className={tab === "moves" ? "active" : ""} onClick={() => setTab("moves")}>Golpes ({filteredMoves.length})</button>
          <button className={tab === "abilities" ? "active" : ""} onClick={() => setTab("abilities")}>Habilidades ({filteredAbilities.length})</button>
        </div>

        {tab === "moves" ? <div className="compatibility-grid">
          {filteredMoves.map((move) => {
            const type = normalizeType(move.type);
            return <article key={move.id} style={type ? { "--compat-color": typeColors[type] } as React.CSSProperties : undefined}>
              <div className="compatibility-card-heading"><strong>{titleize(move.name)}</strong>{type ? <span>{typeLabels[type]}</span> : null}</div>
              <dl><div><dt>Categoria</dt><dd>{titleize(move.category ?? "desconhecida")}</dd></div><div><dt>Poder</dt><dd>{move.power ?? "—"}</dd></div><div><dt>PP</dt><dd>{move.pp ?? "—"}</dd></div></dl>
              <small>Métodos: {move.methods.length ? move.methods.map(titleize).join(", ") : "não informado"}</small>
              <p>{move.description || "Descrição ainda não sincronizada no catálogo geral."}</p>
            </article>;
          })}
          {!filteredMoves.length ? <div className="empty-state">Sincronize este Pokémon ou ajuste a pesquisa.</div> : null}
        </div> : <div className="compatibility-grid abilities">
          {filteredAbilities.map((ability) => <article key={ability.id}>
            <div className="compatibility-card-heading"><strong>{titleize(ability.name)}</strong>{ability.hidden ? <span>Oculta</span> : <span>Slot {ability.slot}</span>}</div>
            <p>{ability.description || "Descrição ainda não sincronizada no catálogo geral."}</p>
          </article>)}
          {!filteredAbilities.length ? <div className="empty-state">Sincronize este Pokémon ou ajuste a pesquisa.</div> : null}
        </div>}
      </section>
    </div> : null}
  </>;
}
