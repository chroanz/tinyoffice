import { create } from "zustand";
import type { NearbyObject } from "./gameStore";

/** Estado da interface HTML por cima do canvas (painéis, modais). */
interface UIState {
  chatOpen: boolean;
  participantsOpen: boolean;
  helpOpen: boolean;
  emotesOpen: boolean;
  /** Objeto interativo aberto no modal (RF-OBJ-03). */
  openObject: NearbyObject | null;
  /** true enquanto um campo de texto tem foco — o mundo ignora o teclado. */
  typing: boolean;
  /** Pedido de foco no campo de chat (tecla Enter). */
  chatFocusSeq: number;
}

export const useUIStore = create<UIState>(() => ({
  chatOpen: false,
  participantsOpen: false,
  helpOpen: false,
  emotesOpen: false,
  openObject: null,
  typing: false,
  chatFocusSeq: 0,
}));

export const ui = {
  toggleChat: () => useUIStore.setState((s) => ({ chatOpen: !s.chatOpen })),
  openChat: () =>
    useUIStore.setState((s) => ({ chatOpen: true, chatFocusSeq: s.chatFocusSeq + 1 })),
  toggleParticipants: () => useUIStore.setState((s) => ({ participantsOpen: !s.participantsOpen })),
  toggleHelp: () => useUIStore.setState((s) => ({ helpOpen: !s.helpOpen })),
  toggleEmotes: () => useUIStore.setState((s) => ({ emotesOpen: !s.emotesOpen })),
  openObject: (obj: NearbyObject) => useUIStore.setState({ openObject: obj }),
  closeTop: () => {
    const s = useUIStore.getState();
    if (s.openObject) return useUIStore.setState({ openObject: null });
    if (s.helpOpen) return useUIStore.setState({ helpOpen: false });
    if (s.emotesOpen) return useUIStore.setState({ emotesOpen: false });
    if (s.chatOpen) return useUIStore.setState({ chatOpen: false });
    if (s.participantsOpen) return useUIStore.setState({ participantsOpen: false });
  },
};
