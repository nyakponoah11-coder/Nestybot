import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

function apiMiddlewarePlugin() {
  return {
    name: "api-middleware",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
        const pathname = parsedUrl.pathname;
        if (pathname.startsWith("/api/")) {
          let funcName = pathname.replace(/^\/api\//, "").replace(/\/$/, "");
          if (funcName === "whatsapp-bot" && fs.existsSync(path.resolve(__dirname, "api/_whatsapp-bot.ts"))) {
            funcName = "_whatsapp-bot";
          } else if (funcName === "whatsapp-orders" && fs.existsSync(path.resolve(__dirname, "api/_whatsapp-orders.ts"))) {
            funcName = "_whatsapp-orders";
          } else if (funcName.startsWith("admin-") && !fs.existsSync(path.resolve(__dirname, `api/${funcName}.ts`))) {
            funcName = "admin";
          }
          const filePath = path.resolve(__dirname, `api/${funcName}.ts`);
          if (fs.existsSync(filePath)) {
            let chunks: any[] = [];
            req.on("data", (chunk: any) => chunks.push(chunk));
            req.on("end", async () => {
              req.query = Object.fromEntries(parsedUrl.searchParams.entries());
              const rawBody = Buffer.concat(chunks).toString("utf-8");
              if (rawBody) {
                try {
                  req.body = JSON.parse(rawBody);
                } catch {
                  req.body = rawBody;
                }
              } else {
                req.body = {};
              }

              // Polyfill response helpers
              if (!res.status) {
                res.status = (code: number) => {
                  res.statusCode = code;
                  return res;
                };
              }
              if (!res.json) {
                res.json = (data: any) => {
                  if (!res.headersSent) {
                    res.setHeader("Content-Type", "application/json");
                  }
                  res.end(JSON.stringify(data));
                  return res;
                };
              }
              if (!res.send) {
                res.send = (data: any) => {
                  if (typeof data === "object") return res.json(data);
                  res.end(data);
                  return res;
                };
              }

              try {
                const mod = await server.ssrLoadModule(filePath);
                if (typeof mod.default === "function") {
                  await mod.default(req, res);
                  return;
                }
              } catch (err: any) {
                console.error(`API execution error on ${pathname}:`, err);
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: err?.message || "Internal server error" }));
                }
                return;
              }
            });
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), apiMiddlewarePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("sonner")) {
              return "vendor-ui";
            }
            if (id.includes("@supabase") || id.includes("@tanstack")) {
              return "vendor-data";
            }
            if (id.includes("recharts")) {
              return "vendor-charts";
            }
          }
        },
      },
    },
  },
});

