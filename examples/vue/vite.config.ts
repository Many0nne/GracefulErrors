import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue(),
    {
      name: "mock-error-routes",
      configureServer(server) {
        server.middlewares.use("/api/error", (req, res) => {
          const status = parseInt(req.url?.replace("/", "") ?? "500", 10);
          const code = isNaN(status) ? 500 : status;
          res.statusCode = code;
          res.end();
        });
      },
    },
  ],
  define: {
    // The library uses process.env.NODE_ENV; Vite doesn't polyfill process in
    // the browser, so we replace it statically at bundle time.
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "development",
    ),
  },
});
