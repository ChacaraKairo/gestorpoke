import { createHash } from "node:crypto";

export const allowedImageHosts = new Set([
  "raw.githubusercontent.com",
  "pokeapi.co",
  "sprites.pokeapi.co",
]);

export function imageCacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export function validateCacheableImageUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !allowedImageHosts.has(url.hostname)) {
    throw new Error("A imagem não pertence a uma fonte permitida pelo GestorPoke.");
  }
  return url;
}
