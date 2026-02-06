import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { notionApiMiddleware } from "./server/notion-middleware";

function notionPlugin(): Plugin {
  return {
    name: "notion-api",
    configureServer(server) {
      for (const handler of notionApiMiddleware()) {
        server.middlewares.use(handler);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), notionPlugin()],
});
