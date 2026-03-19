import { useEffect, useMemo, useState } from "react";
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
      .filter((m) => likedIds.has(m.id))
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
    void ensureContentByIds(visibleMeta.map((f) => f.id));
  }, [visibleMeta, ensureContentByIds]);

  return (
    <div className="container">
      <section className="card">
        {favMeta.length > 0 ? (
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: 12 }}
          >
            <div className="small">저장한 글 {favMeta.length}개</div>
            <div className="small">
              {Math.min(visibleMeta.length, favMeta.length)} / {favMeta.length}
            </div>
          </div>
        ) : null}

        {loading && favMeta.length === 0 ? (
          <div className="small">불러오는 중…</div>
        ) : null}
        {error && favMeta.length === 0 ? (
          <div className="small">불러오기 실패: {error}</div>
        ) : null}

        {favMeta.length === 0 ? (
          <div className="small">아직 저장한 글이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {visibleMeta.map((f) => {
              const text = getText(f.id);

              return (
                <div key={f.id} className="item">
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <span className="small">
                      {f.type === "quote" ? "문장" : "기록"}
                    </span>
                    <span className="small">{f.date ?? ""}</span>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      whiteSpace: "pre-line",
                      fontSize: "14px",
                      fontWeight: 650,
                      lineHeight: 1.7,
                    }}
                  >
                    {text === undefined ? "불러오는 중…" : text}
                  </div>

                  <div
                    className="row"
                    style={{ justifyContent: "space-between", marginTop: 12 }}
                  >
                    <span className="small">
                      {f.author ? `— ${f.author}` : ""}
                    </span>
                    <button className="btn" onClick={() => toggleLike(f.id)}>
                      {isLiked(f.id) ? "저장 취소" : "저장"}
                    </button>
                  </div>
                </div>
              );
            })}

            {visibleCount < favMeta.length ? (
              <button
                className="btn"
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + LOAD_MORE_COUNT, favMeta.length)
                  )
                }
              >
                글 더 보기
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
