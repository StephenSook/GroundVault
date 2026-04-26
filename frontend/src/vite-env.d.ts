/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUD_API_TOKEN?: string;
  readonly VITE_FRED_API_KEY?: string;
  readonly VITE_CHAINGPT_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
