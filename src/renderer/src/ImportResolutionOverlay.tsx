import { useMemo, useState } from "react";
import type { ImportPreview, ImportResolution } from "../../shared/contracts";
import "./import-resolution.css";

export function ImportResolutionOverlay() {
  const [open,setOpen]=useState(false);
  const [jsonText,setJsonText]=useState("");
  const [fileName,setFileName]=useState<string|null>(null);
  const [preview,setPreview]=useState<ImportPreview|null>(null);
  const [resolutions,setResolutions]=useState<Record<number,ImportResolution>>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);

  const duplicates=useMemo(()=>preview?.duplicates??[],[preview]);

  async function loadFile(file:File):Promise<void>{
    const text=await file.text();
    setJsonText(text); setFileName(file.name); setPreview(null); setResolutions({}); setMessage(null);
    setBusy(true);
    try{
      const result=await window.gestorPoke.imports.preview(text);
      setPreview(result);
      const initial:Record<number,ImportResolution>={};
      result.duplicates.forEach((duplicate)=>{ initial[duplicate.index]={index:duplicate.index,policy:"ignore",targetPokemonId:duplicate.existingPokemonIds[0]??null}; });
      setResolutions(initial);
    }catch(error){ setMessage(error instanceof Error?error.message:"Falha ao revisar o arquivo."); }
    finally{ setBusy(false); }
  }

  function updateResolution(index:number,patch:Partial<ImportResolution>):void{
    setResolutions((current)=>({ ...current,[index]:{ index,policy:current[index]?.policy??"ignore",targetPokemonId:current[index]?.targetPokemonId??null,...patch } }));
  }

  async function execute():Promise<void>{
    if(!preview?.valid) return;
    setBusy(true);
    try{
      const result=await window.gestorPoke.imports.executeResolved(jsonText,Object.values(resolutions));
      setMessage(`Importação concluída: ${result.importedPokemon} Pokémon e ${result.importedBuilds} builds. ${result.warnings.length?`${result.warnings.length} aviso(s).`:""}`);
    }catch(error){ setMessage(error instanceof Error?error.message:"Falha ao executar a importação."); }
    finally{ setBusy(false); }
  }

  return <>
    <button className="import-resolution-trigger" type="button" onClick={()=>setOpen(true)}>⇄ Revisar importação</button>
    {open?<div className="import-resolution-backdrop" onMouseDown={()=>setOpen(false)}>
      <section className="import-resolution-modal" role="dialog" aria-modal="true" aria-label="Revisar importação" onMouseDown={(event)=>event.stopPropagation()}>
        <header><div><span className="eyebrow">Importação segura</span><h1>Resolver duplicidades</h1><p>Escolha criar, ignorar, substituir ou mesclar cada registro duplicado.</p></div><button className="danger-button" onClick={()=>setOpen(false)}>Fechar</button></header>
        <label className="import-file-picker">Arquivo JSON<input type="file" accept="application/json,.json" onChange={(event)=>{ const file=event.target.files?.[0]; if(file) void loadFile(file); }}/><span>{fileName??"Nenhum arquivo selecionado"}</span></label>
        {busy?<div className="loading-panel">Processando...</div>:null}
        {preview&&!preview.valid?<div className="error-message">{preview.errors.join(" · ")}</div>:null}
        {preview?.valid?<>
          <div className="import-preview-summary"><strong>{preview.count} registros válidos</strong><span>{duplicates.length} duplicidade(s) encontrada(s)</span></div>
          <div className="duplicate-resolution-list">{duplicates.length?duplicates.map((duplicate)=>{
            const resolution=resolutions[duplicate.index]??{index:duplicate.index,policy:"ignore" as const,targetPokemonId:duplicate.existingPokemonIds[0]??null};
            return <article key={duplicate.index}><div><strong>{duplicate.speciesName}</strong><small>{duplicate.nickname||"Sem apelido"} · registro #{duplicate.index+1}</small></div><label>Política<select value={resolution.policy} onChange={(event)=>updateResolution(duplicate.index,{policy:event.target.value as ImportResolution["policy"]})}><option value="ignore">Ignorar importado</option><option value="create">Criar outro exemplar</option><option value="merge">Mesclar build no existente</option><option value="replace">Substituir existente</option></select></label>{resolution.policy==="merge"||resolution.policy==="replace"?<label>Destino<select value={resolution.targetPokemonId??""} onChange={(event)=>updateResolution(duplicate.index,{targetPokemonId:Number(event.target.value)})}>{duplicate.existingPokemonIds.map((id)=><option key={id} value={id}>Pokémon #{id}</option>)}</select></label>:null}</article>;
          }):<div className="empty-state">Nenhuma duplicidade. Todos os registros serão criados normalmente.</div>}</div>
          <div className="form-actions"><button className="primary-button" disabled={busy} onClick={()=>void execute()}>Confirmar importação</button></div>
        </>:null}
        {message?<div className="status-message">{message}</div>:null}
      </section>
    </div>:null}
  </>;
}
