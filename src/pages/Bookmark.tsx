import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEntries } from "../hooks/useEntries";
import { useLikes } from "../hooks/useLikes";

const INITIAL_VISIBLE_COUNT = 12;
const LOAD_MORE_COUNT = 12;

export default function BookmarkPage() {
  const {
    quotesMeta,
    journalsMeta,
    getText,
    ensureContentByIds,
    loading,
    error,
  } = useEntries();
  const { likedIds, isLiked, toggleLike } = useLikes();

  const allMeta = useMemo(
    () => [...quotesMeta, ...journalsMeta],
    [quotesMeta, journalsMeta]
  );
  const favMeta = useMemo(() => {
    return allMeta
      .filter((meta) => likedIds.has(meta.id))
      .slice()
      .sort((a, b) => {
        const byDate = (b.date ?? "").localeCompare(a.date ?? "");
        if (byDate !== 0) return byDate;
        return a.pageTitle.localeCompare(b.pageTitle, "ko");
      });
  }, [allMeta, likedIds]);

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const visibleMeta = useMemo(
    () => favMeta.slice(0, visibleCount),
    [favMeta, visibleCount]
  );

  useEffect(() => {
    if (visibleMeta.length === 0) return;
    void ensureContentByIds(visibleMeta.map((item) => item.id));
  }, [visibleMeta, ensureContentByIds]);

  return (
    <div className="container pageStack">
      <section className="card heroPanel">
        <div className="heroCopy">
          <span className="eyebrow">저장한 페이지</span>
          <h2 className="sectionTitle">마음에 남긴 문장과 기록을 한곳에</h2>
          <p className="sectionLead">
            저장한 글만 차분하게 다시 읽을 수 있도록 최신 날짜 순으로 정리해
            보여줍니다.
          </p>
        </div>

        <div className="metricGrid">
          <article className="metricCard">
            <span className="metricLabel">총 저장 수</span>
            <strong className="metricValue">{favMeta.length}</strong>
            <span className="metricMeta">좋아한 문장과 기록 전체</span>
          </article>

          <article className="metricCard">
            <span className="metricLabel">지금 표시</span>
            <strong className="metricValue">
              {Math.min(visibleMeta.length, favMeta.length)}
            </strong>
            <span className="metricMeta">한 번에 천천히 불러오는 범위</span>
          </article>

          <article className="metricCard">
            <span className="metricLabel">초기 묶음</span>
            <strong className="metricValue">{INITIAL_VISIBLE_COUNT}</strong>
            <span className="metricMeta">첫 화면에서 바로 읽는 수</span>
          </article>

          <article className="metricCard">
            <span className="metricLabel">정렬 방식</span>
            <strong className="metricValue metricValueText">최신 날짜 우선</strong>
            <span className="metricMeta">
              같은 날짜에서는 페이지 제목 기준으로 정리합니다.
            </span>
          </article>
        </div>
      </section>

      <section className="card archiveCard">
        {loading && favMeta.length === 0 ? (
          <div className="small">저장한 글을 불러오는 중입니다.</div>
        ) : null}
        {error && favMeta.length === 0 ? (
          <div className="small">불러오기에 실패했습니다: {error}</div>
        ) : null}

        {favMeta.length === 0 ? (
          <div className="emptyState">
            <span className="eyebrow">저장함이 비어 있습니다</span>
            <h3 className="emptyTitle">마음에 남는 문장을 저장해보세요.</h3>
            <p className="sectionLead">
              둘러보기에서 저장 버튼을 누르면 이곳에 차분하게 모아집니다.
            </p>
            <div className="actionCluster">
              <Link className="btn primary" to="/">
                둘러보기로 가기
              </Link>
            </div>
          </div>
        ) : (
          <div className="archiveGrid">
            {visibleMeta.map((item) => {
              const text = getText(item.id);

              return (
                <article key={item.id} className="item archiveItem">
                  <div className="archiveItemTop">
                    <div className="entryTagGroup">
                      <span className="eyebrow subtle">
                        {item.type === "quote" ? "문장" : "기록"}
                      </span>
                      <div className="entrySource">
                        {item.pageTitle || "기록 보관함"}
                      </div>
                    </div>

                    <span className="small">{item.date ?? ""}</span>
                  </div>

                  <div className="archiveExcerpt">
                    {text === undefined ? "본문을 불러오는 중입니다." : text}
                  </div>

                  <div className="archiveFooter">
                    <span className="small">
                      {item.author ? `— ${item.author}` : ""}
                    </span>
                    <button
                      type="button"
                      className={`btn ${isLiked(item.id) ? "saved" : ""}`}
                      onClick={() => toggleLike(item.id)}
                      aria-pressed={isLiked(item.id)}
                    >
                      저장됨
                    </button>
                  </div>
                </article>
              );
            })}

            {visibleCount < favMeta.length ? (
              <div className="loadMoreWrap">
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setVisibleCount((prev) =>
                      Math.min(prev + LOAD_MORE_COUNT, favMeta.length)
                    )
                  }
                >
                  글 더 보기
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
