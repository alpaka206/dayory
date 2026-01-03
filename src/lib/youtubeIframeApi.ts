export type YTPlayerConstructor = new (
  container: HTMLElement,
  options: YTPlayerOptions
) => YTPlayer;

export type YTNamespace = {
  Player: YTPlayerConstructor;
};

export type YTPlayerOptions = {
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (e: YTOnStateChangeEvent) => void;
    onError?: (e: YTOnErrorEvent) => void;
  };
};

export type YTOnStateChangeEvent = { data: YTPlayerState };
export type YTOnErrorEvent = { data: number };

// -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
export type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5;

export type YTPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  loadVideoById: (videoId: string) => void;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let promise: Promise<void> | null = null;

export function loadYouTubeIframeAPI(): Promise<void> {
  if (promise) return promise;

  promise = new Promise<void>((resolve, reject) => {
    // 이미 로드
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    const attachReady = () => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
    };

    if (existing) {
      attachReady();
      return;
    }

    attachReady();

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => reject(new Error("YouTube IFrame API 로드 실패"));
    document.head.appendChild(tag);
  });

  return promise;
}
