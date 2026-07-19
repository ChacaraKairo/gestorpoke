import { useEffect, useMemo, useState } from "react";
import type { TeamDetail, TeamRegulationKey, TeamSummary } from "../../shared/contracts";
import {
  isPokemonChampionsActiveSpecies,
  POKEMON_CHAMPIONS_REGULATION_KEY,
  pokemonChampionsActiveSpecies,
} from "../../shared/champions-roster";
import "./team-regulation.css";

function regulationLabel(value: TeamRegulationKey): string {
  return value === POKEMON_CHAMPIONS_REGULATION_KEY ? "Pokémon Champions" : "Modo aberto";
}

export function TeamRegulationOverlay() {
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selected, setSelected] = useState<TeamDetail | null>(null);
  const [regulationKey, setRegulationKey] = useState<TeamRegulationKey>("open");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshTeams(): Promise<void> {
    const rows = await window.gestorPoke.teams.list();
    setTeams(rows);
  }

  useEffect(() => {
    if (!open) return;
    void refreshTeams();
  }, [open]);

  async function selectTeam(id: number): Promise<void> {
    setBusy(true);
    try {
      const detail = await window.gestorPoke.teams.get(id);
      setSelected(detail);
      setRegulationKey(detail.regulationKey);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  const blockedMembers = useMemo(() => {
    if (!selected || regulationKey !== POKEMON_CHAMPIONS_REGULATION_KEY) return [];
    return selected.members.filter((member) => !isPokemonChampionsActiveSpecies(member.speciesName));
  }, [selected, regulationKey]);

  async function save(): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      const updated = await window.gestorPoke.teams.update(selected.id, {
        name: selected.name,
        format: selected.format,
        regulationKey,
        description: selected.description,
        buildIds: selected.members.map((member) => member.id),
      });
      setSelected(updated);
      await refreshTeams();
      setMessage(`Regulamentação alterada para ${regulationLabel(updated.regulationKey)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a regulamentação.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className="team-regulation-trigger" type="button" onClick={() => setOpen(true)}><span>⬡</span> Regras Champions</button>
    {open ? <div className="team-regulation-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="team-regulation-modal" role="dialog" aria-modal="true" aria-label="Regulamentação das equipes" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span className="eyebrow">Regulamentações</span><h1>Pokémon Champions</h1><p>Limite equipes às {pokemonChampionsActiveSpecies.length} espécies ativas informadas.</p></div><button className="danger-button" type="button" onClick={() => setOpen(false)}>Fechar</button></header>
        <div className="team-regulation-layout">
          <aside>
            <h2>Equipes</h2>
            {teams.map((team) => <button type="button" className={selected?.id === team.id ? "active" : ""} key={team.id} onClick={() => void selectTeam(team.id)}><strong>{team.name}</strong><small>{team.format === "double" ? "Dupla" : "Individual"} · {team.memberCount}/6</small><em>{regulationLabel(team.regulationKey)}</em></button>)}
            {!teams.length ? <p>Nenhuma equipe cadastrada.</p> : null}
          </aside>
          <main>
            {!selected ? <div className="team-regulation-empty">Selecione uma equipe para definir a regulamentação.</div> : <>
              <div className="regulation-choice">
                <button type="button" className={regulationKey === "open" ? "active" : ""} onClick={() => setRegulationKey("open")}><strong>Modo aberto</strong><span>Permite qualquer espécie cadastrada.</span></button>
                <button type="button" className={regulationKey === POKEMON_CHAMPIONS_REGULATION_KEY ? "active champions" : "champions"} onClick={() => setRegulationKey(POKEMON_CHAMPIONS_REGULATION_KEY)}><strong>Pokémon Champions</strong><span>Somente {pokemonChampionsActiveSpecies.length} espécies ativas.</span></button>
              </div>
              <div className="regulation-members">
                {selected.members.map((member) => {
                  const allowed = isPokemonChampionsActiveSpecies(member.speciesName);
                  return <article className={regulationKey === POKEMON_CHAMPIONS_REGULATION_KEY && !allowed ? "blocked" : "allowed"} key={member.id}><img src={member.imageUrl ?? ""} alt="" /><span><strong>{member.pokemonName}</strong><small>{member.buildName}</small></span><em>{allowed ? "Ativo no Champions" : "Fora da lista"}</em></article>;
                })}
              </div>
              {blockedMembers.length ? <div className="regulation-warning">Não é possível ativar o modo Champions: {blockedMembers.map((member) => member.speciesName).join(", ")} não pertence à lista ativa.</div> : null}
              {message ? <div className="status-message">{message}</div> : null}
              <div className="form-actions"><button className="primary-button" type="button" disabled={busy || blockedMembers.length > 0} onClick={() => void save()}>{busy ? "Salvando..." : "Salvar regulamentação"}</button></div>
            </>}
          </main>
        </div>
      </section>
    </div> : null}
  </>;
}
