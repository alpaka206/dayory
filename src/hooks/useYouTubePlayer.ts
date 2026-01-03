import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadYouTubeIframeAPI,
  type YTPlayer,
  type YTPlayerState,
} from "../lib/youtubeIframeApi";

type UseYouTubePlayerArgs = {
  videoId: string;
  onEnded?: () => void;
};

export function useYouTubePlayer({ videoId, onEnded }: UseYouTubePlayerArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  const [ready, setReady] = useState(false);
  const [state, setState] = useState<YTPlayerState>(-1);
  const [error, setError] = useState<string | null>(null);

  // 1) 최초 생성
  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        await loadYouTubeIframeAPI();
        if (!alive) return;

        const container = containerRef.current;
        if (!container) return;

        // 이미 만들어져 있으면 스킵
        if (playerRef.current) return;

        const YT = window.YT;
        if (!YT?.Player) {
          throw new Error("YouTube API가 준비되지 않았어.");
        }

        playerRef.current = new YT.Player(container, {
          videoId,
          width: "0",
          height: "0",
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (!alive) return;
              setReady(true);
              setError(null);
            },
            onStateChange: (e) => {
              if (!alive) return;
              const s = e.data;
              setState(s);
              if (s === 0) onEnded?.(); // ENDED
            },
            onError: (e) => {
              if (!alive) return;
              setError(`YT error: ${String(e.data)}`);
            },
          },
        });
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "YouTube 로드 실패");
      }
    })();

    return () => {
      alive = false;
      try {
        playerRef.current?.destroy();
      } catch {
        // error
      }
      playerRef.current = null;
      setReady(false);
      setState(-1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) videoId 변경 시 교체(기본은 cue)
  useEffect(() => {
    if (!ready) return;
    if (!videoId) return;

    const p = playerRef.current;
    if (!p) return;

    p.loadVideoById(videoId);
  }, [videoId, ready]);

  const play = useCallback(() => {
    playerRef.current?.playVideo();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.stopVideo();
  }, []);

  return { containerRef, ready, state, error, play, pause, stop };
}
