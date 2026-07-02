// Tipos do protocolo em tempo real — espelham proto/pixelrooms/v1 e
// backend/internal/protocol (transporte JSON na Fase 1).

export type Direction = "down" | "up" | "left" | "right";

export interface PlayerState {
  playerId: string;
  name: string;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
}

export interface Move {
  playerId: string;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
}

export interface JoinAck {
  playerId: string;
  mapId: string;
  players: PlayerState[];
}

export type ServerMessage =
  | ({ type: "join_ack" } & JoinAck)
  | { type: "player_joined"; player: PlayerState }
  | { type: "player_left"; playerId: string }
  | { type: "movement"; tick: number; moves: Move[] }
  | { type: "error"; code: string; message: string }
  | { type: "pong"; t: number; serverTime: number };

export type ClientMessage =
  | { type: "join"; name: string; map?: string }
  | { type: "move"; dir: Direction }
  | { type: "ping"; t: number };
