import { create } from "zustand";
import { client, type ClientStatus } from "../net/client";
import type { ChatMessage, ChatScope, PlayerState } from "../net/messages";

export interface ChatEntry extends ChatMessage {
  id: number; // sequencial local, para keys do React
}

/** Objeto interativo ao alcance do próprio avatar (RF-OBJ-02). */
export interface NearbyObject {
  objectId: string;
  type: "iframe" | "image" | "video" | "note" | "link";
  title: string;
  url?: string;
  text?: string;
}

interface GameState {
  status: ClientStatus;
  selfId: string | null;
  mapId: string;
  players: Record<string, PlayerState>;
  chat: ChatEntry[];
  unreadChat: number; // mensagens recebidas com o painel fechado
  nearbyObject: NearbyObject | null;
}

const MAX_CHAT = 200;
let chatSeq = 0;

export const useGameStore = create<GameState>(() => ({
  status: "idle",
  selfId: null,
  mapId: "",
  players: {},
  chat: [],
  unreadChat: 0,
  nearbyObject: null,
}));

export function sendChat(scope: ChatScope, text: string) {
  const t = text.trim();
  if (t) client.chat(scope, t);
}

// Liga os eventos do cliente de rede à store (chamado uma vez no boot).
export function bindGameStore(isChatOpen: () => boolean) {
  client.on("status", (status) => useGameStore.setState({ status }));

  client.on("joined", (ack) => {
    const players: Record<string, PlayerState> = {};
    for (const p of ack.players) players[p.playerId] = p;
    useGameStore.setState({ selfId: ack.playerId, mapId: ack.mapId, players });
  });

  client.on("message", (msg) => {
    if (msg.type === "player_joined") {
      useGameStore.setState((s) => ({
        players: { ...s.players, [msg.player.playerId]: msg.player },
      }));
    } else if (msg.type === "player_left") {
      useGameStore.setState((s) => {
        const players = { ...s.players };
        delete players[msg.playerId];
        return { players };
      });
    } else if (msg.type === "movement") {
      useGameStore.setState((s) => {
        const players = { ...s.players };
        for (const m of msg.moves) {
          const p = players[m.playerId];
          if (p) players[m.playerId] = { ...p, x: m.x, y: m.y, dir: m.dir };
        }
        return { players };
      });
    } else if (msg.type === "teleport") {
      useGameStore.setState((s) => {
        const p = s.players[msg.playerId];
        if (!p) return s;
        return { players: { ...s.players, [msg.playerId]: { ...p, x: msg.x, y: msg.y } } };
      });
    } else if (msg.type === "chat") {
      useGameStore.setState((s) => {
        const entry: ChatEntry = { ...msg, id: ++chatSeq };
        const chat = [...s.chat, entry].slice(-MAX_CHAT);
        const own = msg.playerId === s.selfId;
        const unreadChat = isChatOpen() || own ? s.unreadChat : s.unreadChat + 1;
        return { chat, unreadChat };
      });
    }
  });
}
