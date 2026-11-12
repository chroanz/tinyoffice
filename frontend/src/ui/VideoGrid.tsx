import { useEffect, useRef } from "react";
import { mediaManager } from "../media/manager";
import { useGameStore } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";

/**
 * Cartões de vídeo no topo da tela (como no Gather): o próprio usuário
 * (espelhado) + todos que o servidor mandou ouvir/ver. Quem está falando
 * ganha borda verde; quem está no palco, etiqueta de spotlight.
 */
export function VideoGrid() {
  const hear = useMediaStore((s) => s.hear);
  useMediaStore((s) => s.version); // re-render quando tracks mudam
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);

  return (
    <div className="pointer-events-auto absolute top-2 left-1/2 flex max-w-[90vw] -translate-x-1/2 flex-wrap justify-center gap-2">
      {selfId && <SelfTile id={selfId} name={players[selfId]?.name ?? "você"} />}
      {hear.map((id) => (
        <RemoteTile key={id} id={id} name={players[id]?.name ?? "…"} />
      ))}
    </div>
  );
}

function SelfTile({ id, name }: { id: string; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const version = useMediaStore((s) => s.version);
  const camOn = useMediaStore((s) => s.camOn);
  const micOn = useMediaStore((s) => s.micOn);

  useEffect(() => {
    const el = videoRef.current;
    const track = mediaManager.localVideoTrack();
    if (el && track && camOn) {
      track.attach(el);
      return () => {
        track.detach(el);
      };
    }
  }, [version, camOn]);

  return (
    <Tile id={id} name={`${name} (você)`} showVideo={camOn} micMuted={!micOn}>
      <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
    </Tile>
  );
}

function RemoteTile({ id, name }: { id: string; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const version = useMediaStore((s) => s.version);
  const { video, audio, micMuted } = mediaManager.remoteTracks(id);

  useEffect(() => {
    const vEl = videoRef.current;
    const aEl = audioRef.current;
    if (vEl && video) video.attach(vEl);
    if (aEl && audio) audio.attach(aEl);
    return () => {
      if (vEl && video) video.detach(vEl);
      if (aEl && audio) audio.detach(aEl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, video, audio]);

  return (
    <Tile id={id} name={name} showVideo={!!video} micMuted={micMuted}>
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <audio ref={audioRef} autoPlay />
    </Tile>
  );
}

function Tile({
  id,
  name,
  showVideo,
  micMuted,
  children,
}: {
  id: string;
  name: string;
  showVideo: boolean;
  micMuted: boolean;
  children: React.ReactNode;
}) {
  const speaking = useMediaStore((s) => s.speaking.includes(id));
  const spotlight = useMediaStore((s) => s.spotlights.includes(id));
  return (
    <div
      className={`relative h-28 w-40 overflow-hidden rounded-lg bg-slate-900 shadow-lg ring-2 transition ${
        speaking ? "ring-emerald-400" : "ring-black/40"
      }`}
    >
      <div className={showVideo ? "h-full w-full" : "hidden"}>{children}</div>
      {!showVideo && (
        <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-500">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {spotlight && (
        <span className="absolute top-1 left-1 rounded bg-amber-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          🎤 palco
        </span>
      )}
      <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {micMuted && <span title="microfone desligado">🔇</span>}
        {name}
      </span>
    </div>
  );
}
