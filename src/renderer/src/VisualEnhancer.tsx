import { useEffect } from "react";
import type { AbilityCatalogEntry, ItemCatalogEntry } from "../../shared/contracts";
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
      name.classList.toggle("move-name-physical", Boolean(category?.includes("physical") || category?.includes("fisico") || category?.includes("físico")));
      name.classList.toggle("move-name-special", Boolean(category?.includes("special") || category?.includes("especial")));
      name.classList.toggle("move-name-status", Boolean(category?.includes("status")));
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

function createCatalogList(id: string, rows: Array<AbilityCatalogEntry | ItemCatalogEntry>): HTMLDataListElement {
  document.getElementById(id)?.remove();
  const list = document.createElement("datalist");
  list.id = id;
  rows.filter((row) => row.availability !== "unavailable").forEach((row) => {
    const option = document.createElement("option");
    option.value = row.name;
    option.label = row.description ? `${row.name} — ${row.description}` : row.name;
    list.append(option);
  });
  document.body.append(list);
  return list;
}

function connectCatalogInputs(root: ParentNode): void {
  root.querySelectorAll<HTMLLabelElement>("label").forEach((label) => {
    const input = label.querySelector<HTMLInputElement>('input:not([type="file"])');
    if (!input) return;
    const text = (label.childNodes[0]?.textContent ?? label.textContent ?? "").trim().toLowerCase();
    if (text.startsWith("habilidade")) {
      input.setAttribute("list", "gestorpoke-abilities-catalog");
      input.placeholder = "Pesquisar habilidade no catálogo...";
      input.autocomplete = "off";
    }
    if (text.startsWith("item equipado")) {
      input.setAttribute("list", "gestorpoke-items-catalog");
      input.placeholder = "Pesquisar item no catálogo...";
      input.autocomplete = "off";
    }
  });
}

function decorate(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".type-badge").forEach(decorateTypeBadge);
  decorateMoveRows(root);
  decorateAbilities(root);
  connectCatalogInputs(root);
}

export function VisualEnhancer() {
  useEffect(() => {
    let disposed = false;
    Promise.all([window.gestorPoke.abilities.list(), window.gestorPoke.items.list()])
      .then(([abilities, items]) => {
        if (disposed) return;
        createCatalogList("gestorpoke-abilities-catalog", abilities);
        createCatalogList("gestorpoke-items-catalog", items);
        decorate(document);
      })
      .catch((error) => console.error("Não foi possível carregar os catálogos dos formulários.", error));

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
    return () => {
      disposed = true;
      observer.disconnect();
      document.getElementById("gestorpoke-abilities-catalog")?.remove();
      document.getElementById("gestorpoke-items-catalog")?.remove();
    };
  }, []);
  return null;
}
