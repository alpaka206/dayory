import { useMemo, useState } from "react";
import Tabs from "../components/Tabs";
import { useEntries } from "../hooks/useEntries";
import { useLikes } from "../hooks/useLikes";
import { usePager } from "../hooks/usePager";

export default function Home() {
  const {
    loading,
    error,
    quotesMeta,
    journalsMeta,
    loadedCount,
    ensureLoaded,
    getText,
  } = useEntries();

  const { isLiked, toggleLike } = useLikes();

  const [tab, setTab] = useState<"quote" | "journal">("quote");
  const [motionDir, setMotionDir] = useState<"next" | "prev">("next");

  const quotePager = usePager({
    total: quotesMeta.length,
    loaded: loadedCount.quote,
    ensureLoaded: (want) => void ensureLoaded("quote", want),
    persistKey: "teum_quote_idx_v1",
  });

  const journalPager = usePager({
    total: journalsMeta.length,
    loaded: loadedCount.journal,
    ensureLoaded: (want) => void ensureLoaded("journal", want),
  });

  const quoteMeta = useMemo(() => {
    if (quotesMeta.length === 0) return "";
    return `${quotePager.idx + 1}/${quotesMeta.length}`;
  }, [quotePager.idx, quotesMeta.length]);

  const journalMeta = useMemo(() => {
    if (journalsMeta.length === 0) return "";
    return `${journalPager.idx + 1}/${journalsMeta.length}`;
  }, [journalPager.idx, journalsMeta.length]);

  const currentMeta =
    tab === "quote"
      ? quotesMeta[quotePager.idx]
      : journalsMeta[journalPager.idx];

  const currentText = currentMeta ? getText(currentMeta.id) : undefined;

  const headerRight = tab === "quote" ? quoteMeta : journalMeta;

  const onPrev = () => {
    setMotionDir("prev");
    if (tab === "quote") quotePager.prev();
    else journalPager.prev();
  };

  const onNext = () => {
    setMotionDir("next");
    if (tab === "quote") quotePager.next();
    else journalPager.next();
  };

  return (
    <div className="container">
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: 12 }}
      >
        <Tabs tab={tab} onChange={setTab} />
        <div className="small">{headerRight}</div>
      </div>

      {loading && quotesMeta.length === 0 && journalsMeta.length === 0 ? (
        <section className="card">
          <div className="small">불러오는 중…</div>
        </section>
      ) : null}

      {error && quotesMeta.length === 0 && journalsMeta.length === 0 ? (
        <section className="card">
          <div className="small">불러오기 실패: {error}</div>
        </section>
      ) : null}

      <section className="card">
        {!currentMeta ? (
          <div className="small">글이 없습니다.</div>
        ) : currentText === undefined ? (
          <div className="small">불러오는 중…</div>
        ) : (
          <div
            key={currentMeta.id}
            className={`contentMotion ${
              motionDir === "next" ? "toNext" : "toPrev"
            }`}
          >
            {tab === "journal" && currentMeta.date ? (
              <div className="small">{currentMeta.date}</div>
            ) : null}

            <div
              className="quoteText"
              style={{ marginTop: tab === "journal" ? 10 : 0 }}
            >
              {currentText}
            </div>

            {currentMeta.author ? (
              <div
                className="small"
                style={{ marginTop: 10, textAlign: "right" }}
              >
                — {currentMeta.author}
              </div>
            ) : null}

            <div
              className="row"
              style={{ marginTop: 18, justifyContent: "space-between" }}
            >
              <div className="row">
                <button className="btn" onClick={onPrev}>
                  이전
                </button>
                <button className="btn primary" onClick={onNext}>
                  다음
                </button>
              </div>

              <button
                className="btn"
                onClick={() => toggleLike(currentMeta.id)}
              >
                {isLiked(currentMeta.id) ? "저장 취소" : "저장"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
