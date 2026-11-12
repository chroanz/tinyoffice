import { EMOTES } from "../game/constants";
import { mediaManager } from "../media/manager";
import { client } from "../net/client";
import { useGameStore } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { ui, useUIStore } from "../state/uiStore";

/** Barra inferior (como no Gather): mídia, emotes, chat, participantes, ajuda. */
export function ControlsBar() {
  const micOn = useMediaStore((s) => s.micOn);
  const camOn = useMediaStore((s) => s.camOn);
  const areaId = useMediaStore((s) => s.areaId);
  const onSpotlight = useMediaStore((s) => s.onSpotlight);
  const connected = useMediaStore((s) => s.connected);
  const unread = useGameStore((s) => s.unreadChat);
  const chatOpen = useUIStore((s) => s.chatOpen);
  const participantsOpen = useUIStore((s) => s.participantsOpen);
  const emotesOpen = useUIStore((s) => s.emotesOpen);

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      {emotesOpen && (
        <div className="flex gap-1 rounded-full bg-slate-900/90 p-1 shadow-lg ring-1 ring-white/10">
          {EMOTES.map((e, i) => (
            <button
              key={e.id}
              title={`${e.label} (${i + 1})`}
              onClick={() => client.emote(e.id)}
              className="h-9 w-9 rounded-full text-lg hover:bg-white/10"
            >
              {e.emoji}
            </button>
          ))}
          <button
            title="Limpar emote (0)"
            onClick={() => client.emote("clear")}
            className="h-9 w-9 rounded-full text-xs text-slate-400 hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {areaId && (
          <span className="rounded-full bg-purple-700/90 px-3 py-1.5 text-xs font-semibold text-white">
            🔒 área privada: {areaId}
          </span>
        )}
        {onSpotlight && (
          <span className="animate-pulse rounded-full bg-amber-600/90 px-3 py-1.5 text-xs font-semibold text-white">
            🎤 no palco — todo o mapa te ouve
          </span>
        )}
        <RoundButton
          active={micOn}
          danger={!micOn}
          title={micOn ? "Desativar microfone (M)" : "Ativar microfone (M)"}
          onClick={() => void mediaManager.setMicOn(!micOn)}
        >
          {micOn ? "🎙️" : "🔇"}
        </RoundButton>
        <RoundButton
          active={camOn}
          danger={!camOn}
          title={camOn ? "Desligar câmera (V)" : "Ligar câmera (V)"}
          onClick={() => void mediaManager.setCamOn(!camOn)}
        >
          {camOn ? "📷" : "🚫"}
        </RoundButton>
        <span className="mx-1 h-6 w-px bg-white/20" />
        <RoundButton active={emotesOpen} title="Emotes (1–6)" onClick={ui.toggleEmotes}>
          😀
        </RoundButton>
        <RoundButton active={chatOpen} title="Chat (C)" onClick={ui.toggleChat}>
          💬
          {unread > 0 && !chatOpen && (
            <span className="absolute -top-1 -right-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </RoundButton>
        <RoundButton active={participantsOpen} title="Participantes (P)" onClick={ui.toggleParticipants}>
          👥
        </RoundButton>
        <RoundButton title="Atalhos (?)" onClick={ui.toggleHelp}>
          ?
        </RoundButton>
        {!connected && (
          <span className="rounded bg-black/50 px-2 py-1 text-xs text-white/60">mídia offline</span>
        )}
      </div>
    </div>
  );
}

function RoundButton(props: {
  active?: boolean;
  danger?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const bg = props.danger
    ? "bg-red-600 hover:bg-red-500"
    : props.active
      ? "bg-emerald-700 hover:bg-emerald-600"
      : "bg-slate-700 hover:bg-slate-600";
  return (
    <button
      onClick={props.onClick}
      title={props.title}
      aria-label={props.title}
      aria-pressed={props.active}
      className={`relative flex h-11 w-11 items-center justify-center rounded-full text-lg text-white shadow-lg transition ${bg}`}
    >
      {props.children}
    </button>
  );
}
