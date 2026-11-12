// Tipos do protocolo em tempo real — espelham proto/pixelrooms/v1 e
// backend/internal/protocol (transporte JSON na Fase 1).

export type Direction = "down" | "up" | "left" | "right";

export type ChatScope = "nearby" | "map";

/** Escolha de camadas do avatar (ids do manifesto de avatares). */
export interface AvatarConfig {
  body: string;
  hair: string;
  top: string;
}

export interface PlayerState {
  playerId: string;
  name: string;
  avatar: AvatarConfig;
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

export interface MediaState {
  url?: string;
  token?: string;
  hear?: string[];
  areaId?: string;
  spotlights?: string[];
  spotlight?: boolean;
}

export interface ChatMessage {
  playerId: string;
  name: string;
  scope: ChatScope;
  text: string;
  at: number;
}

export type EmoteId = "wave" | "heart" | "party" | "thumbsup" | "question" | "laugh" | "clear";

export type ServerMessage =
  | ({ type: "join_ack" } & JoinAck)
  | { type: "player_joined"; player: PlayerState }
  | { type: "player_left"; playerId: string }
  | { type: "movement"; tick: number; moves: Move[] }
  | { type: "teleport"; playerId: string; x: number; y: number }
  | ({ type: "media" } & MediaState)
  | ({ type: "chat" } & ChatMessage)
  | { type: "emote"; playerId: string; emote: EmoteId }
  | { type: "error"; code: string; message: string }
  | { type: "pong"; t: number; serverTime: number };

export type ClientMessage =
  | { type: "join"; name: string; map?: string; avatar?: AvatarConfig }
  | { type: "move"; dir: Direction }
  | { type: "chat"; scope: ChatScope; text: string }
  | { type: "emote"; emote: EmoteId }
  | { type: "ping"; t: number };
