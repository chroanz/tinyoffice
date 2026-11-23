import {
  Keyboard,
  Lock,
  Megaphone,
  MessageSquare,
  Mic,
  MicOff,
  Minus,
  MonitorUp,
  Plus,
  Settings,
  Smile,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { EMOTES } from "../game/constants";
import { mediaManager } from "../media/manager";
import { client } from "../net/client";
import { useGameStore } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { prefs, usePrefs, ZOOM_LEVELS } from "../state/prefsStore";
import { ui, useUIStore } from "../state/uiStore";
import { DockButton, PixelEmote, Tooltip } from "./kit";

/** Doca inferior: mídia | emotes, chat, pessoas, atalhos — e status acima. */
export function ControlsBar() {
  const micOn = useMediaStore((s) => s.micOn);
  const camOn = useMediaStore((s) => s.camOn);
  const areaId = useMediaStore((s) => s.areaId);
  const onSpotlight = useMediaStore((s) => s.onSpotlight);
  const unread = useGameStore((s) => s.unreadChat);
  const chatOpen = useUIStore((s) => s.chatOpen);
  const participantsOpen = useUIStore((s) => s.participantsOpen);
  const emotesOpen = useUIStore((s) => s.emotesOpen);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const screenOn = useMediaStore((s) => s.screenOn);
  const mediaConnected = useMediaStore((s) => s.connected);

  return (
    <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
      {emotesOpen && <EmotePicker />}

      {(areaId || onSpotlight) && (
        <div className="flex animate-pop-in gap-2">
          {areaId && (
            <span className="glass inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-violet-200">
              <Lock className="size-3.5 text-violet-300" /> Área privada · <span className="text-white">{areaId}</span>
            </span>
          )}
          {onSpotlight && (
            <span className="glass inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-amber-200">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
              </span>
              <Megaphone className="size-3.5 text-amber-300" /> No palco — o mapa todo te ouve
            </span>
          )}
        </div>
      )}

      <nav aria-label="Controles" className="glass pointer-events-auto flex items-center gap-1.5 rounded-[22px] p-1.5">
        <div data-tour="media" className="flex items-center gap-1.5 rounded-2xl">
          <DockButton
            icon={micOn ? Mic : MicOff}
            label={micOn ? "Silenciar microfone" : "Ativar microfone"}
            shortcut="M"
            tone={micOn ? "active" : "danger"}
            onClick={() => void mediaManager.setMicOn(!micOn)}
          />
          <DockButton
            icon={camOn ? Video : VideoOff}
            label={camOn ? "Desligar câmera" : "Ligar câmera"}
            shortcut="V"
            tone={camOn ? "active" : "danger"}
            onClick={() => void mediaManager.setCamOn(!camOn)}
          />
          <DockButton
            icon={MonitorUp}
            label={
              !mediaConnected
                ? "Compartilhar tela (aguardando conexão de mídia)"
                : screenOn
                  ? "Parar de compartilhar a tela"
                  : "Compartilhar tela"
            }
            shortcut="T"
            tone={screenOn ? "live" : "neutral"}
            disabled={!mediaConnected}
            onClick={() => void mediaManager.setScreenShare(!screenOn)}
          />
        </div>
        <span className="mx-1 h-6 w-px bg-white/10" />
        <div data-tour="social" className="flex items-center gap-1.5 rounded-2xl">
          <DockButton icon={Smile} label="Emotes" shortcut="E" pressed={emotesOpen} onClick={ui.toggleEmotes} />
          <DockButton
            icon={MessageSquare}
            label="Chat"
            shortcut="C"
            pressed={chatOpen}
            badge={chatOpen ? 0 : unread}
            onClick={ui.toggleChat}
          />
          <DockButton
            icon={Users}
            label="Pessoas"
            shortcut="P"
            pressed={participantsOpen}
            onClick={ui.toggleParticipants}
          />
        </div>
        <DockButton icon={Keyboard} label="Atalhos" shortcut="?" pressed={helpOpen} onClick={ui.toggleHelp} />
        <DockButton
          icon={Settings}
          label="Configurações"
          shortcut=","
          tour="settings"
          pressed={settingsOpen}
          onClick={ui.toggleSettings}
        />
      </nav>
    </div>
  );
}

function EmotePicker() {
  return (
    <div className="glass pointer-events-auto flex animate-pop-in items-center gap-1 rounded-[20px] p-1.5">
      {EMOTES.map((e, i) => (
        <Tooltip key={e.id} label={e.label} shortcut={String(i + 1)}>
          <button
            type="button"
            aria-label={`${e.label} (${i + 1})`}
            onClick={() => client.emote(e.id)}
            className="focus-ring grid size-11 place-items-center rounded-2xl transition duration-150 hover:-translate-y-0.5 hover:bg-white/[0.08] active:scale-90"
          >
            <PixelEmote id={e.id} size={24} />
          </button>
        </Tooltip>
      ))}
      <span className="mx-0.5 h-6 w-px bg-white/10" />
      <Tooltip label="Limpar emote" shortcut="0">
        <button
          type="button"
          aria-label="Limpar emote (0)"
          onClick={() => client.emote("clear")}
          className="focus-ring grid size-11 place-items-center rounded-2xl text-ink-400 transition hover:bg-white/[0.08] hover:text-white active:scale-90"
        >
          <X className="size-4" />
        </button>
      </Tooltip>
    </div>
  );
}

/** Zoom do mapa (canto inferior direito): +, nível atual (clique = padrão) e −. */
export function ZoomControl() {
  const zoom = usePrefs((s) => s.zoom);
  const min = zoom <= ZOOM_LEVELS[0];
  const max = zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  const btn =
    "focus-ring grid size-9 place-items-center rounded-xl text-ink-200 transition hover:bg-white/[0.1] hover:text-white active:scale-90 disabled:pointer-events-none disabled:opacity-30";
  return (
    <div
      data-tour="zoom"
      className="glass pointer-events-auto absolute right-3 bottom-3 z-10 flex flex-col items-center gap-0.5 rounded-2xl p-1"
    >
      <Tooltip label="Aproximar" shortcut="+">
        <button type="button" aria-label="Aproximar" disabled={max} onClick={() => prefs.zoomBy(1)} className={btn}>
          <Plus className="size-4" />
        </button>
      </Tooltip>
      <Tooltip label="Zoom padrão">
        <button
          type="button"
          onClick={prefs.resetZoom}
          className="focus-ring h-6 w-9 rounded-lg text-[10px] font-semibold text-ink-300 tabular-nums transition hover:bg-white/[0.08] hover:text-white"
        >
          {Math.round((zoom / 2) * 100)}%
        </button>
      </Tooltip>
      <Tooltip label="Afastar" shortcut="−">
        <button type="button" aria-label="Afastar" disabled={min} onClick={() => prefs.zoomBy(-1)} className={btn}>
          <Minus className="size-4" />
        </button>
      </Tooltip>
    </div>
  );
}
