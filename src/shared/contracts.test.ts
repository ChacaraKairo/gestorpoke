import { describe, expect, it } from "vitest";
import { pokemonImportFileSchema } from "./contracts";

describe("pokemonImportFileSchema", () => {
  it("aceita um arquivo válido com vários Pokémon", () => {
    const result = pokemonImportFileSchema.safeParse({
      schemaVersion: 1,
      game: "pokemon-champions",
      pokemon: [
        {
          species: { nationalDexNumber: 604, name: "Eelektross", form: "default" },
          ownedPokemon: { ownershipStatus: "permanent", acquisitionSource: "champions" },
          build: {
            name: "Principal",
            format: "both",
            moves: [
              { slot: 1, name: "Supercell Slam" },
              { slot: 2, name: "Superpower" },
            ],
          },
        },
        {
          species: { nationalDexNumber: 25, name: "Pikachu", form: "default" },
          ownedPokemon: { ownershipStatus: "visitor", acquisitionSource: "pokemon_home" },
          build: { name: "Teste", format: "single", moves: [] },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pokemon).toHaveLength(2);
  });

  it("rejeita slots de movimento fora do intervalo", () => {
    const result = pokemonImportFileSchema.safeParse({
      schemaVersion: 1,
      game: "pokemon-champions",
      pokemon: [
        {
          species: { name: "Eelektross" },
          ownedPokemon: { ownershipStatus: "permanent", acquisitionSource: "champions" },
          build: { name: "Inválida", moves: [{ slot: 5, name: "Volt Switch" }] },
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
