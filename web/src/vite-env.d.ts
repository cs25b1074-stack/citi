/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODE?: string;
  readonly VITE_GATEWAY_WS?: string;
  readonly VITE_GATEWAY_HTTP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
