import { NotionAPI } from "notion-client";

const api = new NotionAPI();

const COLLECTION_CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE_CACHE_TTL_MS = 30 * 60 * 1000;
const COLLECTION_QUERY_LIMIT = 9999;
const BLOCK_FETCH_CHUNK_SIZE = 50;
const RETRY_DELAYS_MS = [500, 1000, 2000];
const NOTION_TIME_ZONE = "Asia/Seoul";

type BlockValue = {
  id?: string;
  properties?: Record<string, unknown>;
  content?: string[];
  format?: {
    collection_pointer?: {
      id?: string;
      spaceId?: string;
    };
  };
  collection_id?: string;
  page_sort?: string[];
  space_id?: string;
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

type NotionRecordMap = {
  block: Record<string, unknown>;
  collection: Record<string, unknown>;
  collection_view: Record<string, unknown>;
  notion_user: Record<string, unknown>;
  collection_query: Record<string, Record<string, unknown>>;
};

type CollectionContext = {
  rootPageId: string;
  recordMap: NotionRecordMap;
  rowIds: string[];
};

const collectionCache = new Map<string, CacheEntry<CollectionContext>>();
const pageCache = new Map<string, CacheEntry<string>>();

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("429");
}

async function withRetry<T>(load: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      if (!isRateLimitError(error) || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }

      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new Error("Failed to complete Notion request");
}

// notion-client can wrap values one level deeper depending on the endpoint.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveRecordValue<T>(entry: any): T | undefined {
  const value = entry?.value;
  if (!value) return undefined;

  if (value.value && typeof value.value === "object") {
    return value.value as T;
  }

  return value as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveBlockValue(entry: any): BlockValue | undefined {
  const value = resolveRecordValue<BlockValue>(entry);
  return value?.id ? value : undefined;
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

function toNormalizedId(raw: string): string {
  const s = raw.replace(/-/g, "");
  if (s.length !== 32) return raw;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function getBlockEntry(
  blockMap: Record<string, unknown>,
  rawId: string
): unknown | undefined {
  const normalizedId = toNormalizedId(rawId);
  return blockMap[normalizedId] ?? blockMap[rawId];
}

function getReducerResultBlockIds(result: unknown): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids = (result as any)?.reducerResults?.collection_group_results?.blockIds;
  return Array.isArray(ids) ? ids.map((id) => toNormalizedId(String(id))) : [];
}

function getCollectionViews(recordMap: NotionRecordMap) {
  return Object.entries(recordMap.collection_view).flatMap(([viewId, entry]) => {
    const view = resolveBlockValue(entry);
    const collectionId = toNormalizedId(
      view?.collection_id ?? view?.format?.collection_pointer?.id ?? ""
    );

    if (!view || !collectionId) return [];

    return [
      {
        viewId: toNormalizedId(viewId),
        collectionId,
        view,
        pageSort: Array.isArray(view.page_sort)
          ? view.page_sort.map((id) => toNormalizedId(id))
          : [],
        spaceId: view.space_id ?? view.format?.collection_pointer?.spaceId,
      },
    ];
  });
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

async function getCollectionContext(
  rootPageId: string
): Promise<CollectionContext> {
  const normalizedRootId = toNormalizedId(rootPageId);

  return readCachedValue(
    collectionCache,
    normalizedRootId,
    COLLECTION_CACHE_TTL_MS,
    async () => {
      const rawRecordMap = await withRetry(() =>
        api.getPage(normalizedRootId, {
          fetchMissingBlocks: false,
          fetchCollections: false,
          signFileUrls: false,
          fetchRelationPages: false,
        })
      );

      const recordMap: NotionRecordMap = {
        block: rawRecordMap.block ?? {},
        collection: rawRecordMap.collection ?? {},
        collection_view: rawRecordMap.collection_view ?? {},
        notion_user: rawRecordMap.notion_user ?? {},
        collection_query: rawRecordMap.collection_query ?? {},
      };

      const viewEntries = getCollectionViews(recordMap);
      if (viewEntries.length === 0) {
        throw new Error("No collection view found");
      }

      const rowIds = new Set<string>();

      for (const { viewId, collectionId, view, pageSort, spaceId } of viewEntries) {
        const collectionData = await withRetry(() =>
          api.getCollectionData(collectionId, viewId, view, {
            limit: COLLECTION_QUERY_LIMIT,
            searchQuery: "",
            userTimeZone: NOTION_TIME_ZONE,
            loadContentCover: false,
            spaceId,
          })
        );

        recordMap.block = {
          ...recordMap.block,
          ...(collectionData.recordMap?.block ?? {}),
        };

        recordMap.collection = {
          ...recordMap.collection,
          ...(collectionData.recordMap?.collection ?? {}),
        };

        recordMap.collection_view = {
          ...recordMap.collection_view,
          ...(collectionData.recordMap?.collection_view ?? {}),
        };

        recordMap.notion_user = {
          ...recordMap.notion_user,
          ...(collectionData.recordMap?.notion_user ?? {}),
        };

        recordMap.collection_query[collectionId] = {
          ...(recordMap.collection_query[collectionId] ?? {}),
          [viewId]:
            // Keep this compatible with older collection_query readers.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((collectionData.result as any)?.reducerResults ??
              collectionData.result) as Record<string, unknown>,
        };

        for (const rowId of getReducerResultBlockIds(collectionData.result)) {
          rowIds.add(rowId);
        }

        for (const rowId of pageSort) {
          rowIds.add(rowId);
        }
      }

      if (rowIds.size === 0) {
        throw new Error("No collection rows found");
      }

      return {
        rootPageId: normalizedRootId,
        recordMap,
        rowIds: [...rowIds],
      };
    }
  );
}

async function hydrateMissingBlockTree(
  blockMap: Record<string, unknown>,
  rootIds: string[]
): Promise<Record<string, unknown>> {
  const queue = [...new Set(rootIds.map((id) => toNormalizedId(id)))];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;

    const existing = resolveBlockValue(getBlockEntry(blockMap, currentId));
    if (!existing) {
      const blocks = await withRetry(() => api.getBlocks([currentId]));
      blockMap = {
        ...blockMap,
        ...(blocks.recordMap?.block ?? {}),
      };
    }

    const block = resolveBlockValue(getBlockEntry(blockMap, currentId));
    visited.add(currentId);
    if (!block) continue;

    const childIds = (block.content ?? []).map((childId) =>
      toNormalizedId(childId)
    );

    for (let idx = 0; idx < childIds.length; idx += BLOCK_FETCH_CHUNK_SIZE) {
      const chunk = childIds.slice(idx, idx + BLOCK_FETCH_CHUNK_SIZE);
      const missingIds = chunk.filter(
        (childId) => !resolveBlockValue(getBlockEntry(blockMap, childId))
      );

      if (missingIds.length === 0) continue;

      const blocks = await withRetry(() => api.getBlocks(missingIds));
      blockMap = {
        ...blockMap,
        ...(blocks.recordMap?.block ?? {}),
      };
    }

    for (const childId of childIds) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return blockMap;
}

function collectPlainText(
  blockMap: Record<string, unknown>,
  childIds: string[],
  visited = new Set<string>()
): string[] {
  const lines: string[] = [];

  for (const childId of childIds) {
    const normalizedId = toNormalizedId(childId);
    if (visited.has(normalizedId)) continue;

    visited.add(normalizedId);
    const child = resolveBlockValue(getBlockEntry(blockMap, normalizedId));
    if (!child) continue;

    const text = readTitleText(child.properties?.title);
    if (text) {
      lines.push(text);
    }

    if (Array.isArray(child.content) && child.content.length > 0) {
      lines.push(...collectPlainText(blockMap, child.content, visited));
    }
  }

  return lines;
}

export async function getNotionTableRows(
  rootPageId: string
): Promise<NotionTableRow[]> {
  const context = await getCollectionContext(rootPageId);
  const schemaInfo = resolveSchema(context.recordMap);
  if (!schemaInfo) {
    throw new Error("No collection schema found");
  }

  const { schemaKeyByName } = schemaInfo;
  const typeKey = schemaKeyByName["type"];
  const authorKey = schemaKeyByName["author"];
  const dateKey = schemaKeyByName["date"];

  return context.rowIds
    .map((rowId) => {
      const value = resolveBlockValue(
        getBlockEntry(context.recordMap.block, rowId)
      );
      if (!value) return null;

      const props = value.properties ?? {};
      const type = readTitleText(typeKey ? props[typeKey] : undefined);
      const author = readTitleText(authorKey ? props[authorKey] : undefined);
      const date = dateKey ? readDateProp(props[dateKey]) : "";
      const pageTitle = readTitleText(props.title);

      return {
        id: (value.id ?? rowId).replace(/-/g, ""),
        type: type || "quote",
        author,
        date,
        pageTitle,
      };
    })
    .filter((row): row is NotionTableRow => row !== null);
}

export async function getNotionPageText(
  rootPageId: string,
  pageId: string
): Promise<string> {
  const normalizedRootId = toNormalizedId(rootPageId);
  const normalizedPageId = toNormalizedId(pageId);
  const cacheKey = `${normalizedRootId}:${normalizedPageId}`;

  return readCachedValue(pageCache, cacheKey, PAGE_CACHE_TTL_MS, async () => {
    const context = await getCollectionContext(normalizedRootId);
    context.recordMap.block = await hydrateMissingBlockTree(
      context.recordMap.block,
      [normalizedPageId]
    );

    const page = resolveBlockValue(
      getBlockEntry(context.recordMap.block, normalizedPageId)
    );
    if (!page) return "";

    const lines = collectPlainText(context.recordMap.block, page.content ?? []);
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  });
}
