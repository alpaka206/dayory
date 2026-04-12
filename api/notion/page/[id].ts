import {
  applyNotionCacheHeaders,
  getNotionPageText,
} from "../../../server/notion-service";

type ApiRequest = {
  method?: string;
  query?: { id?: string | string[]; rootId?: string | string[] };
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
  const rootPageId = String(req.query?.rootId ?? "");
  if (!pageId) return sendJson(res, { error: "Missing page id" }, 400);
  if (!rootPageId) return sendJson(res, { error: "Missing root page id" }, 400);

  try {
    applyNotionCacheHeaders(res, "page");
    const text = await getNotionPageText(rootPageId, pageId);
    return sendJson(res, { text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return sendJson(res, { error: msg }, 500);
  }
}
