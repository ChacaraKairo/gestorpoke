import { getDatabase } from "./database";

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
const OFFICIAL_ARTWORK_BASE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";
const CONCURRENCY = 12;

type NamedResource = {
  name: string;
  url: string;
};

type ResourceList = {
  count: number;
  results: NamedResource[];
};

type PokemonResponse = {
  id: number;
  name: string;
  types: Array<{ slot: number; type: NamedResource }>;
};

export type CatalogStatus = {
  speciesCount: number;
  synchronizedAt: string | null;
  source: string;
};

export type CatalogSyncResult = CatalogStatus & {
  imported: number;
  updated: number;
};

function ensureCatalogMetadata(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS catalog_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "GestorPoke/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar o catálogo (${response.status} ${response.statusText}).`);
  }

  return response.json() as Promise<T>;
}

function getIdFromResourceUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  if (!match) throw new Error(`Não foi possível identificar o número da espécie: ${url}`);
  return Number(match[1]);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

export function getOfficialArtworkUrl(nationalDexNumber: number | null): string | null {
  return nationalDexNumber == null ? null : `${OFFICIAL_ARTWORK_BASE_URL}/${nationalDexNumber}.png`;
}

export function getCatalogStatus(): CatalogStatus {
  ensureCatalogMetadata();
  const db = getDatabase();
  const speciesCount = Number(
    (db.prepare("SELECT COUNT(*) AS total FROM species WHERE national_dex_number IS NOT NULL").get() as { total: number }).total,
  );
  const metadata = db
    .prepare("SELECT value FROM catalog_metadata WHERE key = 'pokedex_synchronized_at'")
    .get() as { value: string } | undefined;

  return {
    speciesCount,
    synchronizedAt: metadata?.value ?? null,
    source: "PokéAPI",
  };
}

export async function synchronizePokedex(): Promise<CatalogSyncResult> {
  ensureCatalogMetadata();
  const list = await fetchJson<ResourceList>(`${POKEAPI_BASE_URL}/pokemon-species?limit=100000&offset=0`);

  const records = await mapWithConcurrency(list.results, CONCURRENCY, async (resource) => {
    const nationalDexNumber = getIdFromResourceUrl(resource.url);
    const pokemon = await fetchJson<PokemonResponse>(`${POKEAPI_BASE_URL}/pokemon/${nationalDexNumber}`);
    return {
      nationalDexNumber,
      name: resource.name,
      types: pokemon.types
        .slice()
        .sort((first, second) => first.slot - second.slot)
        .map((entry) => entry.type.name),
    };
  });

  const db = getDatabase();
  const findByDex = db.prepare("SELECT id FROM species WHERE national_dex_number = ? AND form_name = 'default'");
  const findByName = db.prepare("SELECT id FROM species WHERE name = ? COLLATE NOCASE AND form_name = 'default'");
  const update = db.prepare(`
    UPDATE species
    SET national_dex_number = ?, name = ?, types_json = ?
    WHERE id = ?
  `);
  const insert = db.prepare(`
    INSERT INTO species (national_dex_number, name, form_name, types_json)
    VALUES (?, ?, 'default', ?)
  `);
  const upsertMetadata = db.prepare(`
    INSERT INTO catalog_metadata (key, value, updated_at)
    VALUES ('pokedex_synchronized_at', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction(() => {
    let imported = 0;
    let updated = 0;

    for (const record of records) {
      const existing = (findByDex.get(record.nationalDexNumber) ?? findByName.get(record.name)) as
        | { id: number }
        | undefined;
      const typesJson = JSON.stringify(record.types);

      if (existing) {
        update.run(record.nationalDexNumber, record.name, typesJson, existing.id);
        updated += 1;
      } else {
        insert.run(record.nationalDexNumber, record.name, typesJson);
        imported += 1;
      }
    }

    const synchronizedAt = new Date().toISOString();
    upsertMetadata.run(synchronizedAt);
    return { imported, updated, synchronizedAt };
  });

  const result = transaction();
  return {
    imported: result.imported,
    updated: result.updated,
    speciesCount: records.length,
    synchronizedAt: result.synchronizedAt,
    source: "PokéAPI",
  };
}
