// Gerado por backend/cmd/genassets — não edite à mão.

export interface AvatarColor { id: string; label: string; base: string; shade: string; light: string }
export interface AvatarStyle { id: string; label: string }

export const SKIN_COLORS: AvatarColor[] = [
  { id: "tone1", label: "Tom 1", base: "#ffe1cc", shade: "#eab396", light: "#fff0e4" },
  { id: "tone2", label: "Tom 2", base: "#f6cfae", shade: "#d9a07c", light: "#ffe2c8" },
  { id: "tone3", label: "Tom 3", base: "#dba373", shade: "#b47a4b", light: "#ecbf8f" },
  { id: "tone4", label: "Tom 4", base: "#b97c4e", shade: "#8e5631", light: "#cf966a" },
  { id: "tone5", label: "Tom 5", base: "#8f5a3c", shade: "#663b22", light: "#a8704f" },
  { id: "tone6", label: "Tom 6", base: "#5f3b28", shade: "#422517", light: "#77503a" },
];

export const HAIR_STYLES: AvatarStyle[] = [
  { id: "short", label: "Estilo 1" },
  { id: "spiky", label: "Estilo 2" },
  { id: "buzz", label: "Estilo 3" },
  { id: "curly", label: "Estilo 4" },
  { id: "bob", label: "Estilo 5" },
  { id: "long", label: "Estilo 6" },
  { id: "ponytail", label: "Estilo 7" },
  { id: "bun", label: "Estilo 8" },
];

export const HAIR_COLORS: AvatarColor[] = [
  { id: "black", label: "Cor 1", base: "#3b3342", shade: "#221d29", light: "#5e5469" },
  { id: "brown", label: "Cor 2", base: "#7a4a2a", shade: "#4f2e18", light: "#a56c40" },
  { id: "auburn", label: "Cor 3", base: "#c1502c", shade: "#83301a", light: "#e57a45" },
  { id: "blonde", label: "Cor 4", base: "#f0cf6a", shade: "#c39638", light: "#fff1a8" },
  { id: "platinum", label: "Cor 5", base: "#e8e4f0", shade: "#a9a3bd", light: "#ffffff" },
  { id: "pink", label: "Cor 6", base: "#f28ab9", shade: "#c2568b", light: "#ffc3de" },
  { id: "blue", label: "Cor 7", base: "#5a86e0", shade: "#3656a8", light: "#9cc0ff" },
];

export const TOP_STYLES: AvatarStyle[] = [
  { id: "tee", label: "Estilo 1" },
  { id: "tank", label: "Estilo 2" },
  { id: "hoodie", label: "Estilo 3" },
  { id: "jacket", label: "Estilo 4" },
  { id: "dress", label: "Estilo 5" },
];

export const TOP_COLORS: AvatarColor[] = [
  { id: "blue", label: "Cor 1", base: "#4f8ad6", shade: "#2f5c9c", light: "#80b2f2" },
  { id: "teal", label: "Cor 2", base: "#3fb3a8", shade: "#247a78", light: "#76dccf" },
  { id: "green", label: "Cor 3", base: "#5bb36a", shade: "#337a45", light: "#8ad98f" },
  { id: "yellow", label: "Cor 4", base: "#f2c84b", shade: "#c4902a", light: "#ffe48a" },
  { id: "red", label: "Cor 5", base: "#e05a4e", shade: "#a13529", light: "#f58a7a" },
  { id: "pink", label: "Cor 6", base: "#f28bb5", shade: "#c25a86", light: "#ffbcd6" },
  { id: "purple", label: "Cor 7", base: "#9b6ad6", shade: "#67409a", light: "#c29af0" },
  { id: "white", label: "Cor 8", base: "#f2f2ee", shade: "#c2c2cc", light: "#ffffff" },
  { id: "black", label: "Cor 9", base: "#3c3c4a", shade: "#24242e", light: "#5e5e72" },
];

export const BOTTOM_STYLES: AvatarStyle[] = [
  { id: "pants", label: "Estilo 1" },
  { id: "shorts", label: "Estilo 2" },
  { id: "skirt", label: "Estilo 3" },
];

export const BOTTOM_COLORS: AvatarColor[] = [
  { id: "denim", label: "Cor 1", base: "#4b6ea8", shade: "#2f4b80", light: "#6f92cc" },
  { id: "black", label: "Cor 2", base: "#35353f", shade: "#1f1f28", light: "#50505e" },
  { id: "khaki", label: "Cor 3", base: "#c9a66b", shade: "#977643", light: "#e2c48c" },
  { id: "gray", label: "Cor 4", base: "#8b909c", shade: "#5e6370", light: "#b1b6c2" },
  { id: "wine", label: "Cor 5", base: "#943350", shade: "#631d34", light: "#b9506c" },
  { id: "pink", label: "Cor 6", base: "#ef9ac0", shade: "#c0628c", light: "#ffc6dc" },
];

export const BAG_STYLES: AvatarStyle[] = [
  { id: "backpack", label: "Estilo 1" },
  { id: "satchel", label: "Estilo 2" },
];

export const BAG_COLORS: AvatarColor[] = [
  { id: "blue", label: "Cor 1", base: "#4f8ad6", shade: "#2f5c9c", light: "#80b2f2" },
  { id: "teal", label: "Cor 2", base: "#3fb3a8", shade: "#247a78", light: "#76dccf" },
  { id: "green", label: "Cor 3", base: "#5bb36a", shade: "#337a45", light: "#8ad98f" },
  { id: "yellow", label: "Cor 4", base: "#f2c84b", shade: "#c4902a", light: "#ffe48a" },
  { id: "red", label: "Cor 5", base: "#e05a4e", shade: "#a13529", light: "#f58a7a" },
  { id: "pink", label: "Cor 6", base: "#f28bb5", shade: "#c25a86", light: "#ffbcd6" },
  { id: "purple", label: "Cor 7", base: "#9b6ad6", shade: "#67409a", light: "#c29af0" },
  { id: "white", label: "Cor 8", base: "#f2f2ee", shade: "#c2c2cc", light: "#ffffff" },
  { id: "black", label: "Cor 9", base: "#3c3c4a", shade: "#24242e", light: "#5e5e72" },
];

export const HAT_STYLES: AvatarStyle[] = [
  { id: "cap", label: "Estilo 1" },
  { id: "beanie", label: "Estilo 2" },
  { id: "bucket", label: "Estilo 3" },
];

export const HAT_COLORS: AvatarColor[] = [
  { id: "blue", label: "Cor 1", base: "#4f8ad6", shade: "#2f5c9c", light: "#80b2f2" },
  { id: "teal", label: "Cor 2", base: "#3fb3a8", shade: "#247a78", light: "#76dccf" },
  { id: "green", label: "Cor 3", base: "#5bb36a", shade: "#337a45", light: "#8ad98f" },
  { id: "yellow", label: "Cor 4", base: "#f2c84b", shade: "#c4902a", light: "#ffe48a" },
  { id: "red", label: "Cor 5", base: "#e05a4e", shade: "#a13529", light: "#f58a7a" },
  { id: "pink", label: "Cor 6", base: "#f28bb5", shade: "#c25a86", light: "#ffbcd6" },
  { id: "purple", label: "Cor 7", base: "#9b6ad6", shade: "#67409a", light: "#c29af0" },
  { id: "white", label: "Cor 8", base: "#f2f2ee", shade: "#c2c2cc", light: "#ffffff" },
  { id: "black", label: "Cor 9", base: "#3c3c4a", shade: "#24242e", light: "#5e5e72" },
];

export const SHEET = { cols: 6, rows: 4, frameW: 64, frameH: 64 } as const;
