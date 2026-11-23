import { Maximize2, Minimize2, MonitorUp, PictureInPicture2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Track } from "livekit-client";
import { mediaManager } from "../media/manager";
import { useGameStore } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { AvatarHead } from "./AvatarView";
import { cx, IconButton } from "./kit";

/**
 * Palco das telas compartilhadas: mostra a tela de quem está na sua
 * conversa (ou no palco do mapa). Com várias, abas para alternar. Pode
 * minimizar para uma pílula, expandir ou ir para tela cheia. A própria
 * tela começa minimizada (evita o efeito "espelho infinito").
 */
export function ScreenShareStage() {
  useMediaStore((s) => s.version); // re-render quando tracks mudam
  const players = useGameStore((s) => s.players);
  const shares = mediaManager.screenShares();
  const [selected, setSelected] = useState<string | null>(null);
  const [minimized, setMinimized] = useState<Record<string, boolean>>({});
  const [large, setLarge] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  if (!shares.length) return null;
  const current = shares.find((s) => s.id === selected) ?? shares.find((s) => !s.local) ?? shares[0];
  const isMin = minimized[current.id] ?? current.local;
  const name = (id: string) => players[id]?.name ?? "alguém";

  if (isMin) {
    return (
      <div className="pointer-events-auto absolute top-[140px] right-3 z-10 flex animate-pop-in flex-col gap-2">
        {shares.map((s) => (
          <div key={s.id} className="glass flex items-center gap-2.5 rounded-2xl py-1.5 pr-1.5 pl-2 text-[13px]">
            <span className="grid size-8 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
              <MonitorUp className="size-4" />
            </span>
            <span className="max-w-[12rem] truncate font-medium text-white">
              {s.local ? "Você está compartilhando" : `Tela de ${name(s.id)}`}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelected(s.id);
                setMinimized((m) => ({ ...m, [s.id]: false }));
              }}
              className="focus-ring h-8 rounded-xl bg-white/[0.06] px-3 text-xs font-medium text-ink-100 transition hover:bg-white/[0.12]"
            >
              Ver
            </button>
            {s.local && (
              <button
                type="button"
                onClick={() => void mediaManager.setScreenShare(false)}
                className="focus-ring h-8 rounded-xl bg-rose-500/90 px-3 text-xs font-semibold text-white transition hover:bg-rose-500"
              >
                Parar
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      className={cx(
        "glass pointer-events-auto absolute left-1/2 z-10 flex -translate-x-1/2 animate-fade-up flex-col overflow-hidden rounded-[22px] bg-ink-950",
        large ? "top-[136px] bottom-24 w-[min(94vw,1600px)]" : "top-[140px] w-[min(70vw,960px)]",
      )}
    >
      <header className="flex items-center gap-2 border-b border-white/[0.06] py-1.5 pr-1.5 pl-2">
        <div className="thin-scroll mr-auto flex min-w-0 gap-1 overflow-x-auto">
          {shares.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              className={cx(
                "focus-ring inline-flex h-8 shrink-0 items-center gap-2 rounded-xl pr-3 pl-1 text-xs font-medium transition",
                s.id === current.id ? "bg-white/[0.1] text-white" : "text-ink-300 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <AvatarHead avatar={players[s.id]?.avatar} size={32} className="-my-1 scale-75" />
              {s.local ? "Sua tela" : name(s.id)}
            </button>
          ))}
        </div>
        {current.local && (
          <button
            type="button"
            onClick={() => void mediaManager.setScreenShare(false)}
            className="focus-ring h-8 rounded-xl bg-rose-500/90 px-3 text-xs font-semibold text-white transition hover:bg-rose-500"
          >
            Parar de compartilhar
          </button>
        )}
        <IconButton
          icon={large ? Minimize2 : Maximize2}
          label={large ? "Reduzir" : "Ampliar"}
          onClick={() => setLarge((l) => !l)}
        />
        <IconButton
          icon={PictureInPicture2}
          label="Tela cheia"
          onClick={() => void boxRef.current?.querySelector("video")?.requestFullscreen?.()}
        />
        <IconButton
          icon={X}
          label="Minimizar"
          onClick={() => setMinimized((m) => ({ ...m, [current.id]: true }))}
        />
      </header>
      <ShareVideo track={current.track} className={large ? "min-h-0 flex-1" : "aspect-video"} />
    </div>
  );
}

function ShareVideo({ track, className }: { track: Track; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <video ref={ref} autoPlay playsInline muted className={cx("w-full bg-black object-contain", className)} />;
}
