import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PokemonCompatibility, PokemonSummary } from "../../shared/contracts";
import "./build-form-compatibility.css";

function titleize(value: string): string {
  return value.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function setReactInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function findLabeledInput(root: ParentNode, text: string): HTMLInputElement | null {
  return Array.from(root.querySelectorAll<HTMLLabelElement>("label")).find((label) => label.textContent?.trim().toLowerCase().startsWith(text.toLowerCase()))?.querySelector("input") ?? null;
}

function selectMoveInLegacyForm(slot: number, moveName: string): void {
  const slots = Array.from(document.querySelectorAll<HTMLElement>(".build-editor-v2 .move-slot-v2"));
  const selectedSlot = slots[slot - 1];
  const input = selectedSlot?.querySelector<HTMLInputElement>("input");
  if (!input) return;
  setReactInputValue(input, titleize(moveName));
  input.focus();
  window.setTimeout(() => {
    const buttons = selectedSlot.querySelectorAll<HTMLButtonElement>(".search-select__menu button");
    const match = Array.from(buttons).find((button) => button.textContent?.toLowerCase().includes(titleize(moveName).toLowerCase()));
    match?.click();
  }, 80);
}

export function BuildFormCompatibility() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [pokemon, setPokemon] = useState<PokemonSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compatibility, setCompatibility] = useState<PokemonCompatibility | null>(null);
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void window.gestorPoke.pokemon.list().then(setPokemon);
    const attach = () => {
      const editor = document.querySelector<HTMLElement>(".build-editor-v2");
      if (!editor) { setHost(null); return; }
      let container = editor.querySelector<HTMLElement>("[data-build-compatibility-host]");
      if (!container) {
        container = document.createElement("div");
        container.dataset.buildCompatibilityHost = "true";
        editor.prepend(container);
      }
      setHost(container);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!host) return;
    const editor = host.closest(".build-editor-v2");
    if (!editor) return;
    const inputs = Array.from(editor.querySelectorAll<HTMLInputElement>(".search-select input"));
    const pokemonInput = inputs[0];
    if (!pokemonInput) return;
    const resolve = () => {
      const value = pokemonInput.value.trim().toLowerCase();
      const match = pokemon.find((item) => [item.nickname, item.speciesName].filter(Boolean).some((name) => String(name).toLowerCase() === value));
      setSelectedId(match?.id ?? null);
    };
    resolve();
    pokemonInput.addEventListener("input", resolve);
    pokemonInput.addEventListener("change", resolve);
    return () => {
      pokemonInput.removeEventListener("input", resolve);
      pokemonInput.removeEventListener("change", resolve);
    };
  }, [host, pokemon]);

  useEffect(() => {
    if (!selectedId) { setCompatibility(null); return; }
    void window.gestorPoke.compatibility.get(selectedId).then(setCompatibility).catch(() => setCompatibility(null));
  }, [selectedId]);

  const moves = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (compatibility?.moves ?? []).filter((move) => !normalized || `${move.name} ${move.type ?? ""} ${move.category ?? ""}`.toLowerCase().includes(normalized)).slice(0, 30);
  }, [compatibility, query]);

  async function synchronize(): Promise<void> {
    if (!selectedId) return;
    setBusy(true);
    try {
      const result = await window.gestorPoke.compatibility.synchronize(selectedId);
      setCompatibility(result);
      setMessage(`Compatibilidade sincronizada para ${titleize(result.speciesName)} — forma ${titleize(result.formName)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao sincronizar compatibilidade.");
    } finally {
      setBusy(false);
    }
  }

  function applyAbility(name: string): void {
    const editor = host?.closest(".build-editor-v2");
    const input = editor ? findLabeledInput(editor, "Habilidade") : null;
    if (input) setReactInputValue(input, titleize(name));
  }

  if (!host) return null;
  return createPortal(
    <section className="build-compatibility-inline">
      <div className="build-compatibility-inline__header">
        <div>
          <span className="eyebrow">Compatibilidade integrada</span>
          <strong>{compatibility ? `${titleize(compatibility.speciesName)} · ${titleize(compatibility.formName)}` : "Selecione um Pokémon no formulário"}</strong>
          <small>{compatibility?.synchronizedAt ? `Sincronizado em ${new Date(compatibility.synchronizedAt).toLocaleString("pt-BR")}` : "Ainda não sincronizado para esta forma."}</small>
        </div>
        <button type="button" className="secondary-button" disabled={!selectedId || busy} onClick={() => void synchronize()}>{busy ? "Sincronizando..." : "Sincronizar forma"}</button>
      </div>
      {compatibility?.abilities.length ? <div className="compatibility-inline-group"><span>Habilidades permitidas</span><div>{compatibility.abilities.map((ability) => <button type="button" key={ability.id} onClick={() => applyAbility(ability.name)}>{titleize(ability.name)}{ability.hidden ? " · oculta" : ""}</button>)}</div></div> : null}
      {compatibility?.moves.length ? <div className="compatibility-inline-group"><div className="compatibility-inline-tools"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar golpes compatíveis..."/><select value={slot} onChange={(event) => setSlot(Number(event.target.value))}><option value={1}>Slot 1</option><option value={2}>Slot 2</option><option value={3}>Slot 3</option><option value={4}>Slot 4</option></select></div><div className="compatible-move-list">{moves.map((move) => <button type="button" key={move.id} onClick={() => selectMoveInLegacyForm(slot, move.name)}><strong>{titleize(move.name)}</strong><small>{titleize(move.type ?? "sem tipo")} · {titleize(move.category ?? "")}</small></button>)}</div></div> : null}
      {message ? <div className="status-message">{message}</div> : null}
    </section>,
    host,
  );
}
