/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Comma-separated y-webrtc signaling server URLs. */
  readonly VITE_SIGNALING?: string
  /** JSON array of RTCIceServer objects (STUN/TURN). */
  readonly VITE_ICE_SERVERS?: string
  /** "wandbox" (default) or "piston": which service runs C, C++ and Java. */
  readonly VITE_RUNNER?: string
  /** Wandbox base URL, default https://wandbox.org */
  readonly VITE_WANDBOX_URL?: string
  /** Piston API base URL, e.g. https://emkc.org/api/v2/piston */
  readonly VITE_PISTON_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
