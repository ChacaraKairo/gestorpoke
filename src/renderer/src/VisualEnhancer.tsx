import { useEffect } from "react";
import { inferAbilityType, normalizeType, typeColors, typeLabels } from "../../shared/type-system";

function decorateTypeBadge(element: HTMLElement): void {
  const type = normalizeType(element.textContent);
  if (!type) return;
  element.dataset.type = type;
  element.style.setProperty("--type-color", typeColors[type]);
  element.title = typeLabels[type];
}

function decorateMoveRows(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".moves-table article").forEach((row) => {
    const cells = Array.from(row.children) as HTMLElement[];
    const typeCell = cells[1];
    const categoryCell = cells[2];
    const name = cells[0];
    const type = normalizeType(typeCell?.textContent);
    const category = categoryCell?.textContent?.trim().toLowerCase();
    if (type && typeCell) {
      typeCell.classList.add("move-type-chip");
      typeCell.dataset.type = type;
      typeCell.style.setProperty("--type-color", typeColors[type]);
    }
    if (name) {
      name.classList.toggle("move-name-physical", category?.includes("physical") || category?.includes("fisico") || category?.includes("físico"));
      name.classList.toggle("move-name-special", category?.includes("special") || category?.includes("especial"));
      name.classList.toggle("move-name-status", category?.includes("status"));
      if (type) name.style.setProperty("--move-glow", typeColors[type]);
    }
  });

  root.querySelectorAll<HTMLElement>(".move-slot-v2").forEach((slot) => {
    const text = slot.textContent ?? "";
    const type = Object.keys(typeLabels).find((key) => text.toLowerCase().includes(typeLabels[key as keyof typeof typeLabels].toLowerCase()));
    if (type) {
      slot.dataset.type = type;
      slot.style.setProperty("--type-color", typeColors[type as keyof typeof typeColors]);
    }
  });
}

function decorateAbilities(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("dd, .build-list-v2 em, .pokemon-card-v2 .mini-data dd").forEach((element) => {
    const label = element.parentElement?.querySelector("dt")?.textContent?.toLowerCase() ?? "";
    if (!label.includes("habilidade")) return;
    const abilityType = inferAbilityType(element.textContent);
    element.classList.add("ability-chip");
    if (abilityType) {
      element.dataset.type = abilityType;
      element.style.setProperty("--ability-color", typeColors[abilityType]);
    }
  });
}

function decorate(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".type-badge").forEach(decorateTypeBadge);
  decorateMoveRows(root);
  decorateAbilities(root);
}

export function VisualEnhancer() {
  useEffect(() => {
    decorate(document);
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        decorate(document);
        scheduled = false;
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
