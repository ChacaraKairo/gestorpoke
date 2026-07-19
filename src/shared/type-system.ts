export const pokemonTypes = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;

export type PokemonType = (typeof pokemonTypes)[number];
export type TypeMultiplier = 0 | 0.25 | 0.5 | 1 | 2 | 4;

export const typeLabels: Record<PokemonType, string> = {
  normal: "Normal", fire: "Fogo", water: "Água", electric: "Elétrico", grass: "Grama", ice: "Gelo",
  fighting: "Lutador", poison: "Venenoso", ground: "Terra", flying: "Voador", psychic: "Psíquico",
  bug: "Inseto", rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio", steel: "Aço", fairy: "Fada",
};

export const typeColors: Record<PokemonType, string> = {
  normal: "#9FA19F", fire: "#E62829", water: "#2980EF", electric: "#FAC000", grass: "#3FA129",
  ice: "#3DCEF3", fighting: "#FF8000", poison: "#9141CB", ground: "#915121", flying: "#81B9EF",
  psychic: "#EF4179", bug: "#91A119", rock: "#AFA981", ghost: "#704170", dragon: "#5060E1",
  dark: "#50413F", steel: "#60A1B8", fairy: "#EF70EF",
};

const chart: Record<PokemonType, Partial<Record<PokemonType, TypeMultiplier>>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

export function normalizeType(value: string | null | undefined): PokemonType | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const aliases: Record<string, PokemonType> = {
    normal: "normal", fire: "fire", fogo: "fire", water: "water", agua: "water", electric: "electric", eletrico: "electric",
    grass: "grass", grama: "grass", ice: "ice", gelo: "ice", fighting: "fighting", lutador: "fighting", combate: "fighting",
    poison: "poison", venenoso: "poison", toxico: "poison", ground: "ground", terra: "ground", chao: "ground", flying: "flying",
    voador: "flying", voo: "flying", psychic: "psychic", psiquico: "psychic", bug: "bug", inseto: "bug", rock: "rock", pedra: "rock",
    ghost: "ghost", fantasma: "ghost", dragon: "dragon", dragao: "dragon", dark: "dark", sombrio: "dark", escuro: "dark",
    steel: "steel", aco: "steel", fairy: "fairy", fada: "fairy",
  };
  return aliases[normalized] ?? null;
}

export function getTypeEffectiveness(attacking: PokemonType, defending: PokemonType): TypeMultiplier {
  return chart[attacking][defending] ?? 1;
}

export function getCombinedEffectiveness(attacking: PokemonType, defendingTypes: readonly string[]): TypeMultiplier {
  const multiplier = defendingTypes.reduce<number>((value, type) => {
    const normalized = normalizeType(type);
    return normalized ? value * getTypeEffectiveness(attacking, normalized) : value;
  }, 1);
  return multiplier as TypeMultiplier;
}

export function getMultiplierLabel(value: TypeMultiplier): string {
  if (value === 0) return "0×";
  if (value === 0.25) return "¼×";
  if (value === 0.5) return "½×";
  if (value === 2) return "2×";
  if (value === 4) return "4×";
  return "1×";
}

const typedAbilityRules: Array<[RegExp, PokemonType]> = [
  [/blaze|flash fire|flame body|drought|solar power|desolate land/i, "fire"],
  [/torrent|water absorb|storm drain|drizzle|swift swim|primordial sea/i, "water"],
  [/overgrow|chlorophyll|grassy surge|effect spore|harvest/i, "grass"],
  [/static|lightning rod|motor drive|volt absorb|electric surge|transistor/i, "electric"],
  [/levitate|gale wings|aerilate|delta stream/i, "flying"],
  [/swarm|compound eyes|tinted lens/i, "bug"],
  [/poison point|poison touch|corrosion|toxic boost/i, "poison"],
  [/sand stream|sand force|sand rush|earth eater/i, "ground"],
  [/snow warning|ice body|slush rush|refrigerate/i, "ice"],
  [/psychic surge|telepathy|synchronize/i, "psychic"],
  [/rock head|solid rock|rocky payload/i, "rock"],
  [/cursed body|shadow shield|perish body/i, "ghost"],
  [/dragon.?s maw|multiscale/i, "dragon"],
  [/dark aura|prankster|super luck/i, "dark"],
  [/steelworker|steely spirit|light metal|heavy metal/i, "steel"],
  [/fairy aura|pixilate|misty surge/i, "fairy"],
  [/scrappy|iron fist|justified|guts/i, "fighting"],
];

export function inferAbilityType(ability: string | null | undefined): PokemonType | null {
  if (!ability) return null;
  return typedAbilityRules.find(([pattern]) => pattern.test(ability))?.[1] ?? null;
}
