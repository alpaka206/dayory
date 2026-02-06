import type { IncomingMessage, ServerResponse } from "node:http";
import { NotionAPI } from "notion-client";

const api = new NotionAPI();

type NextFn = (err?: unknown) => void;
type Handler = (req: IncomingMessage, res: ServerResponse, next: NextFn) => void;

type BlockValue = {
  id?: string;
  type?: string;
  parent_table?: string;
  properties?: Record<string, unknown>;
  content?: string[];
};

type SchemaEntry = { name: string; type: string };

// notion-client returns different nesting depths:
//   DB page:       block[id] = { spaceId, value: { value: {...}, role } }
//   Content page:  block[id] = { value: { id, type, ... } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveBlockValue(entry: any): BlockValue | undefined {
  const v = entry?.value;
  if (!v) return undefined;
  if (v.value && typeof v.value === "object" && v.value.id) return v.value as BlockValue;
  if (v.id) return v as BlockValue;
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveSchema(recordMap: any): {
  schema: Record<string, SchemaEntry>;
  schemaKeyByName: Record<string, string>;
} | null {
  const colMap = recordMap.collection;
  if (!colMap) return null;

  for (const colData of Object.values(colMap)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = colData as any;
    const schema = (c?.value?.value?.schema ?? c?.value?.schema) as
      | Record<string, SchemaEntry>
      | undefined;
    if (!schema) continue;

    const schemaKeyByName: Record<string, string> = {};
    for (const [key, def] of Object.entries(schema)) {
      schemaKeyByName[def.name.toLowerCase()] = key;
    }
    return { schema, schemaKeyByName };
  }
  return null;
}

function readTitleText(titleProp: unknown): string {
  if (!Array.isArray(titleProp)) return "";
  const parts: string[] = [];
  for (const item of titleProp) {
    if (Array.isArray(item) && typeof item[0] === "string") parts.push(item[0]);
  }
  return parts.join("").trim();
}

function readDateProp(dateProp: unknown): string {
  if (!Array.isArray(dateProp)) return "";
  for (const item of dateProp) {
    if (!Array.isArray(item)) continue;
    const formats = item[1];
    if (!Array.isArray(formats)) continue;
    for (const fmt of formats) {
      if (Array.isArray(fmt) && fmt[0] === "d" && fmt[1]?.start_date) {
        return fmt[1].start_date as string;
      }
    }
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRowBlockIds(recordMap: any): string[] {
  const cq = recordMap.collection_query;
  if (!cq) return [];

  for (const views of Object.values(cq)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const viewData of Object.values(views as any)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = (viewData as any)?.collection_group_results?.blockIds;
      if (ids && ids.length > 0) return ids as string[];
    }
  }
  return [];
}

function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function toNormalizedId(raw: string): string {
  const s = raw.replace(/-/g, "");
  if (s.length !== 32) return raw;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function notionApiMiddleware(): Handler[] {
  const tableHandler: Handler = async (req, res, next) => {
    const url = req.url ?? "";
    const match = url.match(/^\/api\/notion\/table\/([a-f0-9-]+)/);
    if (!match) return next();

    const pageId = match[1];

    try {
      const recordMap = await api.getPage(pageId);

      const schemaInfo = resolveSchema(recordMap);
      if (!schemaInfo) {
        sendJson(res, { error: "No collection schema found" }, 500);
        return;
      }

      const { schemaKeyByName } = schemaInfo;
      const typeKey = schemaKeyByName["type"];
      const authorKey = schemaKeyByName["author"];
      const dateKey = schemaKeyByName["date"];

      const rowIds = getRowBlockIds(recordMap);
      const blockMap = recordMap.block ?? {};

      const rows = rowIds
        .map((id: string) => {
          const v = resolveBlockValue(blockMap[id]);
          if (!v) return null;
          const props = v.properties ?? {};

          const type = readTitleText(typeKey ? props[typeKey] : undefined);
          const author = readTitleText(authorKey ? props[authorKey] : undefined);
          const date = dateKey ? readDateProp(props[dateKey]) : "";
          const pageTitle = readTitleText(props["title"]);

          return {
            id: (v.id ?? id).replace(/-/g, ""),
            type: type || "quote",
            author,
            date,
            pageTitle,
          };
        })
        .filter(Boolean);

      sendJson(res, rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      sendJson(res, { error: msg }, 500);
    }
  };

  const pageHandler: Handler = async (req, res, next) => {
    const url = req.url ?? "";
    const match = url.match(/^\/api\/notion\/page\/([a-f0-9-]+)/);
    if (!match) return next();

    const pageId = match[1];

    try {
      const recordMap = await api.getPage(pageId);
      const blockMap = recordMap.block ?? {};

      const normalizedId = toNormalizedId(pageId);
      const page = resolveBlockValue(blockMap[normalizedId]) ?? resolveBlockValue(blockMap[pageId]);

      if (!page) {
        sendJson(res, { text: "" });
        return;
      }

      const lines: string[] = [];
      for (const childId of page.content ?? []) {
        const child = resolveBlockValue(blockMap[childId]);
        if (!child) continue;
        const text = readTitleText(child.properties?.["title"]);
        if (text) lines.push(text);
      }

      const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      sendJson(res, { text });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      sendJson(res, { error: msg }, 500);
    }
  };

  return [tableHandler, pageHandler];
}
