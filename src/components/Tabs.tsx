type Tab = "quote" | "journal";

export default function Tabs({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div className="tabsLeft" role="tablist" aria-label="글 종류 전환">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "quote"}
        className={`chip ${tab === "quote" ? "on" : ""}`}
        onClick={() => onChange("quote")}
      >
        문장
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "journal"}
        className={`chip ${tab === "journal" ? "on" : ""}`}
        onClick={() => onChange("journal")}
      >
        기록
      </button>
    </div>
  );
}
