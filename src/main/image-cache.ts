import { app } from "electron";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const ALLOWED_HOSTS = new Set([
  "raw.githubusercontent.com",
  "raw.githubusercontent.com",
  "pokeapi.co",
  "sprites.pokeapi.co",
]);

function cacheDirectory(): string {
  const directory = join(app.getPath("userData"), "cache", "images");
  mkdirSync(directory, { recursive: true });
  return directory;
}

function mimeFromExtension(extension: string): string {
  switch (extension.toLowerCase()) {
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    default: return "image/png";
  }
}

export function imageCacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function validateImageUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("A imagem não pertence a uma fonte permitida pelo GestorPoke.");
  }
  return url;
}

export async function cacheImageAsDataUrl(value: string): Promise<string> {
  const url = validateImageUrl(value);
  const extension = extname(url.pathname).toLowerCase() || ".png";
  const safeExtension = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension) ? extension : ".png";
  const filePath = join(cacheDirectory(), `${imageCacheKey(url.toString())}${safeExtension}`);

  if (!existsSync(filePath)) {
    const response = await fetch(url, { headers: { Accept: "image/*", "User-Agent": "GestorPoke/0.1" } });
    if (!response.ok) throw new Error(`Não foi possível baixar a imagem (${response.status}).`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) throw new Error("A fonte retornou um arquivo que não é uma imagem.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 10 * 1024 * 1024) throw new Error("A imagem excede o limite de 10 MB.");
    writeFileSync(filePath, bytes);
  }

  const bytes = readFileSync(filePath);
  return `data:${mimeFromExtension(safeExtension)};base64,${bytes.toString("base64")}`;
}
