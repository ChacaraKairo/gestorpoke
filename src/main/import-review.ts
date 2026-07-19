import { pokemonImportFileSchema, type ImportPreview } from "../shared/contracts";
import { listPokemon } from "./database";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function previewImport(jsonText: string): ImportPreview {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    const result = pokemonImportFileSchema.safeParse(parsed);
    if (!result.success) {
      return {
        valid: false,
        count: 0,
        duplicates: [],
        errors: result.error.issues.map((issue) => `${issue.path.join(".") || "arquivo"}: ${issue.message}`),
      };
    }
    const existing = listPokemon();
    const duplicates = result.data.pokemon.flatMap((record, index) => {
      const species = normalize(record.species.name);
      const nickname = normalize(record.ownedPokemon.nickname);
      const matches = existing.filter((pokemon) => normalize(pokemon.speciesName) === species && (!nickname || normalize(pokemon.nickname) === nickname));
      return matches.length ? [{
        index,
        speciesName: record.species.name,
        nickname: record.ownedPokemon.nickname ?? null,
        existingPokemonIds: matches.map((pokemon) => pokemon.id),
      }] : [];
    });
    return { valid: true, count: result.data.pokemon.length, errors: [], duplicates };
  } catch (error) {
    return { valid: false, count: 0, duplicates: [], errors: [error instanceof Error ? error.message : "JSON inválido."] };
  }
}