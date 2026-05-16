import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type PointerEvent,
} from "react";
import { useEntries } from "../hooks/useEntries";
import { useLikes } from "../hooks/useLikes";
import { usePager } from "../hooks/usePager";
import type { EntryMeta } from "../lib/types";

const SWIPE_THRESHOLD = 42;
const PREFETCH_AHEAD_THRESHOLD = 3;
const PREFETCH_AHEAD_COUNT = 10;

function getEntryAtOffset(
  list: EntryMeta[],
  idx: number,
  offset: number
): EntryMeta | undefined {
  if (list.length === 0) return undefined;
  return list[(idx + offset + list.length) % list.length];
}

function getImmediateIds(list: EntryMeta[], idx: number): string[] {
  if (list.length === 0) return [];

  const current = getEntryAtOffset(list, idx, 0);
  const nextEntry = getEntryAtOffset(list, idx, 1);
  const prevEntry = getEntryAtOffset(list, idx, -1);

  return [current?.id, nextEntry?.id, prevEntry?.id].filter(
    (id): id is string => Boolean(id)
  );
}

function getAheadIds(list: EntryMeta[], idx: number, count: number): string[] {
  if (list.length === 0) return [];

  const ids: string[] = [];
  const cappedCount = Math.min(count, Math.max(0, list.length - 1));

  for (let offset = 1; offset <= cappedCount; offset += 1) {
    const entry = getEntryAtOffset(list, idx, offset);
    if (entry?.id) ids.push(entry.id);
  }

  return [...new Set(ids)];
}

function countPreparedAhead(
  list: EntryMeta[],
  idx: number,
  getText: (id: string) => string | undefined
): number {
  let preparedCount = 0;
  const cappedCount = Math.min(
    PREFETCH_AHEAD_COUNT,
    Math.max(0, list.length - 1)
  );

  for (let offset = 1; offset <= cappedCount; offset += 1) {
    const entry = getEntryAtOffset(list, idx, offset);
    if (!entry?.id || getText(entry.id) === undefined) break;
    preparedCount += 1;
  }

  return preparedCount;
}

function getAuthorLabel(author: string, title: string): string {
  const value = author.trim();
  const pageTitle = title.trim();
  if (!value || !pageTitle || !value.includes(pageTitle)) return value;

  return value.replace(pageTitle, "").replace(/[,，]\s*$/, "").trim();
}

export default function Home() {
  const { loading, error, entriesMeta, ensureContentByIds, getText } =
    useEntries();
  const { isLiked, toggleLike } = useLikes();

  const quoteBoxRef = useRef<HTMLDivElement | null>(null);
  const quoteTextRef = useRef<HTMLQuoteElement | null>(null);
  const pointerStartX = useRef<number | null>(null);

  const pager = usePager({
    total: entriesMeta.length,
    persistKey: "teum_quote_idx_v2",
  });
  const { idx, next, prev } = pager;

  const pageMeta = useMemo(() => {
    if (entriesMeta.length === 0) return "";
    return `${idx + 1}/${entriesMeta.length}`;
  }, [idx, entriesMeta.length]);

  const currentMeta = entriesMeta[idx];
  const currentText = currentMeta ? getText(currentMeta.id) : undefined;
  const isCurrentLiked = currentMeta ? isLiked(currentMeta.id) : false;
  const authorLabel = currentMeta
    ? getAuthorLabel(currentMeta.author, currentMeta.pageTitle)
    : "";

  const onPrev = useCallback(() => {
    prev();
  }, [prev]);

  const onNext = useCallback(() => {
    next();
  }, [next]);

  useEffect(() => {
    const ids = getImmediateIds(entriesMeta, idx);
    if (ids.length === 0) return;
    void ensureContentByIds(ids);
  }, [entriesMeta, ensureContentByIds, idx]);

  useEffect(() => {
    if (entriesMeta.length === 0) return;

    const preparedAhead = countPreparedAhead(entriesMeta, idx, getText);
    if (preparedAhead > PREFETCH_AHEAD_THRESHOLD) return;

    const ids = getAheadIds(entriesMeta, idx, PREFETCH_AHEAD_COUNT);
    if (ids.length === 0) return;
    void ensureContentByIds(ids);
  }, [entriesMeta, ensureContentByIds, getText, idx]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext, onPrev]);

  const fitQuoteText = useCallback(() => {
    const box = quoteBoxRef.current;
    const quote = quoteTextRef.current;
    if (!box || !quote) return;

    const header = box.querySelector<HTMLElement>(".quoteHeader");
    const width = box.clientWidth;
    const availableHeight = Math.max(
      0,
      box.clientHeight - (header?.offsetHeight ?? 0) - 28
    );

    const baseSize = width < 520 ? 19 : width < 820 ? 23 : 28;
    const minSize = width < 520 ? 12 : width < 820 ? 15 : 17;
    const lineHeight = width < 520 ? 1.62 : 1.72;

    quote.style.setProperty("--quote-font-size", `${baseSize}px`);
    quote.style.setProperty("--quote-line-height", String(lineHeight));
    if (availableHeight === 0) return;

    const overflowHeight = quote.scrollHeight;
    if (overflowHeight <= availableHeight) return;

    const fitRatio = Math.max(0.1, availableHeight / overflowHeight);
    const fittedSize = Math.max(
      minSize,
      Math.floor(baseSize * fitRatio * 0.98)
    );

    quote.style.setProperty("--quote-font-size", `${fittedSize}px`);

    if (fittedSize > minSize && quote.scrollHeight > availableHeight) {
      quote.style.setProperty("--quote-font-size", `${minSize}px`);
    }
  }, []);

  useLayoutEffect(() => {
    fitQuoteText();
  }, [currentText, fitQuoteText]);

  useEffect(() => {
    let frameId = 0;
    const onResize = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(fitQuoteText);
    };

    window.addEventListener("resize", onResize);
    void document.fonts?.ready?.then(onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
    };
  }, [fitQuoteText]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerStartX.current = event.clientX;
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (pointerStartX.current === null) return;

    const deltaX = event.clientX - pointerStartX.current;
    pointerStartX.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0) onNext();
    else onPrev();
  };

  return (
    <div className="container pageStack homePage">
      <section
        className="bookStage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerStartX.current = null;
        }}
      >
        <div className="bookFrame" aria-live="polite">
          {!currentMeta && loading ? (
            <div className="bookState">
              <span className="eyebrow subtle">로딩</span>
              <h2>불러오는 중</h2>
            </div>
          ) : null}

          {!currentMeta && error ? (
            <div className="bookState">
              <span className="eyebrow subtle">연결 오류</span>
              <h2>불러오기 실패</h2>
              <p>{error}</p>
            </div>
          ) : null}

          {!currentMeta && !loading && !error ? (
            <div className="bookState">
              <span className="eyebrow subtle">비어 있음</span>
              <h2>문장 없음</h2>
            </div>
          ) : null}

          {currentMeta && currentText === undefined ? (
            <div className="bookState">
              <span className="eyebrow subtle">로딩</span>
              <h2>본문 로딩 중</h2>
            </div>
          ) : null}

          {currentMeta && currentText !== undefined ? (
            <article className="bookSpread">
              <div className="bookPage bookPageText" ref={quoteBoxRef}>
                <button
                  type="button"
                  className="quoteNavButton quoteNavPrev"
                  onClick={onPrev}
                  aria-label="이전 문장"
                  title="이전 문장"
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="quoteNavButton quoteNavNext"
                  onClick={onNext}
                  aria-label="다음 문장"
                  title="다음 문장"
                >
                  ›
                </button>

                <header className="quoteHeader">
                  <div className="quoteHeaderText">
                    <h2>{currentMeta.pageTitle || "문장 보관함"}</h2>
                    <div className="quoteMeta">
                      {pageMeta ? <span>{pageMeta}</span> : null}
                      {authorLabel ? <span>{authorLabel}</span> : null}
                      {currentMeta.date ? <span>{currentMeta.date}</span> : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`btn iconButton quoteSaveButton ${
                      isCurrentLiked ? "saved" : ""
                    }`}
                    onClick={() => toggleLike(currentMeta.id)}
                    aria-pressed={isCurrentLiked}
                    aria-label={isCurrentLiked ? "저장 취소" : "저장"}
                    title={isCurrentLiked ? "저장 취소" : "저장"}
                  >
                    {isCurrentLiked ? "♥" : "♡"}
                  </button>
                </header>

                <blockquote className="quoteText" ref={quoteTextRef}>
                  {currentText}
                </blockquote>
              </div>
            </article>
          ) : null}
        </div>
      </section>

      {currentMeta ? (
        <section className="readerQuickBar">
          <div className="readerQuickActions">
            <button
              type="button"
              className="btn iconButton readerActionPrev"
              onClick={onPrev}
              aria-label="이전 문장"
              title="이전 문장"
            >
              ‹
            </button>
            <button
              type="button"
              className="btn primary iconButton readerActionNext"
              onClick={onNext}
              aria-label="다음 문장"
              title="다음 문장"
            >
              ›
            </button>
            <button
              type="button"
              className={`btn iconButton readerActionSave ${
                isCurrentLiked ? "saved" : ""
              }`}
              onClick={() => toggleLike(currentMeta.id)}
              aria-pressed={isCurrentLiked}
              aria-label={isCurrentLiked ? "저장 취소" : "저장"}
              title={isCurrentLiked ? "저장 취소" : "저장"}
            >
              {isCurrentLiked ? "♥" : "♡"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
