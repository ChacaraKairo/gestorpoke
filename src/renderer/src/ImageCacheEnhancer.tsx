import { useEffect } from "react";

const processed = new WeakSet<HTMLImageElement>();

function isCacheable(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && ["raw.githubusercontent.com", "sprites.pokeapi.co", "pokeapi.co"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function cacheImage(image: HTMLImageElement): Promise<void> {
  if (processed.has(image)) return;
  processed.add(image);
  const original = image.currentSrc || image.src;
  if (!isCacheable(original)) return;
  image.dataset.remoteSrc = original;
  try {
    const cached = await window.gestorPoke.images.cache(original);
    if (image.isConnected) image.src = cached;
  } catch {
    processed.delete(image);
  }
}

function scan(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => void cacheImage(image));
}

export function ImageCacheEnhancer() {
  useEffect(() => {
    scan(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) void cacheImage(node);
          else if (node instanceof HTMLElement) scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
