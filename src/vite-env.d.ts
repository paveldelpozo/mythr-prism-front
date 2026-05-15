/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REMOTE_BACKEND_URL?: string;
  readonly VITE_FULL_CONTROL_API_URL?: string;
  readonly VITE_FULL_CONTROL_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
