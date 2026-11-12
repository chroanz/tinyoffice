import { AVATAR_CATALOG, AVATAR_LAYERS, sheetURL, type AvatarLayer } from "../game/avatarCatalog";
import type { AvatarConfig } from "../net/messages";

const LAYER_LABEL: Record<AvatarLayer, string> = { body: "Pele", top: "Roupa", hair: "Cabelo" };

/**
 * Seletor de avatar por camadas (RF-AVATAR-01): preview composto a partir
 * dos próprios sheets (frame idle/down, escala 3×) + swatches por camada.
 */
export function AvatarPicker({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}) {
  return (
    <div className="mb-4 flex gap-4">
      <AvatarPreview avatar={value} scale={3} />
      <div className="flex flex-1 flex-col gap-2">
        {AVATAR_LAYERS.map((layer) => (
          <div key={layer}>
            <div className="mb-1 text-xs text-slate-400">{LAYER_LABEL[layer]}</div>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_CATALOG[layer].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  aria-label={`${LAYER_LABEL[layer]}: ${item.label}`}
                  aria-pressed={value[layer] === item.id}
                  onClick={() => onChange({ ...value, [layer]: item.id })}
                  style={{ background: item.color }}
                  className={`h-6 w-6 rounded-full ring-2 transition ${
                    value[layer] === item.id ? "ring-emerald-400" : "ring-black/40 hover:ring-white/50"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Preview estático do avatar: camadas empilhadas recortando o sheet via CSS. */
export function AvatarPreview({ avatar, scale = 2 }: { avatar: AvatarConfig; scale?: number }) {
  const w = 32 * scale;
  const h = 64 * scale;
  return (
    <div
      className="relative shrink-0 self-center rounded-lg bg-slate-900"
      style={{ width: w + 16, height: h + 16, imageRendering: "pixelated" }}
    >
      {AVATAR_LAYERS.map((layer) => (
        <div
          key={layer}
          style={{
            position: "absolute",
            left: 8,
            top: 8,
            width: w,
            height: h,
            backgroundImage: `url(${sheetURL(layer, avatar[layer])})`,
            backgroundSize: `${192 * scale}px ${320 * scale}px`,
            backgroundPosition: "0 0",
            imageRendering: "pixelated",
          }}
        />
      ))}
    </div>
  );
}
