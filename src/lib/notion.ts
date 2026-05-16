import type { EntryMeta } from "./types";

const DB_PAGE_ID = import.meta.env.VITE_NOTION_PAGE_ID as string | undefined;

function shouldHideRow(type: unknown): boolean {
  const normalized = typeof type === "string" ? type.trim().toLowerCase() : "";
  return normalized === "journal" || normalized === "journals" || normalized === "기록";
}

type RawRow = {
  id: string;
  type: string;
  author: string;
  date: string;
  pageTitle: string;
};

export async function fetchEntryMetaList(): Promise<EntryMeta[]> {
  if (!DB_PAGE_ID) throw new Error("VITE_NOTION_PAGE_ID가 비어 있습니다.");

  const res = await fetch(`/api/notion/table/${DB_PAGE_ID}`);
  if (!res.ok) throw new Error(`Notion table fetch failed: ${res.status}`);

  const json: unknown = await res.json();
  if (!Array.isArray(json)) {
    throw new Error("Notion table 응답 형식이 이상합니다.");
  }

  return (json as RawRow[])
    .filter((r) => !shouldHideRow(r.type))
    .map((r) => ({
      id: r.id ?? "",
      author: r.author ?? "",
      date: r.date ?? "",
      pageTitle: r.pageTitle ?? "",
    }))
    .filter((m) => m.id.length > 0);
}

export async function fetchPageContent(pageId: string): Promise<string> {
  if (!DB_PAGE_ID) throw new Error("VITE_NOTION_PAGE_ID가 비어 있습니다.");

  const params = new URLSearchParams({
    rootId: DB_PAGE_ID,
  });
  const res = await fetch(`/api/notion/page/${pageId}?${params.toString()}`);
  if (!res.ok) throw new Error(`Notion page fetch failed: ${res.status}`);

  const json = (await res.json()) as { text?: string; error?: string };
  if (json.error) throw new Error(json.error);

  return json.text ?? "";
}
