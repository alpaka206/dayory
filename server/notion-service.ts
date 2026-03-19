import { NotionAPI } from "notion-client";

const api = new NotionAPI();

const TABLE_CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE_CACHE_TTL_MS = 30 * 60 * 1000;

type BlockValue = {
  id?: string;
  properties?: Record<string, unknown>;
  content?: string[];
};

type SchemaEntry = { name: string; type: string };

export type NotionTableRow = {
  id: string;
  type: string;
  author: string;
  date: string;
  pageTitle: string;
};

type CacheEntry<T> = {
  expiresAt: number;
  pending?: Promise<T>;
  value?: T;
};

type HeaderSetter = {
  setHeader(name: string, value: string): void;
};

const tableCache = new Map<string, CacheEntry<NotionTableRow[]>>();
const pageCache = new Map<string, CacheEntry<string>>();

// notion-client returns different nesting depths:
//   DB page:       block[id] = { spaceId, value: { value: {...}, role } }
//   Content page:  block[id] = { value: { id, type, ... } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveBlockValue(entry: any): BlockValue | undefined {
  const v = entry?.value;
  if (!v) return undefined;
  if (v.value && typeof v.value === "object" && v.value.id) {
    return v.value as BlockValue;
  }
  if (v.id) return v as BlockValue;
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveSchema(recordMap: any): {
  schema: Record<string, SchemaEntry>;
  schemaKeyByName: Record<string, string>;
} | null {
  const colMap = recordMap.collection;
  if (!colMap) return null;

  for (const colData of Object.values(colMap)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = colData as any;
    const schema = (c?.value?.value?.schema ?? c?.value?.schema) as
      | Record<string, SchemaEntry>
      | undefined;
    if (!schema) continue;

    const schemaKeyByName: Record<string, string> = {};
    for (const [key, def] of Object.entries(schema)) {
      schemaKeyByName[def.name.toLowerCase()] = key;
    }
    return { schema, schemaKeyByName };
  }

  return null;
}

function readTitleText(titleProp: unknown): string {
  if (!Array.isArray(titleProp)) return "";

  const parts: string[] = [];
  for (const item of titleProp) {
    if (Array.isArray(item) && typeof item[0] === "string") {
      parts.push(item[0]);
    }
  }

  return parts.join("").trim();
}

function readDateProp(dateProp: unknown): string {
  if (!Array.isArray(dateProp)) return "";

  for (const item of dateProp) {
    if (!Array.isArray(item)) continue;

    const formats = item[1];
    if (!Array.isArray(formats)) continue;

    for (const fmt of formats) {
      if (Array.isArray(fmt) && fmt[0] === "d" && fmt[1]?.start_date) {
        return fmt[1].start_date as string;
      }
    }
  }

  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRowBlockIds(recordMap: any): string[] {
  const cq = recordMap.collection_query;
  if (!cq) return [];

  for (const views of Object.values(cq)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const viewData of Object.values(views as any)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = (viewData as any)?.collection_group_results?.blockIds;
      if (ids && ids.length > 0) return ids as string[];
    }
  }

  return [];
}

function toNormalizedId(raw: string): string {
  const s = raw.replace(/-/g, "");
  if (s.length !== 32) return raw;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

async function readCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);
  const staleValue = cached?.value;

  if (staleValue !== undefined && (cached?.expiresAt ?? 0) > now) {
    return staleValue;
  }

  if (cached?.pending) {
    if (staleValue !== undefined) return staleValue;
    return cached.pending;
  }

  const pending = load()
    .then((value) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    })
    .catch((error) => {
      if (staleValue !== undefined) {
        cache.set(key, {
          value: staleValue,
          expiresAt: Date.now() + Math.min(ttlMs / 4, 60_000),
        });
      } else {
        cache.delete(key);
      }
      throw error;
    });

  if (staleValue !== undefined) {
    cache.set(key, {
      value: staleValue,
      expiresAt: cached?.expiresAt ?? 0,
      pending,
    });
    void pending.catch(() => undefined);
    return staleValue;
  }

  cache.set(key, { expiresAt: 0, pending });
  return pending;
}

export function applyNotionCacheHeaders(
  res: HeaderSetter,
  kind: "table" | "page"
) {
  const cacheControl =
    kind === "table"
      ? "public, max-age=60, stale-while-revalidate=300"
      : "public, max-age=300, stale-while-revalidate=1800";

  res.setHeader("Cache-Control", cacheControl);
}

export async function getNotionTableRows(
  pageId: string
): Promise<NotionTableRow[]> {
  return readCachedValue(tableCache, pageId, TABLE_CACHE_TTL_MS, async () => {
    const recordMap = await api.getPage(pageId, {
      fetchMissingBlocks: false,
      signFileUrls: false,
      fetchRelationPages: false,
    });

    const schemaInfo = resolveSchema(recordMap);
    if (!schemaInfo) {
      throw new Error("No collection schema found");
    }

    const { schemaKeyByName } = schemaInfo;
    const typeKey = schemaKeyByName["type"];
    const authorKey = schemaKeyByName["author"];
    const dateKey = schemaKeyByName["date"];

    const rowIds = getRowBlockIds(recordMap);
    const blockMap = recordMap.block ?? {};

    return rowIds
      .map((id: string) => {
        const v = resolveBlockValue(blockMap[id]);
        if (!v) return null;

        const props = v.properties ?? {};
        const type = readTitleText(typeKey ? props[typeKey] : undefined);
        const author = readTitleText(authorKey ? props[authorKey] : undefined);
        const date = dateKey ? readDateProp(props[dateKey]) : "";
        const pageTitle = readTitleText(props.title);

        return {
          id: (v.id ?? id).replace(/-/g, ""),
          type: type || "quote",
          author,
          date,
          pageTitle,
        };
      })
      .filter((row): row is NotionTableRow => row !== null);
  });
}

export async function getNotionPageText(pageId: string): Promise<string> {
  return readCachedValue(pageCache, pageId, PAGE_CACHE_TTL_MS, async () => {
    const recordMap = await api.getPage(pageId, {
      fetchCollections: false,
      signFileUrls: false,
      fetchRelationPages: false,
    });

    const blockMap = recordMap.block ?? {};
    const normalizedId = toNormalizedId(pageId);
    const page =
      resolveBlockValue(blockMap[normalizedId]) ??
      resolveBlockValue(blockMap[pageId]);

    if (!page) return "";

    const lines: string[] = [];
    for (const childId of page.content ?? []) {
      const child = resolveBlockValue(blockMap[childId]);
      if (!child) continue;

      const text = readTitleText(child.properties?.title);
      if (text) lines.push(text);
    }

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  });
}
