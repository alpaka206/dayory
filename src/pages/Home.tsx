import { useEffect, useMemo, useState } from "react";
import Tabs from "../components/Tabs";
import { useEntries } from "../hooks/useEntries";
import { useLikes } from "../hooks/useLikes";
import { usePager } from "../hooks/usePager";
import type { EntryMeta } from "../lib/types";

function getWarmupIds(list: EntryMeta[], idx: number): string[] {
  if (list.length === 0) return [];

  const targetIndexes = [idx];
  if (list.length > 1) targetIndexes.push((idx + 1) % list.length);
  if (list.length > 2) {
    targetIndexes.push((idx - 1 + list.length) % list.length);
  }

  return [...new Set(targetIndexes.map((targetIdx) => list[targetIdx]?.id))]
    .filter((id): id is string => Boolean(id));
}

export default function Home() {
  const { loading, error, quotesMeta, journalsMeta, ensureContentByIds, getText } =
    useEntries();

  const { isLiked, toggleLike } = useLikes();

  const [tab, setTab] = useState<"quote" | "journal">("quote");
  const [motionDir, setMotionDir] = useState<"next" | "prev">("next");

  const quotePager = usePager({
    total: quotesMeta.length,
    persistKey: "teum_quote_idx_v1",
  });

  const journalPager = usePager({
    total: journalsMeta.length,
  });

  const quoteMeta = useMemo(() => {
    if (quotesMeta.length === 0) return "";
    return `${quotePager.idx + 1}/${quotesMeta.length}`;
  }, [quotePager.idx, quotesMeta.length]);

  const journalMeta = useMemo(() => {
    if (journalsMeta.length === 0) return "";
    return `${journalPager.idx + 1}/${journalsMeta.length}`;
  }, [journalPager.idx, journalsMeta.length]);

  const activeList = tab === "quote" ? quotesMeta : journalsMeta;
  const activeIdx = tab === "quote" ? quotePager.idx : journalPager.idx;
  const currentMeta = activeList[activeIdx];

  useEffect(() => {
    const ids = getWarmupIds(activeList, activeIdx);
    if (ids.length === 0) return;
    void ensureContentByIds(ids);
  }, [activeIdx, activeList, ensureContentByIds]);

  const currentText = currentMeta ? getText(currentMeta.id) : undefined;
  const headerRight = tab === "quote" ? quoteMeta : journalMeta;
  const isCurrentLiked = currentMeta ? isLiked(currentMeta.id) : false;
  const modeLabel = tab === "quote" ? "오늘의 문장" : "오늘의 기록";

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
    <div className="container pageStack homePage">
      <section className="toolbarRow homeToolbar">
        <Tabs tab={tab} onChange={setTab} />
        <div className="toolbarMeta">
          {headerRight ? `${headerRight} 읽는 중` : "아직 불러온 페이지가 없습니다."}
        </div>
      </section>

      {loading && quotesMeta.length === 0 && journalsMeta.length === 0 ? (
        <section className="card noticeCard">
          <div className="small">문장과 기록을 불러오는 중입니다.</div>
        </section>
      ) : null}

      {error && quotesMeta.length === 0 && journalsMeta.length === 0 ? (
        <section className="card noticeCard">
          <div className="small">불러오기에 실패했습니다: {error}</div>
        </section>
      ) : null}

      <section className="card readerCard">
        {!currentMeta ? (
          <div className="emptyState">
            <span className="eyebrow">아직 비어 있습니다</span>
            <h3 className="emptyTitle">불러온 글이 아직 없습니다.</h3>
            <p className="sectionLead">
              Notion 데이터 구성을 확인한 뒤 다시 시도해보세요.
            </p>
          </div>
        ) : currentText === undefined ? (
          <div className="emptyState">
            <span className="eyebrow">불러오는 중</span>
            <h3 className="emptyTitle">본문을 천천히 준비하고 있습니다.</h3>
            <p className="sectionLead">
              현재 페이지와 인접한 글을 먼저 가져와 자연스럽게 이어 읽을 수 있게
              준비합니다.
            </p>
          </div>
        ) : (
          <article
            key={currentMeta.id}
            className={`contentMotion ${
              motionDir === "next" ? "toNext" : "toPrev"
            } readerContent`}
          >
            <div className="entryMetaRow">
              <div className="entryTagGroup">
                <span className="eyebrow subtle">
                  {tab === "quote" ? "문장" : "기록"}
                </span>
                <div className="entrySource">
                  {currentMeta.pageTitle ||
                    (tab === "quote" ? "문장 아카이브" : "기록 아카이브")}
                </div>
              </div>

              <div className="entryCounter">{headerRight}</div>
            </div>

            {tab === "journal" && currentMeta.date ? (
              <div className="entryDate">{currentMeta.date}</div>
            ) : null}

            <div
              className={`quoteText ${tab === "journal" ? "journalText" : ""}`}
            >
              {currentText}
            </div>

            <div className="entryFooter">
              {currentMeta.author ? (
                <div className="entryAuthor">— {currentMeta.author}</div>
              ) : null}
            </div>
          </article>
        )}
      </section>

      {currentMeta ? (
        <section className="readerQuickBar">
          <div className="readerQuickInfo">
            <span className="readerQuickLabel">
              {currentMeta.pageTitle ||
                (tab === "quote" ? "문장 아카이브" : "기록 아카이브")}
            </span>
            <strong className="readerQuickValue">
              {headerRight || "0/0"} · {modeLabel}
            </strong>
          </div>

          <div className="readerQuickActions">
            <button type="button" className="btn" onClick={onPrev}>
              이전
            </button>
            <button type="button" className="btn primary" onClick={onNext}>
              다음
            </button>
            <button
              type="button"
              className={`btn ${isCurrentLiked ? "saved" : ""}`}
              onClick={() => toggleLike(currentMeta.id)}
              aria-pressed={isCurrentLiked}
            >
              {isCurrentLiked ? "저장됨" : "저장"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
