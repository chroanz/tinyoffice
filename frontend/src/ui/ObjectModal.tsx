import { ExternalLink, Image as ImageIcon, LayoutDashboard, StickyNote, Tv, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { NearbyObject } from "../state/gameStore";
import { useUIStore } from "../state/uiStore";
import { Kbd } from "./kit";

/**
 * Conteúdo de um objeto interativo (RF-OBJ-03): iframe/vídeo embutidos
 * com sandbox (RNF-13), imagem, nota de texto ou link externo.
 */
export function ObjectModal({ obj }: { obj: NearbyObject }) {
  const close = () => useUIStore.setState({ openObject: null });
  const wide = obj.type === "iframe" || obj.type === "video";
  const dialogRef = useRef<HTMLDivElement>(null);
  const Icon = ICON[obj.type];

  // Foca o diálogo ao abrir para que Esc feche mesmo com um iframe dentro
  // (até o usuário clicar no iframe — aí o botão ✕ continua funcionando).
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="pointer-events-auto absolute inset-0 z-20 flex animate-fade-in items-center justify-center bg-ink-950/70 p-4 outline-none backdrop-blur-[2px]"
      onClick={close}
      onKeyDown={(e) => e.key === "Escape" && close()}
      role="dialog"
      aria-modal="true"
      aria-label={obj.title}
    >
      <div
        className={`glass flex max-h-full animate-pop-in flex-col overflow-hidden rounded-[22px] text-white ${
          wide ? "h-[85vh] w-[90vw] max-w-6xl" : "w-full max-w-xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 pr-2.5 pl-3">
          <span className="grid size-8 place-items-center rounded-xl bg-amber-300/15 text-amber-300">
            <Icon className="size-4" />
          </span>
          <h2 className="mr-auto truncate text-sm font-semibold">{obj.title}</h2>
          {obj.url && (obj.type === "iframe" || obj.type === "video") && (
            <a
              href={obj.url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              <ExternalLink className="size-3.5" /> Nova aba
            </a>
          )}
          <button
            onClick={close}
            className="focus-ring inline-flex h-8 items-center gap-2 rounded-lg pr-1.5 pl-2.5 text-ink-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Fechar"
          >
            <X className="size-4" />
            <Kbd>Esc</Kbd>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Body obj={obj} />
        </div>
      </div>
    </div>
  );
}

const ICON: Record<NearbyObject["type"], LucideIcon> = {
  iframe: LayoutDashboard,
  video: Tv,
  image: ImageIcon,
  note: StickyNote,
  link: ExternalLink,
};

function Body({ obj }: { obj: NearbyObject }) {
  switch (obj.type) {
    case "iframe":
    case "video":
      return (
        <iframe
          src={obj.url}
          title={obj.title}
          className="h-full w-full bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          allow="fullscreen; clipboard-write; autoplay"
          referrerPolicy="no-referrer"
        />
      );
    case "image":
      return (
        <img
          src={obj.url}
          alt={obj.title}
          className="mx-auto max-h-[75vh] object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      );
    case "note":
      return (
        <pre className="p-6 font-sans text-[15px] leading-relaxed whitespace-pre-wrap text-ink-100 select-text">
          {obj.text}
        </pre>
      );
    case "link":
      return (
        <div className="p-8 text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-white/[0.05] text-ink-300 ring-1 ring-white/[0.06]">
            <ExternalLink className="size-5" />
          </span>
          <p className="mb-3 text-sm text-ink-300">Este objeto abre um site externo:</p>
          <p className="mx-auto mb-6 max-w-md truncate rounded-xl bg-black/30 px-3 py-2 font-mono text-xs text-ink-200 ring-1 ring-white/[0.06]">
            {obj.url}
          </p>
          <a
            href={obj.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-brand-400 to-brand-600 px-5 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgb(124_58_237/0.7)] transition hover:brightness-110 active:scale-[0.97]"
          >
            Abrir em nova aba <ExternalLink className="size-4" />
          </a>
        </div>
      );
  }
}
