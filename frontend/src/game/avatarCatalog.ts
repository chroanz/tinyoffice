import type { AvatarConfig } from "../net/messages";

/**
 * Catálogo de camadas do avatar. Espelha backend/internal/game/avatar.go
 * (o servidor é quem valida) e assets/avatars/manifest.json (os sheets).
 * Cada item: id estável, rótulo e cor para o seletor.
 */
export interface AvatarItem {
  id: string;
  label: string;
  color: string;
}

export const AVATAR_LAYERS = ["body", "top", "hair"] as const;
export type AvatarLayer = (typeof AVATAR_LAYERS)[number];

export const AVATAR_CATALOG: Record<AvatarLayer, AvatarItem[]> = {
  body: [
    { id: "light", label: "Clara", color: "#edbd94" },
    { id: "medium", label: "Média", color: "#c68c5e" },
    { id: "dark", label: "Escura", color: "#7a4e32" },
  ],
  top: [
    { id: "blue", label: "Azul", color: "#4f86c6" },
    { id: "green", label: "Verde", color: "#3f9a5a" },
    { id: "red", label: "Vermelho", color: "#c84a4a" },
    { id: "yellow", label: "Amarelo", color: "#d8b83a" },
    { id: "purple", label: "Roxo", color: "#8a5ab8" },
    { id: "white", label: "Branco", color: "#e8e8e8" },
  ],
  hair: [
    { id: "brown", label: "Castanho", color: "#5a3b28" },
    { id: "black", label: "Preto", color: "#1e1a1a" },
    { id: "blonde", label: "Loiro", color: "#e0c060" },
    { id: "red", label: "Ruivo", color: "#b03a2a" },
    { id: "blue", label: "Azul", color: "#3a6ac8" },
  ],
};

export const DEFAULT_AVATAR: AvatarConfig = { body: "light", hair: "brown", top: "blue" };

/** Chave de textura no Phaser para um item de camada. */
export const textureKey = (layer: AvatarLayer, id: string) => `avatar-${layer}-${id}`;

/** URL do sheet de um item. */
export const sheetURL = (layer: AvatarLayer, id: string) => `/assets/avatars/${layer}/${id}.png`;

/** Garante que o avatar só use ids conhecidos (fallback para o padrão). */
export function normalizeAvatar(a: Partial<AvatarConfig> | null | undefined): AvatarConfig {
  const pick = (layer: AvatarLayer, v: string | undefined) =>
    AVATAR_CATALOG[layer].some((i) => i.id === v) ? (v as string) : DEFAULT_AVATAR[layer];
  return { body: pick("body", a?.body), top: pick("top", a?.top), hair: pick("hair", a?.hair) };
}
