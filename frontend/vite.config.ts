import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Forwards /rpc-hardhat → http://127.0.0.1:8545 (same as the old Vite proxy)
 * but logs at most once when Hardhat is not running, instead of spamming
 * "[vite] http proxy error: ECONNREFUSED" on every JSON-RPC poll.
 */
function hardhatRpcProxyPlugin(): Plugin {
  let warned = false;

  function readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  return {
    name: "hardhat-rpc-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? "";
        if (!rawUrl.startsWith("/rpc-hardhat")) {
          next();
          return;
        }

        void (async () => {
          let body = Buffer.alloc(0);
          if (req.method !== "GET" && req.method !== "HEAD") {
            body = await readBody(req);
          }

          const u = new URL(rawUrl, "http://127.0.0.1");
          const path = (u.pathname.replace(/^\/rpc-hardhat/, "") || "/") + u.search;

          const headers: http.OutgoingHttpHeaders = { ...req.headers };
          delete headers.connection;
          headers.host = "127.0.0.1:8545";

          const proxyReq = http.request(
            {
              hostname: "127.0.0.1",
              port: 8545,
              path,
              method: req.method,
              headers,
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
              proxyRes.pipe(res);
            }
          );

          proxyReq.on("error", () => {
            if (!warned) {
              warned = true;
              server.config.logger.warn(
                "\n[DealLock] Hardhat node is not running on localhost:8545.\n" +
                  "  • Local chain: run `npx hardhat node` from the repo root, or\n" +
                  "  • Sepolia MVP: switch MetaMask to Sepolia (no local node needed).\n"
              );
            }
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: null,
                  error: {
                    code: -32000,
                    message:
                      "No JSON-RPC on localhost:8545. Start `npx hardhat node` or use Sepolia in MetaMask.",
                  },
                })
              );
            }
          });

          if (body.length) proxyReq.write(body);
          proxyReq.end();
        })().catch((e: unknown) => {
          server.config.logger.error(String(e));
          if (!(res as ServerResponse).headersSent) {
            next();
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), hardhatRpcProxyPlugin()],
  server: {
    port: 5173,
  },
});
