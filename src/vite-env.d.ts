/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Comma-separated y-webrtc signaling server URLs. */
  readonly VITE_SIGNALING?: string
  /** Piston API base URL, e.g. https://emkc.org/api/v2/piston */
  readonly VITE_PISTON_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
