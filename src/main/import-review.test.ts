import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPokemon: vi.fn(),
  executeImport: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("./database", () => mocks);

import { previewImport } from "./import-review";

function importJson(species: string, nickname: string | null = null): string {
  return JSON.stringify({
    schemaVersion: 1,
    game: "pokemon-champions",
    pokemon: [{
      species: { name: species, form: "default" },
      ownedPokemon: { nickname, ownershipStatus: "permanent", acquisitionSource: "champions" },
      build: { name: "Build principal", format: "both", moves: [] },
    }],
  });
}

describe("previewImport", () => {
  beforeEach(() => mocks.listPokemon.mockReset());

  it("detects species and nickname duplicates", () => {
    mocks.listPokemon.mockReturnValue([{ id: 7, speciesName: "Pikachu", nickname: "Spark" }]);
    const result = previewImport(importJson("pikachu", "spark"));
    expect(result.valid).toBe(true);
    expect(result.duplicates).toEqual([{ index: 0, speciesName: "pikachu", nickname: "spark", existingPokemonIds: [7] }]);
  });

  it("does not mark a different nickname as duplicate", () => {
    mocks.listPokemon.mockReturnValue([{ id: 7, speciesName: "Pikachu", nickname: "Spark" }]);
    expect(previewImport(importJson("pikachu", "Volt")).duplicates).toHaveLength(0);
  });

  it("returns schema errors without throwing", () => {
    mocks.listPokemon.mockReturnValue([]);
    const result = previewImport(JSON.stringify({ schemaVersion: 2 }));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
