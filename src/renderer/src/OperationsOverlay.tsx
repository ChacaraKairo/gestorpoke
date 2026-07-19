import { useEffect, useState } from "react";
import type { FileOperationResult, TeamSummary, TeamValidationResult } from "../../shared/contracts";
import "./operations.css";

function formatBytes(bytes:number):string { if(bytes<1024) return `${bytes} B`; if(bytes<1024*1024) return `${(bytes/1024).toFixed(1)} KB`; return `${(bytes/1024/1024).toFixed(1)} MB`; }

export function OperationsOverlay() {
  const [open,setOpen]=useState(false);
  const [teams,setTeams]=useState<TeamSummary[]>([]);
  const [selectedTeamId,setSelectedTeamId]=useState<number|null>(null);
  const [validation,setValidation]=useState<TeamValidationResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);

  useEffect(()=>{ if(!open) return; void window.gestorPoke.teams.list().then(setTeams); },[open]);

  async function validateTeam(id:number):Promise<void>{ setSelectedTeamId(id); setBusy(true); try{ setValidation(await window.gestorPoke.teams.validate(id)); setMessage(null); }catch(error){ setMessage(error instanceof Error?error.message:"Falha ao validar a equipe."); }finally{ setBusy(false); } }
  async function runFileOperation(operation:()=>Promise<FileOperationResult>,label:string):Promise<void>{ setBusy(true); try{ const result=await operation(); if(result.canceled){ setMessage("Operação cancelada."); return; } setMessage(`${label} criado com sucesso: ${result.filePath} (${formatBytes(result.bytes)}).`); }catch(error){ setMessage(error instanceof Error?error.message:"Falha na operação."); }finally{ setBusy(false); } }

  return <>
    <button className="operations-trigger" type="button" onClick={()=>setOpen(true)}>▣ Dados e validação</button>
    {open?<div className="operations-backdrop" onMouseDown={()=>setOpen(false)}>
      <section className="operations-modal" role="dialog" aria-modal="true" aria-label="Central de dados e validação" onMouseDown={(event)=>event.stopPropagation()}>
        <header><div><span className="eyebrow">Segurança e qualidade</span><h1>Central de operações</h1><p>Proteja seus dados e verifique equipes antes de usar no Pokémon Champions.</p></div><button className="danger-button" onClick={()=>setOpen(false)}>Fechar</button></header>
        <div className="operations-grid">
          <article className="operations-card"><h2>Backup do banco</h2><p>Cria uma cópia consistente do SQLite, incluindo dados em modo WAL.</p><button className="primary-button" disabled={busy} onClick={()=>void runFileOperation(()=>window.gestorPoke.data.backup(),"Backup")}>Criar backup</button></article>
          <article className="operations-card"><h2>Exportação completa</h2><p>Exporta Pokémon, builds, equipes e estado dos catálogos para JSON legível.</p><button className="secondary-button" disabled={busy} onClick={()=>void runFileOperation(()=>window.gestorPoke.data.exportJson(),"Exportação")}>Exportar JSON</button></article>
        </div>
        <section className="team-validation-section">
          <div className="section-heading"><div><span className="eyebrow">Validação competitiva</span><h2>Equipes</h2></div></div>
          <div className="validation-layout">
            <aside>{teams.length?teams.map((team)=><button key={team.id} className={selectedTeamId===team.id?"active":""} onClick={()=>void validateTeam(team.id)}><strong>{team.name}</strong><small>{team.format==="double"?"Dupla":"Individual"} · {team.memberCount}/6</small><em>{team.regulationKey==="pokemon-champions-active-208"?"Champions":"Aberta"}</em></button>):<div className="empty-state">Nenhuma equipe cadastrada.</div>}</aside>
            <div className="validation-results">{busy?<div className="loading-panel">Analisando...</div>:validation?<><div className={`validation-summary ${validation.valid?"valid":"invalid"}`}><strong>{validation.valid?"Equipe sem erros críticos":"Equipe possui erros críticos"}</strong></div>{validation.issues.map((issue)=><div key={issue.code} className={`validation-issue ${issue.severity}`}><span>{issue.severity==="success"?"✓":issue.severity==="warning"?"⚠":"✕"}</span><p>{issue.message}</p></div>)}</>:<div className="empty-state">Selecione uma equipe para verificar formato, espécies, itens, golpes e regulamentação.</div>}</div>
          </div>
        </section>
        {message?<div className="status-message">{message}</div>:null}
      </section>
    </div>:null}
  </>;
}
