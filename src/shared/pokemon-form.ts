function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/[.'’]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-");
}

export function resolvePokemonApiIdentifiers(
  speciesName: string,
  formName: string,
  nationalDexNumber: number | null,
): Array<string | number> {
  const species = normalizeIdentifier(speciesName);
  const form = normalizeIdentifier(formName || "default");
  const identifiers: Array<string | number> = [];

  if (form && form !== "default" && form !== "normal" && form !== "standard") {
    identifiers.push(form.startsWith(`${species}-`) ? form : `${species}-${form}`);
  }
  if (nationalDexNumber != null) identifiers.push(nationalDexNumber);
  identifiers.push(species);
  return Array.from(new Set(identifiers));
}
