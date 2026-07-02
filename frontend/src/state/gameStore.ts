import { create } from "zustand";
import { client, type ClientStatus } from "../net/client";
import type { PlayerState } from "../net/messages";

interface GameState {
  status: ClientStatus;
  selfId: string | null;
  players: Record<string, PlayerState>;
}

export const useGameStore = create<GameState>(() => ({
  status: "idle",
  selfId: null,
  players: {},
}));

// Liga os eventos do cliente de rede à store (chamado uma vez no boot).
export function bindGameStore() {
  client.on("status", (status) => useGameStore.setState({ status }));

  client.on("joined", (ack) => {
    const players: Record<string, PlayerState> = {};
    for (const p of ack.players) players[p.playerId] = p;
    useGameStore.setState({ selfId: ack.playerId, players });
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
    }
  });
}
