import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { PokemonSummary, TeamDetail, TeamSummary } from "../../shared/contracts";
import {
  getCombinedEffectiveness,
  getMultiplierLabel,
  getTypeEffectiveness,
  pokemonTypes,
  typeColors,
  typeLabels,
  type TypeMultiplier,
} from "../../shared/type-system";
import "./type-analysis.css";

function effectivenessClass(value: TypeMultiplier): string {
  if (value === 0) return "immune";
  if (value <= 0.5) return "resisted";
  if (value >= 2) return "effective";
  return "neutral";
}

function typeStyle(color: string): CSSProperties {
  return { "--type-color": color } as CSSProperties;
}

export function TypeAnalysisOverlay() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chart" | "team">("chart");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [pokemon, setPokemon] = useState<PokemonSummary[]>([]);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([window.gestorPoke.teams.list(), window.gestorPoke.pokemon.list()])
      .then(([teamList, pokemonList]) => {
        setTeams(teamList);
        setPokemon(pokemonList);
      })
      .finally(() => setLoading(false));
  }, [open]);

  async function selectTeam(id: number) {
    setLoading(true);
    try { setTeam(await window.gestorPoke.teams.get(id)); }
    finally { setLoading(false); }
  }

  const teamMembers = useMemo(() => {
    if (!team) return [];
    return team.members.map((member) => ({
      ...member,
      pokemon: pokemon.find((item) => item.id === member.ownedPokemonId) ?? null,
    }));
  }, [team, pokemon]);

  return (
    <>
      <button className="type-analysis-trigger" type="button" onClick={() => setOpen(true)}>
        <span>◈</span> Tabela de tipos
      </button>
      {open ? <div className="type-analysis-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
        <section className="type-analysis-modal" role="dialog" aria-modal="true" aria-label="Tabela e análise de tipos" onMouseDown={(event) => event.stopPropagation()}>
          <header className="type-analysis-header">
            <div><span className="eyebrow">Análise competitiva</span><h1>Forças e fraquezas</h1></div>
            <button className="danger-button" type="button" onClick={() => setOpen(false)}>Fechar</button>
          </header>
          <div className="type-analysis-tabs">
            <button className={tab === "chart" ? "active" : ""} onClick={() => setTab("chart")}>Tabela geral</button>
            <button className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}>Comparar equipe</button>
          </div>
          {loading ? <div className="type-analysis-loading">Carregando...</div> : null}
          {!loading && tab === "chart" ? <GeneralTypeChart /> : null}
          {!loading && tab === "team" ? (
            <div className="team-analysis-panel">
              <label className="team-analysis-select">Equipe
                <select value={team?.id ?? ""} onChange={(event) => event.target.value && void selectTeam(Number(event.target.value))}>
                  <option value="">Selecione uma equipe</option>
                  {teams.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.format === "double" ? "Dupla" : "Individual"}</option>)}
                </select>
              </label>
              {team ? <TeamTypeComparison members={teamMembers} /> : <div className="type-analysis-empty">Escolha uma equipe para comparar fraquezas, resistências e imunidades.</div>}
            </div>
          ) : null}
        </section>
      </div> : null}
    </>
  );
}

function GeneralTypeChart() {
  return <div className="type-chart-scroll">
    <table className="type-chart-table">
      <thead><tr><th className="corner-cell">Ataque ↓<br />Defesa →</th>{pokemonTypes.map((type) => <th key={type} style={typeStyle(typeColors[type])}>{typeLabels[type]}</th>)}</tr></thead>
      <tbody>{pokemonTypes.map((attacking) => <tr key={attacking}>
        <th style={typeStyle(typeColors[attacking])}>{typeLabels[attacking]}</th>
        {pokemonTypes.map((defending) => { const value = getTypeEffectiveness(attacking, defending); return <td key={defending} className={effectivenessClass(value)} title={`${typeLabels[attacking]} contra ${typeLabels[defending]}: ${getMultiplierLabel(value)}`}>{value === 1 ? "" : getMultiplierLabel(value)}</td>; })}
      </tr>)}</tbody>
    </table>
    <div className="type-legend"><span className="immune">0× Sem efeito</span><span className="resisted">½× Pouco eficaz</span><span className="neutral">1× Normal</span><span className="effective">2× Super eficaz</span></div>
  </div>;
}

function TeamTypeComparison({ members }: { members: Array<{ pokemon: PokemonSummary | null; pokemonName: string }> }) {
  const summaries = pokemonTypes.map((attacking) => {
    const values = members.map((member) => getCombinedEffectiveness(attacking, member.pokemon?.types ?? []));
    return {
      attacking,
      values,
      weak: values.filter((value) => value >= 2).length,
      resist: values.filter((value) => value > 0 && value <= 0.5).length,
      immune: values.filter((value) => value === 0).length,
    };
  });

  return <div className="type-chart-scroll">
    <table className="team-type-table">
      <thead><tr><th>Tipo atacante</th>{members.map((member, index) => <th key={`${member.pokemonName}-${index}`}>{member.pokemonName}</th>)}<th>Fracos</th><th>Resistem</th><th>Imunes</th></tr></thead>
      <tbody>{summaries.map((row) => <tr key={row.attacking}>
        <th style={typeStyle(typeColors[row.attacking])}>{typeLabels[row.attacking]}</th>
        {row.values.map((value, index) => <td key={index} className={effectivenessClass(value)}>{getMultiplierLabel(value)}</td>)}
        <td className={row.weak >= 3 ? "risk-high" : ""}>{row.weak}</td><td>{row.resist}</td><td>{row.immune}</td>
      </tr>)}</tbody>
    </table>
    <div className="team-analysis-summary">
      {summaries.filter((row) => row.weak >= 3).length ? <strong>Alerta: existem tipos com três ou mais integrantes vulneráveis.</strong> : <strong>Não há fraqueza compartilhada crítica de três ou mais integrantes.</strong>}
    </div>
  </div>;
}
