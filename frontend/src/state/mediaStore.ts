import { create } from "zustand";

interface MediaUIState {
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean; // compartilhando a própria tela
  connected: boolean; // conectado ao SFU
  hear: string[]; // ids que o servidor mandou ouvir/ver
  areaId: string; // área privada atual ("" = fora)
  spotlights: string[]; // quem está em tile spotlight (ouvido por todo o mapa)
  onSpotlight: boolean; // o próprio usuário está num spotlight
  speaking: string[]; // identidades falando agora (LiveKit ActiveSpeakers)
  version: number; // bump para re-render quando tracks mudam
}

export const useMediaStore = create<MediaUIState>(() => ({
  micOn: true,
  camOn: true,
  screenOn: false,
  connected: false,
  hear: [],
  areaId: "",
  spotlights: [],
  onSpotlight: false,
  speaking: [],
  version: 0,
}));
