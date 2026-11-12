import { useEffect, useRef, useState } from "react";
import { DEFAULT_AVATAR, normalizeAvatar } from "../game/avatarCatalog";
import { EMOTES } from "../game/constants";
import { createGame } from "../game/createGame";
import { mediaManager } from "../media/manager";
import { client } from "../net/client";
import type { AvatarConfig } from "../net/messages";
import { bindGameStore, useGameStore } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { ui, useUIStore } from "../state/uiStore";
import { AvatarPicker } from "./AvatarPicker";
import { ChatPanel } from "./ChatPanel";
import { ControlsBar } from "./ControlsBar";
import { HelpModal } from "./HelpModal";
import { ObjectModal } from "./ObjectModal";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { VideoGrid } from "./VideoGrid";

bindGameStore(() => useUIStore.getState().chatOpen);
mediaManager.bind();

const PROFILE_KEY = "pixelrooms.profile";

interface Profile {
  name: string;
  avatar: AvatarConfig;
}

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>;
      return { name: typeof p.name === "string" ? p.name : "", avatar: normalizeAvatar(p.avatar) };
    }
  } catch {
    // storage indisponível ou corrompido: usa o padrão
  }
  return { name: "", avatar: DEFAULT_AVATAR };
}

function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // ignorar (modo privado etc.)
  }
}

export function App() {
  const gameRoot = useRef<HTMLDivElement>(null);
  const status = useGameStore((s) => s.status);

  useEffect(() => {
    if (!gameRoot.current) return;
    const game = createGame(gameRoot.current);
    return () => game.destroy(true);
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={gameRoot} className="absolute inset-0" />
      {status === "connected" || status === "reconnecting" ? <Hud /> : <JoinOverlay />}
    </div>
  );
}

function JoinOverlay() {
  const status = useGameStore((s) => s.status);
  const [profile, setProfile] = useState<Profile>(loadProfile);

  const join = () => {
    if (status === "connecting") return;
    const name = profile.name.trim() || "Convidado";
    saveProfile({ ...profile, name });
    client.connect(name, profile.avatar);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="w-[26rem] max-w-full rounded-xl bg-slate-800 p-6 shadow-2xl">
        <h1 className="mb-1 text-center font-mono text-2xl font-bold text-white">PixelRooms</h1>
        <p className="mb-4 text-center text-sm text-slate-400">
          Monte seu avatar, teste a câmera e entre no lobby
        </p>
        <AvatarPicker value={profile.avatar} onChange={(avatar) => setProfile({ ...profile, avatar })} />
        <DeviceTest />
        <input
          autoFocus
          maxLength={24}
          value={profile.name}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="Seu nome"
          aria-label="Seu nome"
          className="mb-3 w-full rounded-md bg-slate-700 px-3 py-2 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={join}
          disabled={status === "connecting"}
          className="w-full rounded-md bg-emerald-600 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {status === "connecting" ? "Conectando…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

/**
 * Teste de câmera/microfone antes de entrar (RF-RTC-07): preview local e
 * escolha do estado inicial de mic/câmera, que o MediaManager respeita ao
 * conectar no SFU.
 */
function DeviceTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const micOn = useMediaStore((s) => s.micOn);
  const camOn = useMediaStore((s) => s.camOn);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError(true));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <div className="mb-4">
      <div className="relative h-36 w-full overflow-hidden rounded-lg bg-slate-900">
        {error || !camOn ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {error ? "câmera/microfone indisponíveis" : "câmera desligada"}
          </div>
        ) : (
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
        )}
      </div>
      <div className="mt-2 flex justify-center gap-2">
        <button
          onClick={() => useMediaStore.setState({ micOn: !micOn })}
          className={`rounded px-3 py-1 text-sm text-white ${micOn ? "bg-slate-600" : "bg-red-600"}`}
        >
          {micOn ? "🎙️ mic ligado" : "🔇 mic desligado"}
        </button>
        <button
          onClick={() => useMediaStore.setState({ camOn: !camOn })}
          className={`rounded px-3 py-1 text-sm text-white ${camOn ? "bg-slate-600" : "bg-red-600"}`}
        >
          {camOn ? "📷 cam ligada" : "🚫 cam desligada"}
        </button>
      </div>
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
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

      const emoteIndex = "123456".indexOf(e.key);
      if (emoteIndex >= 0) {
        client.emote(EMOTES[emoteIndex].id);
        return;
      }
      switch (e.key) {
        case "0":
          client.emote("clear");
          break;
        case "x":
        case "X": {
          const obj = useGameStore.getState().nearbyObject;
          if (obj) ui.openObject(obj);
          break;
        }
        case "Enter":
          e.preventDefault();
          ui.openChat();
          break;
        case "c":
        case "C":
          ui.toggleChat();
          break;
        case "p":
        case "P":
          ui.toggleParticipants();
          break;
        case "m":
        case "M":
          void mediaManager.setMicOn(!useMediaStore.getState().micOn);
          break;
        case "v":
        case "V":
          void mediaManager.setCamOn(!useMediaStore.getState().camOn);
          break;
        case "?":
          ui.toggleHelp();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function Hud() {
  useHotkeys();
  const status = useGameStore((s) => s.status);
  const count = useGameStore((s) => Object.keys(s.players).length);
  const mapId = useGameStore((s) => s.mapId);
  const nearby = useGameStore((s) => s.nearbyObject);
  const chatOpen = useUIStore((s) => s.chatOpen);
  const participantsOpen = useUIStore((s) => s.participantsOpen);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const openObject = useUIStore((s) => s.openObject);

  return (
    <>
      <VideoGrid />
      <ControlsBar />
      {chatOpen && <ChatPanel />}
      {participantsOpen && <ParticipantsPanel />}
      {helpOpen && <HelpModal />}
      {openObject && <ObjectModal obj={openObject} />}

      <header className="pointer-events-none absolute top-0 left-0 flex w-full items-start justify-between p-3 text-sm text-white/90">
        <span className="rounded bg-black/50 px-3 py-1 font-mono font-semibold">
          PixelRooms <span className="font-normal text-white/50">· {mapId}</span>
        </span>
        {status === "reconnecting" && (
          <span className="rounded bg-amber-600/80 px-3 py-1">reconectando…</span>
        )}
        <button
          onClick={ui.toggleParticipants}
          className="pointer-events-auto rounded bg-black/50 px-3 py-1 hover:bg-black/70"
          title="Participantes (P)"
        >
          👥 {count} online
        </button>
      </header>

      {nearby && !openObject && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-yellow-400 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-lg">
          <kbd className="rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-xs text-yellow-300">X</kbd>{" "}
          {nearby.title}
        </div>
      )}

      <footer className="pointer-events-none absolute bottom-0 left-0 p-3 text-xs text-white/60">
        <span className="rounded bg-black/50 px-2 py-1">WASD/setas ou clique para andar · ? atalhos</span>
      </footer>
    </>
  );
}
