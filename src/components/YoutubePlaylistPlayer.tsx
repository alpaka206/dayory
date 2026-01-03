import { useMemo, useState } from "react";
import { extractVideoId } from "../lib/youtube";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";

type Track = { title: string; artist?: string; url: string };

type Props = {
  tracks: Track[];
};

export default function YoutubePlaylistPlayer({ tracks }: Props) {
  const list = useMemo(() => {
    return tracks
      .map((t) => ({ ...t, id: extractVideoId(t.url) }))
      .filter((t): t is Track & { id: string } => Boolean(t.id));
  }, [tracks]);

  const total = list.length;
  const [idx, setIdx] = useState(0);
  const current = list[idx];

  const prev = () => setIdx((p) => (p - 1 + total) % total);
  const next = () => setIdx((p) => (p + 1) % total);

  const { containerRef, ready, state, error, play, pause } = useYouTubePlayer({
    videoId: current?.id ?? "",
    onEnded: () => {
      if (total > 0) setIdx((p) => (p + 1) % total);
    },
  });

  const playing = state === 1;

  if (total === 0) return null;

  return (
    <section className="playerMini">
      <div
        ref={containerRef}
        style={{ width: 0, height: 0, overflow: "hidden" }}
      />

      <div className="playerMiniInfo">
        <div className="playerMiniTitle">{current.title}</div>
        <div className="playerMiniArtist">{current.artist ?? " "}</div>
      </div>

      <div className="playerMiniControls">
        <button className="chip icon" onClick={prev} aria-label="이전">
          ‹
        </button>

        {playing ? (
          <button
            className="chip on icon play"
            onClick={pause}
            aria-label="일시정지"
          >
            Ⅱ
          </button>
        ) : (
          <button
            className="chip on icon play"
            onClick={play}
            aria-label="재생"
            disabled={!ready && !error ? false : false}
          >
            ▶
          </button>
        )}

        <button className="chip icon" onClick={next} aria-label="다음">
          ›
        </button>
      </div>
    </section>
  );
}
