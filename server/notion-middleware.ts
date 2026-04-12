import type { IncomingMessage, ServerResponse } from "node:http";
import {
  applyNotionCacheHeaders,
  getNotionPageText,
  getNotionTableRows,
} from "./notion-service";

type NextFn = (err?: unknown) => void;
type Handler = (req: IncomingMessage, res: ServerResponse, next: NextFn) => void;

function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export function notionApiMiddleware(): Handler[] {
  const tableHandler: Handler = async (req, res, next) => {
    const parsedUrl = new URL(req.url ?? "", "http://localhost");
    const match = parsedUrl.pathname.match(/^\/api\/notion\/table\/([a-f0-9-]+)/);
    if (!match) return next();

    const pageId = match[1];

    try {
      applyNotionCacheHeaders(res, "table");
      const rows = await getNotionTableRows(pageId);
      sendJson(res, rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      sendJson(res, { error: msg }, 500);
    }
  };

  const pageHandler: Handler = async (req, res, next) => {
    const parsedUrl = new URL(req.url ?? "", "http://localhost");
    const match = parsedUrl.pathname.match(/^\/api\/notion\/page\/([a-f0-9-]+)/);
    if (!match) return next();

    const pageId = match[1];
    const rootPageId = parsedUrl.searchParams.get("rootId") ?? "";

    if (!rootPageId) {
      sendJson(res, { error: "Missing root page id" }, 400);
      return;
    }

    try {
      applyNotionCacheHeaders(res, "page");
      const text = await getNotionPageText(rootPageId, pageId);
      sendJson(res, { text });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      sendJson(res, { error: msg }, 500);
    }
  };

  return [tableHandler, pageHandler];
}
