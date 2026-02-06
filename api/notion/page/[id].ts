import { NotionAPI } from "notion-client";

const api = new NotionAPI();

type BlockValue = {
  id?: string;
  type?: string;
  parent_table?: string;
  properties?: Record<string, unknown>;
  content?: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveBlockValue(entry: any): BlockValue | undefined {
  const v = entry?.value;
  if (!v) return undefined;
  if (v.value && typeof v.value === "object" && v.value.id) return v.value as BlockValue;
  if (v.id) return v as BlockValue;
  return undefined;
}

function readTitleText(titleProp: unknown): string {
  if (!Array.isArray(titleProp)) return "";
  const parts: string[] = [];
  for (const item of titleProp) {
    if (Array.isArray(item) && typeof item[0] === "string") parts.push(item[0]);
  }
  return parts.join("").trim();
}

function toNormalizedId(raw: string): string {
  const s = raw.replace(/-/g, "");
  if (s.length !== 32) return raw;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function sendJson(res: any, data: unknown, status = 200) {
  res.status(status).json(data);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, { error: "Method Not Allowed" }, 405);
  }

  const pageId = String(req.query?.id ?? "");
  if (!pageId) return sendJson(res, { error: "Missing page id" }, 400);

  try {
    const recordMap = await api.getPage(pageId);
    const blockMap = recordMap.block ?? {};

    const normalizedId = toNormalizedId(pageId);
    const page = resolveBlockValue(blockMap[normalizedId]) ?? resolveBlockValue(blockMap[pageId]);

    if (!page) {
      return sendJson(res, { text: "" });
    }

    const lines: string[] = [];
    for (const childId of page.content ?? []) {
      const child = resolveBlockValue(blockMap[childId]);
      if (!child) continue;
      const text = readTitleText(child.properties?.["title"]);
      if (text) lines.push(text);
    }

    const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return sendJson(res, { text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendJson(res, { error: msg }, 500);
  }
}
