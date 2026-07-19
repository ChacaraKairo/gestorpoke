import { describe, expect, it } from "vitest";
import { imageCacheKey, validateCacheableImageUrl } from "./image-cache";

describe("image cache helpers", () => {
  it("produces stable sha256 keys", () => {
    const url = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png";
    expect(imageCacheKey(url)).toHaveLength(64);
    expect(imageCacheKey(url)).toBe(imageCacheKey(url));
    expect(imageCacheKey(url)).not.toBe(imageCacheKey(`${url}?v=2`));
  });

  it("accepts approved HTTPS image hosts", () => {
    expect(validateCacheableImageUrl("https://raw.githubusercontent.com/PokeAPI/sprites/master/25.png").hostname).toBe("raw.githubusercontent.com");
    expect(validateCacheableImageUrl("https://sprites.pokeapi.co/sprites/25.png").hostname).toBe("sprites.pokeapi.co");
  });

  it("rejects HTTP and unapproved hosts", () => {
    expect(() => validateCacheableImageUrl("http://raw.githubusercontent.com/file.png")).toThrow();
    expect(() => validateCacheableImageUrl("https://example.com/file.png")).toThrow();
  });
});
