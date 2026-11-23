import { Megaphone, MicOff, MonitorUp } from "lucide-react";
import { useEffect, useRef } from "react";
import { mediaManager } from "../media/manager";
import { useGameStore } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { usePrefs } from "../state/prefsStore";
import { AvatarHead } from "./AvatarView";
import { cx } from "./kit";

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
    // Uma linha só, centralizada; com muita gente rola na horizontal em vez
    // de quebrar linha e cobrir o meio da tela. (inset-x-0 + mx-auto: com
    // left-1/2 o bloco só teria metade da largura e quebrava cedo.)
    <div
      data-tour="videos"
      className="thin-scroll pointer-events-auto absolute inset-x-0 top-3 mx-auto flex w-fit max-w-[calc(100vw-2rem)] gap-2 overflow-x-auto px-1 pb-1 lg:max-w-[calc(100vw-34rem)]"
    >
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
  const screenOn = useMediaStore((s) => s.screenOn);
  const mirror = usePrefs((s) => s.mirrorSelf);

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
    <Tile
      id={id}
      name={name}
      self
      showVideo={camOn && !!mediaManager.localVideoTrack()}
      micMuted={!micOn}
      sharing={screenOn}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cx("h-full w-full object-cover", mirror && "-scale-x-100")}
      />
    </Tile>
  );
}

function RemoteTile({ id, name }: { id: string; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const screenAudioRef = useRef<HTMLAudioElement>(null);
  const version = useMediaStore((s) => s.version);
  const { video, audio, screenAudio, micMuted, sharing } = mediaManager.remoteTracks(id);

  useEffect(() => {
    const pairs: [HTMLMediaElement | null, typeof video][] = [
      [videoRef.current, video],
      [audioRef.current, audio],
      [screenAudioRef.current, screenAudio],
    ];
    for (const [el, t] of pairs) if (el && t) t.attach(el);
    return () => {
      for (const [el, t] of pairs) if (el && t) t.detach(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, video, audio, screenAudio]);

  return (
    <Tile id={id} name={name} showVideo={!!video} micMuted={micMuted} sharing={sharing}>
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <audio ref={audioRef} autoPlay />
      <audio ref={screenAudioRef} autoPlay />
    </Tile>
  );
}

function Tile({
  id,
  name,
  self,
  showVideo,
  micMuted,
  sharing,
  children,
}: {
  id: string;
  name: string;
  self?: boolean;
  showVideo: boolean;
  micMuted: boolean;
  sharing?: boolean;
  children: React.ReactNode;
}) {
  const speaking = useMediaStore((s) => s.speaking.includes(id));
  const spotlight = useMediaStore((s) => s.spotlights.includes(id));
  const avatar = useGameStore((s) => s.players[id]?.avatar);
  return (
    <div
      className={cx(
        "relative h-[112px] w-[180px] shrink-0 animate-pop-in overflow-hidden rounded-2xl bg-ink-850 shadow-[0_12px_32px_-10px_rgb(0_0_0/0.7)] transition duration-200",
        speaking
          ? "ring-2 ring-live shadow-[0_0_0_4px_rgb(74_222_128/0.18),0_12px_32px_-10px_rgb(0_0_0/0.7)]"
          : "ring-1 ring-white/[0.08]",
      )}
    >
      <div className={showVideo ? "h-full w-full" : "hidden"}>{children}</div>
      {!showVideo && (
        <div className="flex h-full w-full items-start justify-center bg-[radial-gradient(90%_90%_at_50%_30%,#2a2346,#141221)] pt-3">
          <AvatarHead avatar={avatar} size={64} className={cx("transition", speaking && "scale-105")} />
        </div>
      )}
      {spotlight && (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-lg bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
          <Megaphone className="size-3" /> palco
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-5 pb-2 text-xs font-medium text-white">
        {sharing && (
          <span className="grid size-5 place-items-center rounded-md bg-sky-500/90" title="compartilhando a tela">
            <MonitorUp className="size-3" />
          </span>
        )}
        {micMuted && (
          <span className="grid size-5 place-items-center rounded-md bg-rose-500/90" title="microfone desligado">
            <MicOff className="size-3" />
          </span>
        )}
        <span className="truncate">{name}</span>
        {self && <span className="text-white/50">(você)</span>}
      </div>
    </div>
  );
}
