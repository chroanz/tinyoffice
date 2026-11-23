import { DEFAULT_AVATAR, normalizeAvatar } from "../game/avatarCatalog";
import type { AvatarConfig } from "../net/messages";

/** Nome e avatar do usuário, salvos no navegador. */
export interface Profile {
  name: string;
  avatar: AvatarConfig;
}

const PROFILE_KEY = "pixelrooms.profile";

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>;
      return { name: typeof p.name === "string" ? p.name : "", avatar: normalizeAvatar(p.avatar) };
    }
  } catch {
    // storage indisponível ou corrompido: usa o padrão
  }
  return { name: "", avatar: DEFAULT_AVATAR };
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // ignorar (modo privado etc.)
  }
}
