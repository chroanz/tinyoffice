import { create } from "zustand";

/**
 * Estado global da aplicação (fora do canvas). Stores de jogo (jogadores,
 * chat, mídia) serão adicionadas nas Fases 1–3.
 */
interface AppState {
  backendVersion: string | null;
  setBackendVersion: (v: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  backendVersion: null,
  setBackendVersion: (backendVersion) => set({ backendVersion }),
}));
