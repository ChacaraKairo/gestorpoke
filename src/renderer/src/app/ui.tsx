import { useEffect, useMemo, useState } from "react";
import { statCodes } from "../../../shared/contracts";
import type { DashboardSummary, PokemonSummary, StatCode, UpsertBuildInput } from "../../../shared/contracts";

export type Page = "home" | "pokedex" | "pokemon" | "builds" | "teams" | "moves" | "import" | "settings";

export const emptyDashboard: DashboardSummary = { ownedPokemon: 0, builds: 0, teams: 0, recentPokemon: [] };
export const statLabels: Record<StatCode, string> = {
  hp: "HP",
  attack: "Ataque",
  defense: "Defesa",
  specialAttack: "Ataque especial",
  specialDefense: "Defesa especial",
  speed: "Velocidade",
};
export const alignments = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Docile", "Bold", "Relaxed", "Impish", "Lax",
  "Serious", "Timid", "Hasty", "Jolly", "Naive", "Bashful", "Modest", "Mild", "Quiet", "Rash",
  "Quirky", "Calm", "Gentle", "Sassy", "Careful",
];

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}

export function artworkUrl(number: number | null | undefined): string | null {
  return number == null ? null : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${number}.png`;
}

export function titleize(value: string): string {
  return value.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

export type SearchOption = { id: number | string; label: string; subtitle?: string; imageUrl?: string | null };

export function SearchSelect({ label, options, value, onChange, placeholder }: {
  label: string;
  options: SearchOption[];
  value: number | string | null;
  onChange: (value: number | string, option: SearchOption) => void;
  placeholder: string;
}) {
  const selected = options.find((option) => String(option.id) === String(value));
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => setQuery(selected?.label ?? ""), [selected?.label]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || selected?.label === query) return options.slice(0, 80);
    return options.filter((option) => `${option.label} ${option.subtitle ?? ""}`.toLowerCase().includes(normalized)).slice(0, 80);
  }, [options, query, selected?.label]);

  useEffect(() => setActiveIndex(0), [query]);

  function choose(option: SearchOption): void {
    onChange(option.id, option);
    setQuery(option.label);
    setOpen(false);
  }

  return <label className="search-select">
    <span>{label}</span>
    <input
      value={query}
      placeholder={placeholder}
      role="combobox"
      aria-expanded={open}
      aria-autocomplete="list"
      onFocus={() => setOpen(true)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
        if (event.key === "Enter" && open && filtered[activeIndex]) { event.preventDefault(); choose(filtered[activeIndex]); }
        if (event.key === "Escape") setOpen(false);
      }}
    />
    {open ? <div className="search-select__menu" role="listbox">
      {filtered.length ? filtered.map((option, index) => <button
        type="button"
        role="option"
        aria-selected={index === activeIndex}
        className={index === activeIndex ? "active" : ""}
        key={option.id}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(option)}
      >
        {option.imageUrl ? <img src={option.imageUrl} alt="" loading="lazy" /> : <span className="option-dot" />}
        <span><strong>{option.label}</strong><small>{option.subtitle}</small></span>
      </button>) : <div className="search-select__empty">Nenhum resultado.</div>}
    </div> : null}
  </label>;
}

export function PokemonImage({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <div className="pokemon-image-fallback">?</div>;
  return <img className="pokemon-image" src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />;
}

export function PokemonCard({ pokemon, onOpen, onRemove }: { pokemon: PokemonSummary; onOpen: () => void; onRemove?: () => void }) {
  const name = pokemon.nickname || pokemon.speciesName;
  return <article className="pokemon-card-v2" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()}>
    <PokemonImage src={pokemon.imageUrl ?? artworkUrl(pokemon.nationalDexNumber)} name={name} />
    <div className="pokemon-card-v2__content">
      <span className="eyebrow">#{String(pokemon.nationalDexNumber ?? 0).padStart(4, "0")} · {pokemon.speciesName}</span>
      <h3>{name}</h3>
      <div className="badge-row">{pokemon.types.map((type) => <span className="type-badge" key={type}>{titleize(type)}</span>)}</div>
      <dl className="mini-data"><div><dt>Builds</dt><dd>{pokemon.buildCount}</dd></div><div><dt>Habilidade</dt><dd>{pokemon.ability || "Não definida"}</dd></div><div><dt>Item</dt><dd>{pokemon.heldItem || "Nenhum"}</dd></div></dl>
    </div>
    {onRemove ? <button className="danger-button card-delete" type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }}>Excluir</button> : null}
  </article>;
}

export function emptyBuild(pokemonId = 0): UpsertBuildInput {
  return {
    ownedPokemonId: pokemonId,
    name: "Nova build",
    format: "both",
    ability: null,
    statAlignment: null,
    heldItem: null,
    notes: null,
    moves: [],
    stats: statCodes.map((statCode) => ({ statCode, finalValue: null, trainingPoints: null, modifier: "neutral" })),
  };
}
