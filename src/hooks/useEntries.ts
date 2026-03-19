import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { EntryMeta } from "../lib/types";
import { fetchEntryMetaList, fetchPageContent } from "../lib/notion";

const CACHE_KEY = "teum_meta_cache_v2";
const CACHE_TTL_MS = 30 * 60 * 1000;
const PAGE_FETCH_CONCURRENCY = 4;

type CachePayload = { at: number; meta: EntryMeta[] };
type ContentMap = Record<string, string>;
type EntriesContextValue = {
  loading: boolean;
  error: string | null;
  quotesMeta: EntryMeta[];
  journalsMeta: EntryMeta[];
  getText: (id: string) => string | undefined;
  ensureContentByIds: (ids: string[]) => Promise<void>;
};

const EntriesContext = createContext<EntriesContextValue | null>(null);

function loadMetaCache(): EntryMeta[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed?.at || !Array.isArray(parsed.meta)) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.meta;
  } catch {
    return null;
  }
}

function saveMetaCache(meta: EntryMeta[]) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), meta } satisfies CachePayload)
    );
  } catch {
    // ignore cache write failures
  }
}

function useEntriesState(): EntriesContextValue {
  const cached = useMemo(() => loadMetaCache(), []);
  const [meta, setMeta] = useState<EntryMeta[]>(cached ?? []);
  const [content, setContent] = useState<ContentMap>({});
  const [loadingMeta, setLoadingMeta] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const contentRef = useRef<ContentMap>({});
  const inflight = useRef<Map<string, Promise<string | null>>>(new Map());

  const quotesMeta = useMemo(
    () => meta.filter((m) => m.type === "quote"),
    [meta]
  );

  const journalsMeta = useMemo(() => {
    return meta
      .filter((m) => m.type === "journal")
      .slice()
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [meta]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!cached) setLoadingMeta(true);

      try {
        const data = await fetchEntryMetaList();
        if (!alive) return;
        setMeta(data);
        saveMetaCache(data);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "불러오기 실패");
      } finally {
        if (alive) setLoadingMeta(false);
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, [cached]);

  const fetchBatch = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids)]
      .map((id) => id.trim())
      .filter(
        (id) => id.length > 0 && contentRef.current[id] === undefined
      );

    if (uniqueIds.length === 0) return;

    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += PAGE_FETCH_CONCURRENCY) {
      chunks.push(uniqueIds.slice(i, i + PAGE_FETCH_CONCURRENCY));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (id) => {
          const existing = inflight.current.get(id);
          if (existing) {
            const text = await existing;
            return text === null ? null : { id, text };
          }

          const task = (async () => {
            try {
              return await fetchPageContent(id);
            } catch {
              return null;
            } finally {
              inflight.current.delete(id);
            }
          })();

          inflight.current.set(id, task);

          const text = await task;
          return text === null ? null : { id, text };
        })
      );

      setContent((prev) => {
        let changed = false;
        const next = { ...prev };

        for (const result of results) {
          if (result && next[result.id] !== result.text) {
            next[result.id] = result.text;
            changed = true;
          }
        }

        const resolved = changed ? next : prev;
        contentRef.current = resolved;
        return resolved;
      });
    }
  }, []);

  const getText = useCallback((id: string) => content[id], [content]);

  const ensureContentByIds = useCallback(
    async (ids: string[]) => {
      const need = ids.filter((id) => contentRef.current[id] === undefined);
      if (need.length === 0) return;
      await fetchBatch(need);
    },
    [fetchBatch]
  );

  return useMemo(
    () => ({
      loading: loadingMeta,
      error,
      quotesMeta,
      journalsMeta,
      getText,
      ensureContentByIds,
    }),
    [
      loadingMeta,
      error,
      quotesMeta,
      journalsMeta,
      getText,
      ensureContentByIds,
    ]
  );
}

export function EntriesProvider({ children }: PropsWithChildren) {
  const value = useEntriesState();
  return createElement(EntriesContext.Provider, { value }, children);
}

export function useEntries() {
  const value = useContext(EntriesContext);
  if (!value) {
    throw new Error("EntriesProvider가 필요합니다.");
  }
  return value;
}
