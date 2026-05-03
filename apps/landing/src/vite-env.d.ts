/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
