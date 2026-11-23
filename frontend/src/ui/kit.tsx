import { X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EMOTES } from "../game/constants";

/**
 * Componentes base da UI. Regras: um único conjunto de ícones (Lucide,
 * traço 2px), raios 10/14/20, vidro escuro para tudo que flutua sobre o
 * mundo e pixel art só onde é "conteúdo do jogo" (avatares, emotes).
 */

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] px-1.5 font-sans text-[11px] font-semibold text-ink-200 shadow-[inset_0_-1px_0_rgb(255_255_255/0.06)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Dica flutuante (hover/foco) com rótulo e atalho opcional. */
export function Tooltip({
  label,
  shortcut,
  side = "top",
  children,
}: {
  label: string;
  shortcut?: string;
  side?: "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-ink-950/95 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-ink-100 opacity-0 shadow-xl ring-1 ring-white/10 transition duration-150 group-focus-within/tip:opacity-100 group-hover/tip:opacity-100",
          side === "top"
            ? "bottom-full mb-2.5 translate-y-1 group-hover/tip:translate-y-0"
            : "top-full mt-2.5 -translate-y-1 group-hover/tip:translate-y-0",
        )}
      >
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </span>
    </span>
  );
}

type Tone = "neutral" | "active" | "danger" | "live";

/** Botão redondo de ícone (barra inferior). */
export function DockButton({
  icon: Icon,
  label,
  shortcut,
  tone = "neutral",
  pressed,
  badge,
  disabled,
  tour,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  tone?: Tone;
  pressed?: boolean;
  badge?: number;
  disabled?: boolean;
  /** Marcador para o tutorial destacar este botão. */
  tour?: string;
  onClick: () => void;
}) {
  const tones: Record<Tone, string> = {
    neutral: pressed
      ? "bg-white/[0.14] text-white"
      : "bg-white/[0.04] text-ink-200 hover:bg-white/[0.1] hover:text-white",
    active: "bg-white/[0.08] text-white hover:bg-white/[0.14]",
    live: "bg-sky-500/90 text-white hover:bg-sky-500 shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset]",
    danger: "bg-rose-500/90 text-white hover:bg-rose-500 shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset]",
  };
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        data-tour={tour}
        className={cx(
          "focus-ring relative grid size-11 place-items-center rounded-2xl transition duration-150 active:scale-[0.92] disabled:pointer-events-none disabled:opacity-35",
          tones[tone],
        )}
      >
        <Icon className="size-5" strokeWidth={2} />
        {!!badge && (
          <span
            key={badge /* re-anima o "pop" a cada mensagem nova */}
            className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] animate-pop-in place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white ring-2 ring-ink-900"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </Tooltip>
  );
}

/** Botão de ícone pequeno (cabeçalhos de painel). */
export function IconButton({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        "focus-ring grid size-8 place-items-center rounded-lg text-ink-300 transition hover:bg-white/[0.08] hover:text-white active:scale-90",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/** Painel lateral flutuante com cabeçalho padrão. */
export function Panel({
  icon: Icon,
  title,
  subtitle,
  onClose,
  side,
  actions,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  side: "left" | "right";
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      aria-label={title}
      className={cx(
        "glass pointer-events-auto absolute top-16 bottom-24 z-10 flex w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[20px] text-sm",
        side === "left" ? "left-3 animate-slide-right" : "right-3 animate-slide-left",
        className,
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-white/[0.06] py-2.5 pr-2 pl-4">
        <Icon className="size-4 text-brand-300" />
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-[13px] font-semibold text-white">{title}</h2>
          {subtitle && <p className="truncate text-[11px] text-ink-400">{subtitle}</p>}
        </div>
        {actions}
        <IconButton icon={X} label="Fechar (Esc)" onClick={onClose} />
      </header>
      {children}
    </aside>
  );
}

/** Controle segmentado (filtros, escopos). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "sm",
}: {
  value: T;
  options: { id: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl bg-black/30 p-0.5 ring-1 ring-white/[0.06]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.title}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "focus-ring inline-flex items-center gap-1.5 rounded-[10px] font-medium transition",
            size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
            value === o.id
              ? "bg-white/[0.12] text-white shadow-sm"
              : "text-ink-300 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Ícone de emote em pixel art (mesmo sheet usado no mundo). */
export function PixelEmote({ id, size = 24 }: { id: string; size?: number }) {
  const i = Math.max(0, EMOTES.findIndex((e) => e.id === id));
  return (
    <span
      aria-hidden
      className="pixelated inline-block shrink-0"
      style={{
        width: size,
        height: size,
        backgroundImage: "url(/assets/ui/emotes.png)",
        backgroundSize: `${EMOTES.length * size}px ${size}px`,
        backgroundPosition: `${-i * size}px 0`,
      }}
    />
  );
}

/** Logotipo: "pixel" quadrado + nome em fonte pixel. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cx(
          "grid grid-cols-2 gap-[2px] rounded-[5px] bg-gradient-to-br from-brand-400 to-brand-600 p-[3px] shadow-[0_0_18px_-2px_var(--color-brand-500)]",
          big ? "size-8" : "size-5",
        )}
      >
        <span className="rounded-[1px] bg-white/95" />
        <span className="rounded-[1px] bg-white/40" />
        <span className="rounded-[1px] bg-white/40" />
        <span className="rounded-[1px] bg-white/95" />
      </span>
      <span className={cx("font-pixel font-bold tracking-wide text-white", big ? "text-3xl" : "text-[15px]")}>
        PixelRooms
      </span>
    </span>
  );
}
