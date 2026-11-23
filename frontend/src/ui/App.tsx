import {
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  StickyNote,
  Tv,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { EMOTES } from "../game/constants";
import { createGame } from "../game/createGame";
import { mediaManager } from "../media/manager";
import { client } from "../net/client";
import { bindGameStore, useGameStore, type NearbyObject } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { motionReduced, prefs, usePrefs } from "../state/prefsStore";
import { ui, useUIStore } from "../state/uiStore";
import { ChatPanel } from "./ChatPanel";
import { ControlsBar, ZoomControl } from "./ControlsBar";
import { HelpModal } from "./HelpModal";
import { IntroScreen } from "./IntroScreen";
import { Kbd, Logo, Tooltip } from "./kit";
import { ObjectModal } from "./ObjectModal";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { ScreenShareStage } from "./ScreenShareStage";
import { SettingsModal } from "./SettingsModal";
import { Tutorial } from "./Tutorial";
import { VideoGrid } from "./VideoGrid";

bindGameStore(() => useUIStore.getState().chatOpen);
mediaManager.bind();

export function App() {
  const gameRoot = useRef<HTMLDivElement>(null);
  const status = useGameStore((s) => s.status);
  const motion = usePrefs((s) => s.motion);

  // "Reduzir movimento" do app também desliga as animações CSS.
  useEffect(() => {
    document.documentElement.dataset.motion = motionReduced() ? "reduce" : "full";
  }, [motion]);

  useEffect(() => {
    if (!gameRoot.current) return;
    const game = createGame(gameRoot.current);
    return () => game.destroy(true);
  }, []);

  return (
    <div className="relative h-full w-full select-none">
      <div ref={gameRoot} className="absolute inset-0" />
      {status === "connected" || status === "reconnecting" ? <Hud /> : <IntroScreen />}
    </div>
  );
}

/** Atalhos globais (ignorados enquanto um campo de texto tem foco). */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        useUIStore.getState().typing ||
        (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable));
      if (e.key === "Escape") {
        if (typing) (t as HTMLElement).blur();
        else ui.closeTop();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;

      // Toda tecla tratada aqui chama preventDefault: sem isso, abrir o
      // chat com "C" movia o foco para o campo e o "c" era digitado nele.
      const handled = () => e.preventDefault();
      const emoteIndex = "123456".indexOf(e.key);
      if (emoteIndex >= 0) {
        handled();
        client.emote(EMOTES[emoteIndex].id);
        return;
      }
      switch (e.key) {
        case "0":
          handled();
          client.emote("clear");
          break;
        case "x":
        case "X": {
          const obj = useGameStore.getState().nearbyObject;
          if (obj) {
            handled();
            ui.openObject(obj);
          }
          break;
        }
        case "Enter":
          handled();
          ui.openChat();
          break;
        case "c":
        case "C":
          handled();
          ui.toggleChat();
          break;
        case "p":
        case "P":
          handled();
          ui.toggleParticipants();
          break;
        case "m":
        case "M":
          handled();
          void mediaManager.setMicOn(!useMediaStore.getState().micOn);
          break;
        case "v":
        case "V":
          handled();
          void mediaManager.setCamOn(!useMediaStore.getState().camOn);
          break;
        case "e":
        case "E":
          handled();
          ui.toggleEmotes();
          break;
        case "?":
          handled();
          ui.toggleHelp();
          break;
        case "t":
        case "T":
          if (useMediaStore.getState().connected) {
            handled();
            void mediaManager.setScreenShare(!useMediaStore.getState().screenOn);
          }
          break;
        case "+":
        case "=":
          handled();
          prefs.zoomBy(1);
          break;
        case "-":
        case "_":
          handled();
          prefs.zoomBy(-1);
          break;
        case ",":
          handled();
          ui.toggleSettings();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function Hud() {
  useHotkeys();
  const chatOpen = useUIStore((s) => s.chatOpen);
  const participantsOpen = useUIStore((s) => s.participantsOpen);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const openObject = useUIStore((s) => s.openObject);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const tutorialOpen = useUIStore((s) => s.tutorialOpen);

  // Tutorial na primeira vez que a pessoa entra (depois, pelas configurações).
  useEffect(() => {
    if (!usePrefs.getState().tutorialDone) ui.openTutorial();
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0">
      <TopBar />
      <VideoGrid />
      <ScreenShareStage />
      <ControlsBar />
      <ZoomControl />
      <InteractPrompt />
      {chatOpen && <ChatPanel />}
      {participantsOpen && <ParticipantsPanel />}
      {helpOpen && <HelpModal />}
      {settingsOpen && <SettingsModal />}
      {openObject && <ObjectModal obj={openObject} />}
      {tutorialOpen && <Tutorial />}
    </div>
  );
}

function TopBar() {
  const status = useGameStore((s) => s.status);
  const count = useGameStore((s) => Object.keys(s.players).length);
  const mapId = useGameStore((s) => s.mapId);
  const mediaConnected = useMediaStore((s) => s.connected);

  return (
    <header className="absolute top-3 left-3 z-10 flex items-center gap-2">
      <div className="glass pointer-events-auto flex h-11 items-center gap-3 rounded-2xl pr-1.5 pl-3.5">
        <Logo />
        <span className="h-5 w-px bg-white/10" />
        <span className="text-[13px] font-medium text-ink-200 capitalize">{mapId}</span>
        <Tooltip label="Pessoas" shortcut="P" side="bottom">
          <button
            type="button"
            onClick={ui.toggleParticipants}
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-xl bg-white/[0.05] px-2.5 text-[13px] font-medium text-ink-100 transition hover:bg-white/10"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-live" />
            </span>
            <Users className="size-3.5 text-ink-300" />
            {count}
          </button>
        </Tooltip>
      </div>
      {status === "reconnecting" && (
        <div className="glass flex h-11 animate-pop-in items-center gap-2 rounded-2xl px-3.5 text-[13px] font-medium text-amber-300">
          <span className="size-2 animate-pulse rounded-full bg-amber-400" /> Reconectando…
        </div>
      )}
      {!mediaConnected && status === "connected" && (
        <Tooltip label="Vídeo e áudio indisponíveis — o SFU não está acessível" side="bottom">
          <div className="glass pointer-events-auto flex h-11 items-center gap-2 rounded-2xl px-3.5 text-[13px] font-medium text-ink-300">
            <WifiOff className="size-4" /> Mídia offline
          </div>
        </Tooltip>
      )}
    </header>
  );
}

const OBJECT_ICON: Record<NearbyObject["type"], LucideIcon> = {
  iframe: LayoutDashboard,
  video: Tv,
  image: ImageIcon,
  note: StickyNote,
  link: ExternalLink,
};

/** "Pressione X" ao chegar perto de um objeto interativo. */
function InteractPrompt() {
  const nearby = useGameStore((s) => s.nearbyObject);
  const openObject = useUIStore((s) => s.openObject);
  if (!nearby || openObject) return null;
  const Icon = OBJECT_ICON[nearby.type];
  return (
    <button
      key={nearby.objectId}
      type="button"
      onClick={() => ui.openObject(nearby)}
      className="glass pointer-events-auto absolute bottom-[92px] left-1/2 flex -translate-x-1/2 animate-pop-in items-center gap-2.5 rounded-2xl py-2 pr-4 pl-2 text-[13px] text-ink-100 transition hover:bg-ink-800"
    >
      <span className="grid size-8 place-items-center rounded-xl bg-amber-300/15 text-amber-300">
        <Icon className="size-4" />
      </span>
      <span className="font-semibold text-white">{nearby.title}</span>
      <span className="flex items-center gap-1.5 text-ink-400">
        <Kbd className="border-amber-300/30 bg-amber-300/10 text-amber-200">X</Kbd> interagir
      </span>
    </button>
  );
}
