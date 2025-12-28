type Tab = "quote" | "journal";

export default function Tabs({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div className="tabsLeft">
      <button
        className={`chip ${tab === "quote" ? "on" : ""}`}
        onClick={() => onChange("quote")}
      >
        문장
      </button>
      <button
        className={`chip ${tab === "journal" ? "on" : ""}`}
        onClick={() => onChange("journal")}
      >
        기록
      </button>
    </div>
  );
}
