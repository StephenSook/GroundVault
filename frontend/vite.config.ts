import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Allow Vite dev server to read the sibling `audits/` directory at
    // the repo root. The /audits route uses `import.meta.glob` against
    // those .md files; without this the dev server returns 403 for
    // anything outside the project root. Production build inlines the
    // strings at compile time, so this only affects `vite dev`.
    fs: {
      allow: [".."],
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
