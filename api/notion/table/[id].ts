import {
  applyNotionCacheHeaders,
  getNotionTableRows,
} from "../../../server/notion-service.js";

type ApiRequest = {
  method?: string;
  query?: { id?: string | string[] };
};

type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(data: unknown): void };
};

function sendJson(res: ApiResponse, data: unknown, status = 200) {
  res.status(status).json(data);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, { error: "Method Not Allowed" }, 405);
  }

  const pageId = String(req.query?.id ?? "");
  if (!pageId) return sendJson(res, { error: "Missing page id" }, 400);

  try {
    applyNotionCacheHeaders(res, "table");
    const rows = await getNotionTableRows(pageId);
    return sendJson(res, rows);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendJson(res, { error: msg }, 500);
  }
}
