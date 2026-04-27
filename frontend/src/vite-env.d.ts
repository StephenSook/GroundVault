/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUD_API_TOKEN?: string;
  readonly VITE_FRED_API_KEY?: string;
  readonly VITE_CHAINGPT_API_KEY?: string;
  // When set to "1", the frontend honors the demo query-string bypasses
  // (?status=, ?wallet=mock, ?role=memo). Default off so a hardened
  // production build cannot be put into a demo-mock state by URL alone.
  readonly VITE_ALLOW_DEMO_BYPASSES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
