import { useEffect, useMemo } from "react";
import { useEntries } from "../hooks/useEntries";
import { useLikes } from "../hooks/useLikes";

export default function Favorites() {
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
  const favMeta = useMemo(
    () => allMeta.filter((m) => likedIds.has(m.id)),
    [allMeta, likedIds]
  );

  useEffect(() => {
    if (favMeta.length === 0) return;
    void ensureContentByIds(favMeta.map((f) => f.id));
  }, [favMeta, ensureContentByIds]);

  return (
    <div className="container">
      <section className="card">
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
            {favMeta.map((f) => {
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
          </div>
        )}
      </section>
    </div>
  );
}
