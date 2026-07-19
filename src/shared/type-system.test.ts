import { describe, expect, it } from "vitest";
import {
  getCombinedEffectiveness,
  getTypeEffectiveness,
  inferAbilityType,
  normalizeType,
} from "./type-system";

describe("type effectiveness", () => {
  it("handles super-effective, resisted and immune matchups", () => {
    expect(getTypeEffectiveness("water", "fire")).toBe(2);
    expect(getTypeEffectiveness("fire", "water")).toBe(0.5);
    expect(getTypeEffectiveness("electric", "ground")).toBe(0);
  });

  it("combines dual typings", () => {
    expect(getCombinedEffectiveness("ice", ["dragon", "ground"])).toBe(4);
    expect(getCombinedEffectiveness("fire", ["water", "dragon"])).toBe(0.25);
    expect(getCombinedEffectiveness("ground", ["electric", "flying"])).toBe(0);
  });

  it("accepts Portuguese and English aliases", () => {
    expect(normalizeType("Água")).toBe("water");
    expect(normalizeType("Aço")).toBe("steel");
    expect(normalizeType("Psychic")).toBe("psychic");
  });
});

describe("ability visual typing", () => {
  it("infers strongly associated ability types", () => {
    expect(inferAbilityType("Flash Fire")).toBe("fire");
    expect(inferAbilityType("Water Absorb")).toBe("water");
    expect(inferAbilityType("Levitate")).toBe("flying");
  });

  it("keeps neutral abilities untyped", () => {
    expect(inferAbilityType("Clear Body")).toBeNull();
  });
});
