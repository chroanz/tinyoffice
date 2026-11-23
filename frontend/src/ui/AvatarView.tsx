import type { CSSProperties } from "react";
import { AVATAR_LAYERS, SHEET, normalizeAvatar, sheetId, sheetURL } from "../game/avatarCatalog";
import type { AvatarConfig, Direction } from "../net/messages";

const ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };

/**
 * Avatar renderizado em CSS a partir dos mesmos sheets do jogo (camadas
 * empilhadas). anim: "walk" anda no lugar, "idle" pisca, "none" é estático.
 */
export function AvatarSprite({
  avatar,
  scale = 2,
  dir = "down",
  anim = "none",
  className,
}: {
  avatar: AvatarConfig;
  scale?: number;
  dir?: Direction;
  anim?: "walk" | "idle" | "none";
  className?: string;
}) {
  const a = normalizeAvatar(avatar);
  const fw = SHEET.frameW * scale;
  const fh = SHEET.frameH * scale;
  const style = {
    width: fw,
    height: fh,
    "--fw": `${fw}px`,
    "--fh": `${fh}px`,
    "--row": ROW[dir],
  } as CSSProperties;
  return (
    <div className={`relative shrink-0 ${className ?? ""}`} style={style} aria-hidden>
      {AVATAR_LAYERS.map((layer) =>
        a[layer] === "none" ? null : (
          <div
            key={layer}
            className="avatar-layer"
            data-anim={anim === "none" ? undefined : anim}
            style={{
              // de costas a mochila fica por cima do cabelo
              zIndex: layer === "bag" && dir === "up" ? 1 : undefined,
              backgroundImage: `url(${sheetURL(layer, sheetId(layer, a))})`,
              backgroundSize: `${fw * SHEET.cols}px ${fh * SHEET.rows}px`,
              backgroundPositionX: anim === "walk" ? undefined : 0,
            }}
          />
        ),
      )}
    </div>
  );
}

/**
 * Só a cabeça (recorte do frame parado de frente) — para listas, chat e
 * cartões de vídeo sem câmera.
 */
export function AvatarHead({
  avatar,
  size = 32,
  className,
}: {
  avatar: AvatarConfig | undefined;
  size?: number;
  className?: string;
}) {
  // Frame 64×64 (32×32 de arte, 2×); a figura ocupa a faixa central
  // x 16..48 e a cabeça (com cabelo/chapéu) y 8..40.
  const scale = size / 32;
  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="absolute" style={{ top: -8 * scale, left: -16 * scale }}>
        <AvatarSprite avatar={avatar ?? normalizeAvatar(null)} scale={scale} />
      </div>
    </div>
  );
}
