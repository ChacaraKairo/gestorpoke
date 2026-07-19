import { describe, expect, it } from "vitest";
import { resolvePokemonApiIdentifiers } from "./pokemon-form";

describe("resolvePokemonApiIdentifiers", () => {
  it("prefers the exact named form before the national dex fallback", () => {
    expect(resolvePokemonApiIdentifiers("Rotom", "heat", 479)).toEqual(["rotom-heat", 479, "rotom"]);
  });

  it("keeps already qualified form identifiers", () => {
    expect(resolvePokemonApiIdentifiers("Tauros", "tauros-paldea-combat-breed", 128)).toEqual([
      "tauros-paldea-combat-breed",
      128,
      "tauros",
    ]);
  });

  it("uses the dex number and species for default forms", () => {
    expect(resolvePokemonApiIdentifiers("Mr. Rime", "default", 866)).toEqual([866, "mr-rime"]);
  });

  it("normalizes spaces, punctuation and underscores", () => {
    expect(resolvePokemonApiIdentifiers("Farfetch'd", "Galar Form", 83)).toEqual([
      "farfetchd-galar-form",
      83,
      "farfetchd",
    ]);
  });
});
