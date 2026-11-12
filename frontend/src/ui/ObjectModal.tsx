import { useEffect, useRef } from "react";
import type { NearbyObject } from "../state/gameStore";
import { useUIStore } from "../state/uiStore";

/**
 * Conteúdo de um objeto interativo (RF-OBJ-03): iframe/vídeo embutidos
 * com sandbox (RNF-13), imagem, nota de texto ou link externo.
 */
export function ObjectModal({ obj }: { obj: NearbyObject }) {
  const close = () => useUIStore.setState({ openObject: null });
  const wide = obj.type === "iframe" || obj.type === "video";
  const dialogRef = useRef<HTMLDivElement>(null);

  // Foca o diálogo ao abrir para que Esc feche mesmo com um iframe dentro
  // (até o usuário clicar no iframe — aí o botão ✕ continua funcionando).
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 outline-none"
      onClick={close}
      onKeyDown={(e) => e.key === "Escape" && close()}
      role="dialog"
      aria-modal="true"
      aria-label={obj.title}
    >
      <div
        className={`flex max-h-full flex-col overflow-hidden rounded-xl bg-slate-900 text-white shadow-2xl ring-1 ring-white/10 ${
          wide ? "h-[85vh] w-[90vw] max-w-6xl" : "w-full max-w-xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
          <span className="text-lg">{ICON[obj.type]}</span>
          <h2 className="font-semibold">{obj.title}</h2>
          {obj.url && (obj.type === "iframe" || obj.type === "video") && (
            <a
              href={obj.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-slate-400 hover:text-white"
            >
              abrir em nova aba ↗
            </a>
          )}
          <button
            onClick={close}
            className={`rounded px-2 py-1 text-sm hover:bg-white/10 ${obj.url && wide ? "" : "ml-auto"}`}
            aria-label="Fechar"
          >
            ✕ <span className="text-xs text-slate-400">Esc</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Body obj={obj} />
        </div>
      </div>
    </div>
  );
}

const ICON: Record<NearbyObject["type"], string> = {
  iframe: "🧩",
  video: "📺",
  image: "🖼️",
  note: "📌",
  link: "🔗",
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
      return <pre className="p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{obj.text}</pre>;
    case "link":
      return (
        <div className="p-6 text-center">
          <p className="mb-4 text-sm text-slate-300">Este objeto abre um site externo:</p>
          <p className="mb-6 truncate rounded bg-black/40 px-3 py-2 font-mono text-xs">{obj.url}</p>
          <a
            href={obj.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500"
          >
            Abrir em nova aba ↗
          </a>
        </div>
      );
  }
}
