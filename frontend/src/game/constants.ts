// Constantes do mundo — devem casar com o backend (internal/game, internal/maps).
export const TILE_SIZE = 32;

// Duração de um passo de 1 tile; igual ao StepInterval do servidor.
export const STEP_MS = 150;

// Raio de proximidade da conversa (game.ProximityRadius).
export const PROXIMITY_RADIUS = 5;

// Profundidade da camada "Above" (sempre acima dos avatares).
export const ABOVE_DEPTH = 100_000;

// Emotes: id (protocolo) → emoji exibido. Ordem = teclas 1–6.
export const EMOTES = [
  { id: "wave", emoji: "👋", label: "Oi" },
  { id: "heart", emoji: "❤️", label: "Amei" },
  { id: "party", emoji: "🎉", label: "Festa" },
  { id: "thumbsup", emoji: "👍", label: "Joinha" },
  { id: "question", emoji: "❓", label: "Dúvida" },
  { id: "laugh", emoji: "😂", label: "Risada" },
] as const;

// Quanto tempo um emote fica sobre a cabeça (o ❓ persiste até cancelar).
export const EMOTE_MS = 3000;
