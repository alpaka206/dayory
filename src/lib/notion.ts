import type { EntryMeta, EntryType } from "./types";

const DB_PAGE_ID = import.meta.env.VITE_NOTION_PAGE_ID as string | undefined;

const API_BASE = "https://notion-api.splitbee.io";

const TITLE_KEY = "title";
const AUTHOR_KEY = "author";
const DATE_KEY = "date";
const TYPE_KEY = "type";

function normStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normType(v: unknown): EntryType {
  const t = normStr(v);
  return t === "journal" ? "journal" : "quote";
}

type TableRow = Record<string, unknown>;

export async function fetchEntryMetaList(): Promise<EntryMeta[]> {
  if (!DB_PAGE_ID) throw new Error("VITE_NOTION_PAGE_ID가 비어있어.");

  const url = `${API_BASE.replace(
    /\/$/,
    ""
  )}/v1/table/${DB_PAGE_ID}?t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Notion table fetch failed: ${res.status}`);

  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Notion table 응답 형식이 이상해.");

  const rows = json as TableRow[];

  return rows
    .map((r) => {
      const id = normStr(r.id);
      const type = normType(r[TYPE_KEY]);
      const author = normStr(r[AUTHOR_KEY]);
      const date = normStr(r[DATE_KEY]);
      const pageTitle = normStr(r[TITLE_KEY]);

      return { id, type, author, date, pageTitle } satisfies EntryMeta;
    })
    .filter((m) => m.id.length > 0);
}

type TitleProp = Array<[string, ...unknown[]]>;

type NotionBlockValue = {
  id?: string;
  type?: string;
  properties?: {
    title?: TitleProp;
  };
  content?: string[];
};

type NotionBlockEntry = {
  value?: NotionBlockValue;
  role?: string;
};

type BlockMap = Record<string, NotionBlockEntry>;

function readTitleText(titleProp: unknown): string {
  if (!Array.isArray(titleProp)) return "";
  const parts: string[] = [];
  for (const item of titleProp) {
    if (Array.isArray(item) && typeof item[0] === "string") parts.push(item[0]);
  }
  return parts.join("").trim();
}

function extractPlainTextFromBlockMap(
  blockMap: BlockMap,
  pageId: string
): string {
  const page = blockMap[pageId]?.value;
  if (!page) return "";

  const lines: string[] = [];

  const contentIds = page.content ?? [];
  for (const id of contentIds) {
    const v = blockMap[id]?.value;
    if (!v) continue;

    const text = readTitleText(v.properties?.title);

    if (text) lines.push(text);
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchPageContent(pageId: string): Promise<string> {
  const url = `${API_BASE.replace(
    /\/$/,
    ""
  )}/v1/page/${pageId}?t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Notion page fetch failed: ${res.status}`);

  const json: unknown = await res.json();
  if (!json || typeof json !== "object")
    throw new Error("Notion page 응답 형식이 이상해.");

  const blockMap = json as BlockMap;

  return extractPlainTextFromBlockMap(blockMap, pageId);
}
