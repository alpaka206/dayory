import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EntryMeta, EntryType } from "../lib/types";
import { fetchEntryMetaList, fetchPageContent } from "../lib/notion";

const CACHE_KEY = "teum_meta_cache_v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

type CachePayload = { at: number; meta: EntryMeta[] };
type ContentMap = Record<string, string>;

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
    // error
  }
}

export function useEntries() {
  const cached = useMemo(() => loadMetaCache(), []);
  const [meta, setMeta] = useState<EntryMeta[]>(cached ?? []);
  const [content, setContent] = useState<ContentMap>({});
  const [loadingMeta, setLoadingMeta] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const [loadedCount, setLoadedCount] = useState<Record<EntryType, number>>({
    quote: 0,
    journal: 0,
  });

  const inflight = useRef<Set<string>>(new Set());

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
    let alive = true;

    const run = async () => {
      setLoadingMeta(true);
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
        setLoadingMeta(false);
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, []);

  const fetchBatch = useCallback(async (ids: string[]) => {
    const concurrency = 5;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += concurrency)
      chunks.push(ids.slice(i, i + concurrency));

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (id) => {
          if (inflight.current.has(id)) return null;
          inflight.current.add(id);
          try {
            const text = await fetchPageContent(id);
            return { id, text };
          } catch {
            return null; // 하나 실패해도 전체 멈추지 않게
          } finally {
            inflight.current.delete(id);
          }
        })
      );

      setContent((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.id] = r.text; // 빈 문자열도 저장(로딩 끝)
        }
        return next;
      });
    }
  }, []);

  const ensureLoaded = useCallback(
    async (type: EntryType, wantCount: number) => {
      const list = type === "quote" ? quotesMeta : journalsMeta;

      const already = loadedCount[type];
      if (wantCount <= already) return;

      const nextCount = Math.min(wantCount, list.length);
      const target = list.slice(already, nextCount).map((m) => m.id);
      if (target.length === 0) return;

      await fetchBatch(target);
      setLoadedCount((prev) => ({ ...prev, [type]: nextCount }));
    },
    [quotesMeta, journalsMeta, loadedCount, fetchBatch]
  );

  useEffect(() => {
    if (meta.length === 0) return;
    void ensureLoaded("quote", 5);
    void ensureLoaded("journal", 5);
  }, [meta.length, ensureLoaded]);

  const getText = useCallback((id: string) => content[id], [content]);

  const ensureContentByIds = useCallback(
    async (ids: string[]) => {
      const need = ids.filter((id) => content[id] === undefined);
      if (need.length === 0) return;
      await fetchBatch(need);
    },
    [content, fetchBatch]
  );

  return {
    loading: loadingMeta,
    error,
    quotesMeta,
    journalsMeta,
    loadedCount,
    ensureLoaded,
    getText,
    ensureContentByIds,
  };
}
