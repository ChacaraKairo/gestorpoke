import type { DoubleBattleInsight, OffensiveCoverageRow, TeamAnalysis } from "../shared/contracts";
import { getTypeEffectiveness, pokemonTypes, typeLabels, type PokemonType } from "../shared/type-system";
import { getDatabase } from "./database";
import { getTeam } from "./teams";

type MoveRow = {
  build_id: number;
  pokemon_name: string;
  move_name: string;
  type: string | null;
  category: "physical" | "special" | "status" | null;
  priority: number | null;
  target: string | null;
};

function titleize(value: string): string {
  return value.split("-").map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join(" ");
}

export function analyzeTeam(id: number): TeamAnalysis {
  const team = getTeam(id);
  const rows = getDatabase().prepare(`
    SELECT bm.build_id, COALESCE(op.nickname, s.name) AS pokemon_name,
           bm.name AS move_name, COALESCE(cm.type, bm.type) AS type,
           cm.category, cm.priority, cm.target
    FROM team_members tm
    JOIN builds b ON b.id = tm.build_id
    JOIN owned_pokemon op ON op.id = b.owned_pokemon_id
    JOIN species s ON s.id = op.species_id
    JOIN build_moves bm ON bm.build_id = b.id
    LEFT JOIN catalog_moves cm ON cm.name = bm.name COLLATE NOCASE
    WHERE tm.team_id = ?
    ORDER BY tm.position, bm.slot
  `).all(id) as MoveRow[];

  const attacking = rows.filter((move) => move.category !== "status" && move.type);
  const coverage: OffensiveCoverageRow[] = pokemonTypes.map((defendingType) => {
    const effective = attacking.filter((move) => {
      const type = move.type?.toLowerCase() as PokemonType | undefined;
      return type && pokemonTypes.includes(type) && getTypeEffectiveness(type, defendingType) >= 2;
    });
    return {
      defendingType: typeLabels[defendingType],
      superEffectiveMoveCount: effective.length,
      moveNames: Array.from(new Set(effective.map((move) => titleize(move.move_name)))),
      uncovered: effective.length === 0,
    };
  });

  const doubleBattleInsights: DoubleBattleInsight[] = [];
  if (team.format === "double") {
    const names = rows.map((move) => move.move_name.toLowerCase());
    const abilities = team.members.map((member) => member.ability?.toLowerCase() ?? "");
    const species = team.members.map((member) => member.speciesName.toLowerCase());
    const has = (move: string) => names.includes(move);
    const hasAbility = (fragment: string) => abilities.some((ability) => ability.includes(fragment));

    if (has("protect") || has("detect")) doubleBattleInsights.push({ severity: "success", code: "protect", message: "A equipe possui proteção para controlar turnos e golpes em área." });
    else doubleBattleInsights.push({ severity: "warning", code: "protect-missing", message: "Nenhuma build possui Protect ou Detect." });

    if (has("tailwind")) doubleBattleInsights.push({ severity: "success", code: "tailwind", message: "Tailwind oferece controle de velocidade para a dupla." });
    if (has("trick-room")) doubleBattleInsights.push({ severity: "info", code: "trick-room", message: "Trick Room está presente; confira se as velocidades das builds seguem esse plano." });
    if (has("fake-out")) doubleBattleInsights.push({ severity: "success", code: "fake-out", message: "Fake Out pode criar um turno seguro para o parceiro." });
    if (has("follow-me") || has("rage-powder")) doubleBattleInsights.push({ severity: "success", code: "redirect", message: "A equipe possui redirecionamento para proteger o parceiro." });

    if (has("earthquake")) {
      const immunePartner = species.some((name) => ["rotom", "corviknight", "emolga", "skarmory", "talonflame", "charizard", "dragonite", "gliscor"].includes(name)) || hasAbility("levitate");
      doubleBattleInsights.push({ severity: immunePartner ? "success" : "warning", code: "earthquake", message: immunePartner ? "Earthquake possui ao menos um parceiro potencialmente imune." : "Earthquake pode atingir o parceiro e não foi encontrada imunidade evidente." });
    }
    if (has("surf")) doubleBattleInsights.push({ severity: hasAbility("water absorb") || hasAbility("storm drain") ? "success" : "warning", code: "surf", message: hasAbility("water absorb") || hasAbility("storm drain") ? "Surf pode ativar uma habilidade de absorção do parceiro." : "Surf pode causar dano ao parceiro; revise a dupla inicial." });
    if (has("discharge")) doubleBattleInsights.push({ severity: hasAbility("volt absorb") || hasAbility("lightning rod") || hasAbility("motor drive") ? "success" : "warning", code: "discharge", message: hasAbility("volt absorb") || hasAbility("lightning rod") || hasAbility("motor drive") ? "Discharge possui sinergia com absorção ou redirecionamento elétrico." : "Discharge pode atingir o parceiro sem benefício identificado." });
  }

  return {
    teamId: id,
    physicalMoves: rows.filter((move) => move.category === "physical").length,
    specialMoves: rows.filter((move) => move.category === "special").length,
    statusMoves: rows.filter((move) => move.category === "status").length,
    priorityMoves: rows.filter((move) => Number(move.priority ?? 0) > 0).length,
    coverage,
    doubleBattleInsights,
  };
}
