// Constantes do mundo — devem casar com o backend (internal/game, internal/maps).
export const TILE_SIZE = 32;

// Duração de um passo de 1 tile; igual ao StepInterval do servidor.
export const STEP_MS = 150;

// Raio de proximidade da conversa (game.ProximityRadius).
export const PROXIMITY_RADIUS = 5;

// Profundidade da camada "Above" (sempre acima dos avatares).
export const ABOVE_DEPTH = 100_000;

// Emotes: id (protocolo) → rótulo. Ordem = teclas 1–6 = colunas dos
// sheets em pixel art assets/ui/emotes.png e emote-bubbles.png.
export const EMOTES = [
  { id: "wave", label: "Oi" },
  { id: "heart", label: "Amei" },
  { id: "party", label: "Festa" },
  { id: "thumbsup", label: "Joinha" },
  { id: "question", label: "Dúvida" },
  { id: "laugh", label: "Risada" },
] as const;

// Quanto tempo um emote fica sobre a cabeça (o ❓ persiste até cancelar).
export const EMOTE_MS = 3000;
