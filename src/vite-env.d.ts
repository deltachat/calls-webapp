/// <reference types="vite/client" />

declare global {
  interface Window {
    calls: {
      startCall: (payload: string) => void;
      acceptCall: (payload: string) => void;
      endCall: () => void;
      getIceServers: () => string;
      getAvatar: () => string;
    };
  }
}

export {};
