import type { AvatarConfig } from "../net/messages";
import {
  BAG_COLORS,
  BAG_STYLES,
  BOTTOM_COLORS,
  BOTTOM_STYLES,
  HAT_COLORS,
  HAT_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  SHEET,
  SKIN_COLORS,
  TOP_COLORS,
  TOP_STYLES,
  type AvatarColor,
  type AvatarStyle,
} from "./avatarCatalog.gen";

/**
 * Catálogo do avatar paper-doll. As opções vêm de avatarCatalog.gen.ts,
 * gerado por backend/cmd/genassets junto com os sheets (o servidor valida
 * contra a mesma lista em avatar_catalog_gen.go).
 *
 * Ids: body = cor da pele; demais camadas = "<estilo>-<cor>" (ou "none"
 * para sem cabelo).
 */
export { SHEET };
export type { AvatarColor, AvatarStyle };

/** Ordem de composição (de baixo para cima). */
/** Ordem de composição (de baixo para cima). De costas, a bolsa sobe para o topo. */
export const AVATAR_LAYERS = ["body", "bottom", "top", "bag", "hair", "hat"] as const;
export type AvatarLayer = (typeof AVATAR_LAYERS)[number];

export interface LayerOptions {
  styles: AvatarStyle[];
  colors: AvatarColor[];
}

export const AVATAR_OPTIONS: Record<AvatarLayer, LayerOptions> = {
  body: { styles: [], colors: SKIN_COLORS },
  bottom: { styles: BOTTOM_STYLES, colors: BOTTOM_COLORS },
  top: { styles: TOP_STYLES, colors: TOP_COLORS },
  hair: { styles: [{ id: "none", label: "Estilo 0" }, ...HAIR_STYLES], colors: HAIR_COLORS },
  hat: { styles: [{ id: "none", label: "Estilo 0" }, ...HAT_STYLES], colors: HAT_COLORS },
  bag: { styles: [{ id: "none", label: "Estilo 0" }, ...BAG_STYLES], colors: BAG_COLORS },
};

/** Todos os ids válidos de uma camada (um sheet por id). */
export function layerIds(layer: AvatarLayer): string[] {
  const { styles, colors } = AVATAR_OPTIONS[layer];
  if (layer === "body") return colors.map((c) => c.id);
  const ids: string[] = [];
  for (const s of styles) {
    if (s.id === "none") ids.push("none");
    else for (const c of colors) ids.push(`${s.id}-${c.id}`);
  }
  return ids;
}

export const ALL_LAYER_IDS: Record<AvatarLayer, string[]> = {
  body: layerIds("body"),
  bottom: layerIds("bottom"),
  top: layerIds("top"),
  hair: layerIds("hair"),
  hat: layerIds("hat"),
  bag: layerIds("bag"),
};

/**
 * Id do sheet de uma camada para um avatar: com chapéu, o cabelo usa a
 * variante "@hat" (gerada sem os fios que ficariam sob o chapéu).
 */
export function sheetId(layer: AvatarLayer, a: AvatarConfig): string {
  if (layer === "hair" && a.hair !== "none" && a.hat !== "none") return `${a.hair}@hat`;
  return a[layer];
}

/** Todos os sheets a carregar (inclui as variantes de cabelo sob chapéu). */
export const ALL_SHEETS: { layer: AvatarLayer; id: string }[] = AVATAR_LAYERS.flatMap((layer) => {
  const ids = ALL_LAYER_IDS[layer].filter((id) => id !== "none");
  const extra = layer === "hair" ? ids.map((id) => `${id}@hat`) : [];
  return [...ids, ...extra].map((id) => ({ layer, id }));
});

/** Separa "estilo-cor" (body: só cor). */
export function splitId(layer: AvatarLayer, id: string): { style: string; color: string } {
  if (layer === "body") return { style: "", color: id };
  if (id === "none") return { style: "none", color: "" };
  const i = id.indexOf("-");
  return { style: id.slice(0, i), color: id.slice(i + 1) };
}

export function joinId(layer: AvatarLayer, style: string, color: string): string {
  if (layer === "body") return color;
  if (style === "none") return "none";
  return `${style}-${color || AVATAR_OPTIONS[layer].colors[0].id}`;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  body: "tone2",
  bottom: "pants-denim",
  top: "tee-blue",
  hair: "short-brown",
  hat: "none",
  bag: "none",
};

/**
 * Visuais prontos para começar (o usuário ajusta depois). Rótulos são só
 * números — nada de nomes que associem visual a etnia, gênero ou estilo.
 */
export const AVATAR_PRESETS: { id: string; label: string; avatar: AvatarConfig }[] = [
  { body: "tone2", bottom: "pants-black", top: "jacket-red", hair: "short-black", hat: "cap-red", bag: "backpack-yellow" },
  { body: "tone3", bottom: "skirt-wine", top: "tee-pink", hair: "long-black", hat: "none", bag: "satchel-purple" },
  { body: "tone1", bottom: "shorts-denim", top: "tank-yellow", hair: "ponytail-blonde", hat: "cap-pink", bag: "backpack-teal" },
  { body: "tone5", bottom: "shorts-khaki", top: "hoodie-green", hair: "curly-black", hat: "beanie-blue", bag: "backpack-red" },
  { body: "tone4", bottom: "skirt-black", top: "jacket-white", hair: "bun-auburn", hat: "none", bag: "satchel-black" },
  { body: "tone2", bottom: "pants-denim", top: "tee-blue", hair: "bob-pink", hat: "bucket-white", bag: "none" },
  { body: "tone6", bottom: "pants-gray", top: "jacket-black", hair: "buzz-black", hat: "beanie-red", bag: "backpack-blue" },
  { body: "tone1", bottom: "pants-denim", top: "hoodie-teal", hair: "spiky-platinum", hat: "none", bag: "satchel-green" },
].map((avatar, i) => ({ id: `look${i + 1}`, label: `Visual ${i + 1}`, avatar }));

/** Chave de textura no Phaser para um item de camada. */
export const textureKey = (layer: AvatarLayer, id: string) => `avatar-${layer}-${id}`;

/** URL do sheet de um item. */
export const sheetURL = (layer: AvatarLayer, id: string) => `/assets/avatars/${layer}/${id}.png`;

// Ids antigos de tom de pele (eram palavras); perfis salvos são migrados.
const LEGACY_SKIN: Record<string, string> = {
  porcelain: "tone1",
  light: "tone2",
  medium: "tone3",
  tan: "tone4",
  dark: "tone5",
  deep: "tone6",
};

/** Garante que o avatar só use ids conhecidos (fallback para o padrão). */
export function normalizeAvatar(a: Partial<AvatarConfig> | null | undefined): AvatarConfig {
  const pick = (layer: AvatarLayer) => {
    let v = a?.[layer];
    if (layer === "body" && v && LEGACY_SKIN[v]) v = LEGACY_SKIN[v];
    return v && ALL_LAYER_IDS[layer].includes(v) ? v : DEFAULT_AVATAR[layer];
  };
  return { body: pick("body"), bottom: pick("bottom"), top: pick("top"), hair: pick("hair"), hat: pick("hat"), bag: pick("bag") };
}

/** Avatar aleatório (botão "surpreenda-me"). */
export function randomAvatar(): AvatarConfig {
  const any = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
  const styled = (layer: AvatarLayer) =>
    joinId(layer, any(AVATAR_OPTIONS[layer].styles.filter((s) => s.id !== "none")).id, any(AVATAR_OPTIONS[layer].colors).id);
  return {
    body: any(SKIN_COLORS).id,
    bottom: styled("bottom"),
    top: styled("top"),
    hair: styled("hair"),
    hat: Math.random() < 0.5 ? "none" : styled("hat"),
    bag: Math.random() < 0.4 ? "none" : styled("bag"),
  };
}

/** Cor representativa de um item (swatch na UI, lista de participantes). */
export function itemColor(layer: AvatarLayer, id: string): string {
  const { color } = splitId(layer, id);
  return AVATAR_OPTIONS[layer].colors.find((c) => c.id === color)?.base ?? "#888";
}
