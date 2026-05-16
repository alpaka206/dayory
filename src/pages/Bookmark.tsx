import { useEffect, useMemo, useState } from "react";
import { useEntries } from "../hooks/useEntries";
import { useLikes } from "../hooks/useLikes";

const INITIAL_VISIBLE_COUNT = 12;
const LOAD_MORE_COUNT = 12;

function getAuthorLabel(author: string, title: string): string {
  const value = author.trim();
  const pageTitle = title.trim();
  if (!value || !pageTitle || !value.includes(pageTitle)) return value;

  return value.replace(pageTitle, "").replace(/[,，]\s*$/, "").trim();
}

export default function BookmarkPage() {
  const {
    entriesMeta,
    getText,
    ensureContentByIds,
    loading,
    error,
  } = useEntries();
  const { likedIds, isLiked, toggleLike } = useLikes();

  const favMeta = useMemo(() => {
    return entriesMeta
      .filter((meta) => likedIds.has(meta.id))
      .slice()
      .sort((a, b) => {
        const byDate = (b.date ?? "").localeCompare(a.date ?? "");
        if (byDate !== 0) return byDate;
        return a.pageTitle.localeCompare(b.pageTitle, "ko");
      });
  }, [entriesMeta, likedIds]);

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
      <section className="libraryHero">
        <div className="heroCopy">
          <h2 className="sectionTitle">저장함</h2>
          <span className="small">{favMeta.length}개</span>
        </div>
      </section>

      <section className="archiveCard">
        {loading && favMeta.length === 0 ? (
          <div className="small">로딩 중</div>
        ) : null}
        {error && favMeta.length === 0 ? (
          <div className="small">불러오기 실패: {error}</div>
        ) : null}

        {favMeta.length > 0 ? (
          <div className="archiveGrid">
            {visibleMeta.map((item) => {
              const text = getText(item.id);
              const authorLabel = getAuthorLabel(item.author, item.pageTitle);

              return (
                <article key={item.id} className="item archiveItem">
                  <div className="archiveItemTop">
                    <div className="entryTagGroup">
                      <div className="entrySource">
                        {item.pageTitle || "문장 보관함"}
                      </div>
                    </div>

                    <span className="small">{item.date ?? ""}</span>
                  </div>

                  <div className="archiveExcerpt">
                    {text === undefined ? "본문 로딩 중" : text}
                  </div>

                  <div className="archiveFooter">
                    <span className="small">
                      {authorLabel ? `— ${authorLabel}` : ""}
                    </span>
                    <button
                      type="button"
                      className={`btn ${isLiked(item.id) ? "saved" : ""}`}
                      onClick={() => toggleLike(item.id)}
                      aria-pressed={isLiked(item.id)}
                    >
                      해제
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
                  문장 더 보기
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
