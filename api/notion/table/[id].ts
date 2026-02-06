import { NotionAPI } from "notion-client";

const api = new NotionAPI();

type BlockValue = {
  id?: string;
  type?: string;
  parent_table?: string;
  properties?: Record<string, unknown>;
  content?: string[];
};

type SchemaEntry = { name: string; type: string };

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

    const schemaInfo = resolveSchema(recordMap);
    if (!schemaInfo) {
      return sendJson(res, { error: "No collection schema found" }, 500);
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

    return sendJson(res, rows);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendJson(res, { error: msg }, 500);
  }
}
