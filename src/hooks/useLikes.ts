import { useCallback, useEffect, useMemo, useState } from "react";

const LIKE_KEY = "teum_likes_v1";
type LikeMap = Record<string, true>;

function loadLikes(): LikeMap {
  try {
    const raw = localStorage.getItem(LIKE_KEY);
    return raw ? (JSON.parse(raw) as LikeMap) : {};
  } catch {
    return {};
  }
}

function saveLikes(map: LikeMap) {
  try {
    localStorage.setItem(LIKE_KEY, JSON.stringify(map));
  } catch {
    // error
  }
}

export function useLikes() {
  const [likedMap, setLikedMap] = useState<LikeMap>(() => loadLikes());

  useEffect(() => {
    saveLikes(likedMap);
  }, [likedMap]);

  const isLiked = useCallback((id: string) => !!likedMap[id], [likedMap]);

  const toggleLike = useCallback((id: string) => {
    setLikedMap((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const likedIds = useMemo(() => new Set(Object.keys(likedMap)), [likedMap]);

  return { likedIds, isLiked, toggleLike };
}
