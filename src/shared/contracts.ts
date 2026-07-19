import { z } from "zod";

export const statCodes = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const;
export type StatCode = (typeof statCodes)[number];
export type BattleFormat = "single" | "double" | "both";
export type StatModifier = "increased" | "decreased" | "neutral";
export type AvailabilityStatus = "confirmed" | "unavailable" | "unknown";
export type TeamRegulationKey = "open" | "pokemon-champions-active-208";
export type PokemonGender = "male" | "female" | "genderless" | "unknown";

export const moveImportSchema = z.object({ slot: z.number().int().min(1).max(4), name: z.string().trim().min(1), type: z.string().trim().optional(), pp: z.number().int().nonnegative().nullable().optional() });
const statValueSchema = z.object({ finalValue: z.number().int().nonnegative().nullable().optional(), trainingPoints: z.number().int().nonnegative().nullable().optional(), modifier: z.enum(["increased", "decreased", "neutral"]).optional() });
export const pokemonImportRecordSchema = z.object({
  species: z.object({ nationalDexNumber: z.number().int().positive().optional(), name: z.string().trim().min(1), form: z.string().trim().default("default"), types: z.array(z.string().trim().min(1)).max(2).optional() }),
  ownedPokemon: z.object({ nickname: z.string().trim().nullable().optional(), gender: z.enum(["male", "female", "genderless", "unknown"]).optional(), ownershipStatus: z.enum(["permanent", "trial", "visitor"]).default("permanent"), acquisitionSource: z.enum(["champions", "pokemon_home", "other"]).default("champions") }).default({ ownershipStatus: "permanent", acquisitionSource: "champions" }),
  build: z.object({ name: z.string().trim().min(1).default("Build principal"), format: z.enum(["single", "double", "both"]).default("both"), statAlignment: z.string().trim().nullable().optional(), ability: z.string().trim().nullable().optional(), heldItem: z.string().trim().nullable().optional(), moves: z.array(moveImportSchema).max(4).default([]), stats: z.object({ hp: statValueSchema.optional(), attack: statValueSchema.optional(), defense: statValueSchema.optional(), specialAttack: statValueSchema.optional(), specialDefense: statValueSchema.optional(), speed: statValueSchema.optional() }).optional(), notes: z.string().trim().nullable().optional() }),
});
export const pokemonImportFileSchema = z.object({ schemaVersion: z.literal(1), game: z.literal("pokemon-champions"), source: z.unknown().optional(), pokemon: z.array(pokemonImportRecordSchema).min(1) });
export type PokemonImportFile = z.infer<typeof pokemonImportFileSchema>;
export type PokemonImportRecord = z.infer<typeof pokemonImportRecordSchema>;

export type DashboardSummary = { ownedPokemon: number; builds: number; teams: number; recentPokemon: PokemonSummary[] };
export type PokemonSummary = { id: number; speciesName: string; nationalDexNumber: number | null; nickname: string | null; formName: string; types: string[]; imageUrl?: string | null; ability: string | null; statAlignment: string | null; heldItem: string | null; ownershipStatus: "permanent" | "trial" | "visitor"; acquisitionSource: "champions" | "pokemon_home" | "other"; buildCount: number; createdAt: string };
export type OwnedPokemonDetail = PokemonSummary & { gender: PokemonGender; notes: string | null; updatedAt: string; builds: BuildSummary[] };
export type UpdatePokemonInput = { nickname?: string | null; gender: PokemonGender; ownershipStatus: PokemonSummary["ownershipStatus"]; acquisitionSource: PokemonSummary["acquisitionSource"]; notes?: string | null };
export type PokedexEntry = { id: number; speciesName: string; nationalDexNumber: number | null; formName: string; types: string[]; imageUrl: string | null; ownedCount: number; buildCount: number; firstSeenAt: string };
export type CatalogStatus = { speciesCount: number; moveCount: number; abilityCount: number; itemCount: number; synchronizedAt: string | null; source: string };
export type CatalogSyncResult = CatalogStatus & { imported: number; updated: number };
export type MoveCatalogEntry = { id: number; name: string; type: string | null; category: "physical" | "special" | "status" | null; power: number | null; accuracy: number | null; pp: number | null; priority: number; target: string | null; description: string | null; availability: AvailabilityStatus };
export type AbilityCatalogEntry = { id: number; name: string; description: string | null; availability: AvailabilityStatus };
export type ItemCatalogEntry = { id: number; name: string; description: string | null; imageUrl: string | null; availability: AvailabilityStatus };
export type CompatibleAbility = AbilityCatalogEntry & { slot: number; hidden: boolean };
export type CompatibleMove = MoveCatalogEntry & { methods: string[]; versionGroups: string[] };
export type PokemonCompatibility = { ownedPokemonId: number; speciesName: string; formName: string; synchronizedAt: string | null; abilities: CompatibleAbility[]; moves: CompatibleMove[] };
export type BuildMove = { slot: 1 | 2 | 3 | 4; name: string; type: string | null; pp: number | null };
export type BuildStat = { statCode: StatCode; finalValue: number | null; trainingPoints: number | null; modifier: StatModifier };
export type BuildSummary = { id: number; ownedPokemonId: number; speciesName: string; pokemonName: string; imageUrl?: string | null; buildName: string; format: BattleFormat; ability: string | null; statAlignment: string | null; heldItem: string | null; isPrimary: boolean };
export type BuildDetail = BuildSummary & { notes: string | null; moves: BuildMove[]; stats: BuildStat[] };
export type UpsertBuildInput = { ownedPokemonId: number; name: string; format: BattleFormat; ability?: string | null; statAlignment?: string | null; heldItem?: string | null; notes?: string | null; moves: BuildMove[]; stats: BuildStat[] };
export type BuildComparison = { left: BuildDetail; right: BuildDetail; differences: Array<{ field: string; left: string; right: string }> };
export type TeamMember = BuildSummary & { position: number };
export type TeamSummary = { id: number; name: string; format: "single" | "double"; regulationKey: TeamRegulationKey; description: string | null; memberCount: number; createdAt: string };
export type TeamDetail = TeamSummary & { members: TeamMember[] };
export type UpsertTeamInput = { name: string; format: "single" | "double"; regulationKey?: TeamRegulationKey; description?: string | null; buildIds: number[] };
export type CreateTeamInput = UpsertTeamInput;
export type CreatePokemonInput = { speciesName: string; nationalDexNumber?: number | null; nickname?: string | null; formName?: string; types?: string[]; ownershipStatus: "permanent" | "trial" | "visitor"; acquisitionSource: "champions" | "pokemon_home" | "other"; buildName: string; ability?: string | null; statAlignment?: string | null; heldItem?: string | null };
export type ImportResult = { importedPokemon: number; importedBuilds: number; warnings: string[] };
export type ImportDuplicatePolicy = "create" | "ignore" | "replace" | "merge";
export type ImportResolution = { index: number; policy: ImportDuplicatePolicy; targetPokemonId?: number | null };
export type ImportPreview = { valid: boolean; count: number; errors: string[]; duplicates: Array<{ index: number; speciesName: string; nickname: string | null; existingPokemonIds: number[] }> };
export type FileOperationResult = { canceled: boolean; filePath: string | null; bytes: number; createdAt: string | null };
export type TeamValidationSeverity = "error" | "warning" | "success";
export type TeamValidationIssue = { code: string; severity: TeamValidationSeverity; message: string };
export type TeamValidationResult = { teamId: number; valid: boolean; issues: TeamValidationIssue[] };
export type OffensiveCoverageRow = { defendingType: string; superEffectiveMoveCount: number; moveNames: string[]; uncovered: boolean };
export type DoubleBattleInsight = { severity: "info" | "warning" | "success"; code: string; message: string };
export type TeamAnalysis = { teamId: number; physicalMoves: number; specialMoves: number; statusMoves: number; priorityMoves: number; coverage: OffensiveCoverageRow[]; doubleBattleInsights: DoubleBattleInsight[] };
export type BattleResult = "win" | "loss" | "draw";
export type BattleRecord = { id: number; teamId: number; teamName: string; format: "single" | "double"; opponent: string | null; result: BattleResult; selectedBuildIds: number[]; leadBuildIds: number[]; notes: string | null; playedAt: string };
export type CreateBattleInput = { teamId: number; opponent?: string | null; result: BattleResult; selectedBuildIds: number[]; leadBuildIds: number[]; notes?: string | null; playedAt?: string };
export type BattleStats = { total: number; wins: number; losses: number; draws: number; winRate: number; mostUsedTeam: string | null };

export type AppApi = {
  dashboard: { getSummary(): Promise<DashboardSummary> };
  pokemon: { list(): Promise<PokemonSummary[]>; get(id: number): Promise<OwnedPokemonDetail>; create(input: CreatePokemonInput): Promise<PokemonSummary>; update(id: number, input: UpdatePokemonInput): Promise<OwnedPokemonDetail>; remove(id: number): Promise<void> };
  pokedex: { list(): Promise<PokedexEntry[]>; status(): Promise<CatalogStatus>; synchronize(): Promise<CatalogSyncResult> };
  moves: { list(): Promise<MoveCatalogEntry[]>; synchronize(): Promise<CatalogSyncResult> };
  abilities: { list(): Promise<AbilityCatalogEntry[]>; synchronize(): Promise<CatalogSyncResult> };
  items: { list(): Promise<ItemCatalogEntry[]>; synchronize(): Promise<CatalogSyncResult> };
  compatibility: { get(ownedPokemonId: number): Promise<PokemonCompatibility>; synchronize(ownedPokemonId: number): Promise<PokemonCompatibility> };
  images: { cache(url: string): Promise<string> };
  builds: { list(): Promise<BuildSummary[]>; get(id: number): Promise<BuildDetail>; create(input: UpsertBuildInput): Promise<BuildDetail>; update(id: number, input: UpsertBuildInput): Promise<BuildDetail>; remove(id: number): Promise<void>; duplicate(id: number): Promise<BuildDetail>; setPrimary(id: number): Promise<BuildDetail>; compare(leftId: number, rightId: number): Promise<BuildComparison> };
  teams: { list(): Promise<TeamSummary[]>; get(id: number): Promise<TeamDetail>; create(input: UpsertTeamInput): Promise<TeamDetail>; update(id: number, input: UpsertTeamInput): Promise<TeamDetail>; remove(id: number): Promise<void>; validate(id: number): Promise<TeamValidationResult>; analyze(id: number): Promise<TeamAnalysis> };
  battles: { list(): Promise<BattleRecord[]>; create(input: CreateBattleInput): Promise<BattleRecord>; remove(id: number): Promise<void>; stats(): Promise<BattleStats> };
  imports: { validate(jsonText: string): Promise<{ valid: boolean; errors: string[]; count: number }>; preview(jsonText: string): Promise<ImportPreview>; execute(jsonText: string): Promise<ImportResult>; executeResolved(jsonText: string, resolutions: ImportResolution[]): Promise<ImportResult> };
  data: { backup(): Promise<FileOperationResult>; restore(): Promise<FileOperationResult>; exportJson(): Promise<FileOperationResult> };
};
