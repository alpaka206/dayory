import { useCallback, useEffect, useMemo, useState } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { extractVideoId } from "../lib/youtube";

type Track = { title: string; artist?: string; url: string };

type Props = {
  tracks: Track[];
};

const PLAYER_TRACK_IDX_KEY = "teum_player_track_idx_v1";

function loadTrackIndex() {
  try {
    const raw = localStorage.getItem(PLAYER_TRACK_IDX_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveTrackIndex(idx: number) {
  try {
    localStorage.setItem(PLAYER_TRACK_IDX_KEY, String(idx));
  } catch {
    // ignore persistence failures
  }
}

export default function YouTubePlaylistPlayer({ tracks }: Props) {
  const list = useMemo(() => {
    const seen = new Set<string>();

    return tracks
      .map((track) => ({ ...track, id: extractVideoId(track.url) }))
      .filter((track): track is Track & { id: string } => {
        if (!track.id || seen.has(track.id)) return false;
        seen.add(track.id);
        return true;
      });
  }, [tracks]);

  const total = list.length;
  const [idx, setIdx] = useState(() => loadTrackIndex());
  const safeIdx = useMemo(() => {
    if (total <= 0) return 0;
    return ((idx % total) + total) % total;
  }, [idx, total]);
  const current = list[safeIdx];

  useEffect(() => {
    saveTrackIndex(safeIdx);
  }, [safeIdx]);

  const next = useCallback(() => {
    if (total === 0) return;
    setIdx((prev) => (prev + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    if (total === 0) return;
    setIdx((prev) => (prev - 1 + total) % total);
  }, [total]);

  const { containerRef, ready, state, error, play, pause } = useYouTubePlayer({
    videoId: current?.id ?? "",
    onEnded: next,
    onError: total > 1 ? next : undefined,
  });

  const playing = state === 1;
  const helperText = error
    ? "재생 오류가 있어 다음 곡으로 넘어갑니다."
    : ready
      ? `${safeIdx + 1} / ${total}`
      : "플레이어를 준비하고 있습니다.";

  if (total === 0) return null;

  return (
    <section className="playerMini">
      <div
        ref={containerRef}
        style={{ width: 0, height: 0, overflow: "hidden" }}
      />

      <div className="playerMiniInfo">
        <div className="playerMiniTop">
          <span className="eyebrow subtle">함께 듣는 음악</span>
          <div className="playerMiniMeta">{helperText}</div>
        </div>

        <div className="playerMiniTitle">{current.title}</div>
        <div className="playerMiniArtist">{current.artist ?? " "}</div>
      </div>

      <div className="playerMiniControls">
        <button
          type="button"
          className="chip icon"
          onClick={prev}
          aria-label="이전"
        >
          ‹
        </button>

        {playing ? (
          <button
            type="button"
            className="chip on icon play"
            onClick={pause}
            aria-label="일시정지"
          >
            Ⅱ
          </button>
        ) : (
          <button
            type="button"
            className="chip on icon play"
            onClick={play}
            aria-label="재생"
          >
            ►
          </button>
        )}

        <button
          type="button"
          className="chip icon"
          onClick={next}
          aria-label="다음"
        >
          ›
        </button>
      </div>
    </section>
  );
}
