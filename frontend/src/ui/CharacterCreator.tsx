import {
  Backpack,
  Check,
  Footprints,
  HatGlasses,
  Palette,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Scissors,
  Shirt,
  Shuffle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import {
  AVATAR_OPTIONS,
  AVATAR_PRESETS,
  joinId,
  splitId,
  type AvatarLayer,
} from "../game/avatarCatalog";
import type { AvatarConfig, Direction } from "../net/messages";
import { AvatarSprite } from "./AvatarView";
import { cx } from "./kit";

type Tab = "looks" | AvatarLayer;

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "looks", label: "Visuais", icon: Sparkles },
  { id: "body", label: "Pele", icon: Palette },
  { id: "hair", label: "Cabelo", icon: Scissors },
  { id: "top", label: "Roupa", icon: Shirt },
  { id: "bottom", label: "Baixo", icon: Footprints },
  { id: "hat", label: "Acessório", icon: HatGlasses },
  { id: "bag", label: "Bolsa", icon: Backpack },
];

const DIRS: Direction[] = ["down", "left", "up", "right"];

/** Palco com a prévia grande, girar e andar/parar. */
export function AvatarStage({ avatar, onRandom }: { avatar: AvatarConfig; onRandom: () => void }) {
  const [dirIndex, setDirIndex] = useState(0);
  const [walking, setWalking] = useState(true);
  const turn = (d: number) => setDirIndex((i) => (i + d + DIRS.length) % DIRS.length);

  return (
    <div className="relative flex h-full min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-[18px] bg-[radial-gradient(120%_80%_at_50%_0%,#2a2346_0%,#141221_60%)] ring-1 ring-white/[0.06]">
      {/* chão: losango de piso em perspectiva + sombra */}
      <div className="absolute bottom-[22%] h-16 w-56 rounded-[50%] bg-[radial-gradient(closest-side,rgb(139_92_246/0.28),transparent)]" />
      <div className="absolute bottom-[25%] h-4 w-24 rounded-[50%] bg-black/45 blur-[2px]" />
      <div className="relative -mt-4 animate-fade-in" key={DIRS[dirIndex]}>
        <AvatarSprite avatar={avatar} scale={4} dir={DIRS[dirIndex]} anim={walking ? "walk" : "idle"} />
      </div>

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/[0.06]">
          <StageButton icon={RotateCcw} label="Girar para a esquerda" onClick={() => turn(1)} />
          <StageButton
            icon={walking ? Pause : Play}
            label={walking ? "Parar" : "Andar"}
            onClick={() => setWalking((w) => !w)}
          />
          <StageButton icon={RotateCw} label="Girar para a direita" onClick={() => turn(-1)} />
        </div>
        <button
          type="button"
          onClick={onRandom}
          className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-black/30 px-3 py-2 text-xs font-medium text-ink-200 ring-1 ring-white/[0.06] transition hover:bg-white/10 hover:text-white active:scale-95"
        >
          <Shuffle className="size-3.5" /> Aleatório
        </button>
      </div>
    </div>
  );
}

function StageButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="focus-ring grid size-8 place-items-center rounded-lg text-ink-200 transition hover:bg-white/10 hover:text-white active:scale-90"
    >
      <Icon className="size-4" />
    </button>
  );
}

/** Abas de personalização (visuais prontos, pele, cabelo, roupa, baixo). */
export function CharacterCreator({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}) {
  const [tab, setTab] = useState<Tab>("looks");

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div role="tablist" className="mb-4 flex gap-1 rounded-2xl bg-black/30 p-1 ring-1 ring-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-label={t.label}
            title={t.label}
            onClick={() => setTab(t.id)}
            className={cx(
              "focus-ring flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition",
              tab === t.id ? "flex-[3] bg-white/[0.12] text-white shadow-sm" : "flex-1 text-ink-300 hover:text-white",
            )}
          >
            <t.icon className="size-3.5 shrink-0" />
            {/* só a aba ativa mostra o nome: 6 abas cabem em qualquer largura */}
            {tab === t.id && <span className="truncate">{t.label}</span>}
          </button>
        ))}
      </div>

      <div key={tab} className="thin-scroll min-h-0 flex-1 animate-fade-up overflow-y-auto pr-1">
        {tab === "looks" ? (
          <Looks value={value} onChange={onChange} />
        ) : (
          <LayerEditor layer={tab} value={value} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

function Looks({ value, onChange }: { value: AvatarConfig; onChange: (a: AvatarConfig) => void }) {
  return (
    <>
      <SectionTitle>Comece por um visual pronto</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {AVATAR_PRESETS.map((p) => {
          const selected = sameAvatar(p.avatar, value);
          return (
            <OptionTile key={p.id} selected={selected} onClick={() => onChange(p.avatar)} label={p.label}>
              <AvatarCrop avatar={p.avatar} scale={1.5} y0={0} h={64} />
            </OptionTile>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        Depois ajuste cada detalhe nas outras abas — cabelo, roupa, saia ou calça e tom de pele.
      </p>
    </>
  );
}

// Região do frame que interessa em cada camada (y inicial e altura, em px do sheet).
const CROP: Record<Exclude<AvatarLayer, "body">, { y0: number; h: number }> = {
  hair: { y0: 6, h: 40 },
  hat: { y0: 6, h: 32 },
  bag: { y0: 34, h: 26 },
  top: { y0: 34, h: 24 },
  bottom: { y0: 44, h: 20 },
};

const GRID_COLS: Record<AvatarLayer, string> = {
  body: "grid-cols-4",
  hair: "grid-cols-5",
  top: "grid-cols-5",
  bottom: "grid-cols-3",
  hat: "grid-cols-4",
  bag: "grid-cols-3",
};

function LayerEditor({
  layer,
  value,
  onChange,
}: {
  layer: AvatarLayer;
  value: AvatarConfig;
  onChange: (a: AvatarConfig) => void;
}) {
  const { styles, colors } = AVATAR_OPTIONS[layer];
  const current = splitId(layer, value[layer]);
  const set = (style: string, color: string) => onChange({ ...value, [layer]: joinId(layer, style, color) });
  const colorDisabled = layer === "hair" && current.style === "none";

  return (
    <>
      {layer !== "body" && (
        <>
          <SectionTitle>Estilo</SectionTitle>
          <div className={cx("mb-5 grid gap-2", GRID_COLS[layer])}>
            {styles.map((s) => {
              const preview = { ...value, [layer]: joinId(layer, s.id, current.color) };
              const crop = CROP[layer];
              return (
                <OptionTile
                  key={s.id}
                  selected={current.style === s.id}
                  onClick={() => set(s.id, current.color)}
                  label={s.label}
                >
                  <AvatarCrop avatar={preview} scale={2} y0={crop.y0} h={crop.h} />
                </OptionTile>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle>{layer === "body" ? "Tom de pele" : "Cor"}</SectionTitle>
      <div className={cx("flex flex-wrap gap-2.5", colorDisabled && "pointer-events-none opacity-30")}>
        {colors.map((c) => {
          const selected = current.color === c.id;
          return (
            <button
              key={c.id}
              type="button"
              title={c.label}
              aria-label={c.label}
              aria-pressed={selected}
              onClick={() => set(current.style === "none" ? styles[1].id : current.style, c.id)}
              className={cx(
                "focus-ring relative grid size-9 place-items-center rounded-full transition duration-150 hover:scale-110 active:scale-95",
                selected ? "ring-2 ring-white ring-offset-2 ring-offset-ink-900" : "ring-1 ring-white/15",
              )}
              style={{ background: `linear-gradient(135deg, ${c.light} 0%, ${c.base} 45%, ${c.shade} 100%)` }}
            >
              {selected && <Check className="size-4 text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.6)]" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">{children}</h3>;
}

function OptionTile({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={label}
      className={cx(
        "focus-ring group relative flex flex-col items-center gap-1 rounded-2xl p-1.5 pb-2 transition duration-150 active:scale-95",
        selected
          ? "bg-brand-500/15 ring-2 ring-brand-400"
          : "bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.07] hover:ring-white/15",
      )}
    >
      <div className="grid w-full place-items-center rounded-xl bg-black/25 py-1 transition group-hover:bg-black/15">
        {children}
      </div>
      <span className={cx("max-w-full truncate text-[11px] font-medium", selected ? "text-white" : "text-ink-300")}>
        {label}
      </span>
      {selected && (
        <span className="absolute top-1 right-1 grid size-4 animate-pop-in place-items-center rounded-full bg-brand-400 text-ink-950">
          <Check className="size-3" strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

/** Recorte vertical do avatar parado (y0/h em px do frame 32×64). */
function AvatarCrop({ avatar, scale, y0, h }: { avatar: AvatarConfig; scale: number; y0: number; h: number }) {
  const style: CSSProperties = { width: 32 * scale, height: h * scale };
  return (
    <div className="relative overflow-hidden" style={style}>
      {/* frame 64 px de largura com a figura na faixa central (x 16..48) */}
      <div className="absolute" style={{ top: -y0 * scale, left: -16 * scale }}>
        <AvatarSprite avatar={avatar} scale={scale} />
      </div>
    </div>
  );
}

function sameAvatar(a: AvatarConfig, b: AvatarConfig) {
  return a.body === b.body && a.bottom === b.bottom && a.top === b.top && a.hair === b.hair && a.hat === b.hat && a.bag === b.bag;
}

