import { useCallback, useEffect, useMemo, useState } from "react";

type Args = {
  total: number;
  persistKey?: string;
};

function loadIdx(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveIdx(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    // ignore persistence failures
  }
}

export function usePager({ total, persistKey }: Args) {
  const [idx, setIdx] = useState<number>(() =>
    persistKey ? loadIdx(persistKey) : 0
  );

  const safeIdx = useMemo(() => {
    if (total <= 0) return 0;
    return ((idx % total) + total) % total;
  }, [idx, total]);

  useEffect(() => {
    if (!persistKey) return;
    saveIdx(persistKey, safeIdx);
  }, [persistKey, safeIdx]);

  const next = useCallback(() => {
    if (total === 0) return;
    setIdx((p) => p + 1);
  }, [total]);

  const prev = useCallback(() => {
    if (total === 0) return;
    setIdx((p) => p - 1);
  }, [total]);

  return { idx: safeIdx, next, prev };
}
