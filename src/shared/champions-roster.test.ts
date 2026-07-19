import { describe, expect, it } from "vitest";
import {
  isPokemonChampionsActiveSpecies,
  normalizeSpeciesName,
  pokemonChampionsActiveSpecies,
} from "./champions-roster";

describe("Pokémon Champions active roster", () => {
  it("contains exactly 208 unique species", () => {
    expect(pokemonChampionsActiveSpecies).toHaveLength(208);
    expect(new Set(pokemonChampionsActiveSpecies).size).toBe(208);
  });

  it("accepts species from the provided roster", () => {
    expect(isPokemonChampionsActiveSpecies("Metagross")).toBe(true);
    expect(isPokemonChampionsActiveSpecies("Mr. Rime")).toBe(true);
    expect(isPokemonChampionsActiveSpecies("Kommo-o")).toBe(true);
  });

  it("blocks species outside the provided roster", () => {
    expect(isPokemonChampionsActiveSpecies("Mewtwo")).toBe(false);
    expect(isPokemonChampionsActiveSpecies("Rayquaza")).toBe(false);
  });

  it("normalizes punctuation and spaces consistently", () => {
    expect(normalizeSpeciesName("Mr. Rime")).toBe("mr-rime");
    expect(normalizeSpeciesName("  Mr.’ Rime  ")).toBe("mr-rime");
  });
});
