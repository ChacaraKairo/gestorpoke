import { z } from "zod";

export const statCodes = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
] as const;

export type StatCode = (typeof statCodes)[number];

export const moveImportSchema = z.object({
  slot: z.number().int().min(1).max(4),
  name: z.string().trim().min(1),
  type: z.string().trim().optional(),
  pp: z.number().int().nonnegative().nullable().optional(),
});

const statValueSchema = z.object({
  finalValue: z.number().int().nonnegative().nullable().optional(),
  trainingPoints: z.number().int().nonnegative().nullable().optional(),
  modifier: z.enum(["increased", "decreased", "neutral"]).optional(),
});

export const pokemonImportRecordSchema = z.object({
  species: z.object({
    nationalDexNumber: z.number().int().positive().optional(),
    name: z.string().trim().min(1),
    form: z.string().trim().default("default"),
    types: z.array(z.string().trim().min(1)).max(2).optional(),
  }),
  ownedPokemon: z
    .object({
      nickname: z.string().trim().nullable().optional(),
      gender: z.enum(["male", "female", "genderless", "unknown"]).optional(),
      ownershipStatus: z.enum(["permanent", "trial", "visitor"]).default("permanent"),
      acquisitionSource: z.enum(["champions", "pokemon_home", "other"]).default("champions"),
    })
    .default({ ownershipStatus: "permanent", acquisitionSource: "champions" }),
  build: z.object({
    name: z.string().trim().min(1).default("Build principal"),
    format: z.enum(["single", "double", "both"]).default("both"),
    statAlignment: z.string().trim().nullable().optional(),
    ability: z.string().trim().nullable().optional(),
    heldItem: z.string().trim().nullable().optional(),
    moves: z.array(moveImportSchema).max(4).default([]),
    stats: z
      .object({
        hp: statValueSchema.optional(),
        attack: statValueSchema.optional(),
        defense: statValueSchema.optional(),
        specialAttack: statValueSchema.optional(),
        specialDefense: statValueSchema.optional(),
        speed: statValueSchema.optional(),
      })
      .optional(),
    notes: z.string().trim().nullable().optional(),
  }),
});

export const pokemonImportFileSchema = z.object({
  schemaVersion: z.literal(1),
  game: z.literal("pokemon-champions"),
  source: z.unknown().optional(),
  pokemon: z.array(pokemonImportRecordSchema).min(1),
});

export type PokemonImportFile = z.infer<typeof pokemonImportFileSchema>;
export type PokemonImportRecord = z.infer<typeof pokemonImportRecordSchema>;

export type DashboardSummary = {
  ownedPokemon: number;
  builds: number;
  teams: number;
  recentPokemon: PokemonSummary[];
};

export type PokemonSummary = {
  id: number;
  speciesName: string;
  nationalDexNumber: number | null;
  nickname: string | null;
  formName: string;
  types: string[];
  ability: string | null;
  statAlignment: string | null;
  heldItem: string | null;
  ownershipStatus: "permanent" | "trial" | "visitor";
  acquisitionSource: "champions" | "pokemon_home" | "other";
  buildCount: number;
  createdAt: string;
};

export type PokedexEntry = {
  id: number;
  speciesName: string;
  nationalDexNumber: number | null;
  formName: string;
  types: string[];
  ownedCount: number;
  buildCount: number;
  firstSeenAt: string;
};

export type BuildSummary = {
  id: number;
  ownedPokemonId: number;
  speciesName: string;
  pokemonName: string;
  buildName: string;
  format: "single" | "double" | "both";
  ability: string | null;
  statAlignment: string | null;
  heldItem: string | null;
};

export type TeamSummary = {
  id: number;
  name: string;
  format: "single" | "double";
  description: string | null;
  memberCount: number;
  createdAt: string;
};

export type CreatePokemonInput = {
  speciesName: string;
  nationalDexNumber?: number | null;
  nickname?: string | null;
  formName?: string;
  types?: string[];
  ownershipStatus: "permanent" | "trial" | "visitor";
  acquisitionSource: "champions" | "pokemon_home" | "other";
  buildName: string;
  ability?: string | null;
  statAlignment?: string | null;
  heldItem?: string | null;
};

export type CreateTeamInput = {
  name: string;
  format: "single" | "double";
  description?: string | null;
  buildIds: number[];
};

export type ImportResult = {
  importedPokemon: number;
  importedBuilds: number;
  warnings: string[];
};

export type AppApi = {
  dashboard: {
    getSummary(): Promise<DashboardSummary>;
  };
  pokemon: {
    list(): Promise<PokemonSummary[]>;
    create(input: CreatePokemonInput): Promise<PokemonSummary>;
    remove(id: number): Promise<void>;
  };
  pokedex: {
    list(): Promise<PokedexEntry[]>;
  };
  builds: {
    list(): Promise<BuildSummary[]>;
  };
  teams: {
    list(): Promise<TeamSummary[]>;
    create(input: CreateTeamInput): Promise<TeamSummary>;
  };
  imports: {
    validate(jsonText: string): Promise<{ valid: boolean; errors: string[]; count: number }>;
    execute(jsonText: string): Promise<ImportResult>;
  };
};
