import { useEffect, useRef, useState } from "react";
import { createGame } from "../game/createGame";
import { client } from "../net/client";
import { bindGameStore, useGameStore } from "../state/gameStore";

bindGameStore();

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
  const [name, setName] = useState("");

  const join = () => {
    if (status === "connecting") return;
    client.connect(name.trim() || "Convidado");
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
      <div className="w-80 rounded-xl bg-slate-800 p-6 shadow-2xl">
        <h1 className="mb-1 text-center font-mono text-2xl font-bold text-white">PixelRooms</h1>
        <p className="mb-5 text-center text-sm text-slate-400">
          Escolha um nome para entrar no lobby
        </p>
        <input
          autoFocus
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="Seu nome"
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

function Hud() {
  const status = useGameStore((s) => s.status);
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const list = Object.values(players);

  return (
    <>
      <header className="pointer-events-none absolute top-0 left-0 flex w-full items-start justify-between p-3 text-sm text-white/90">
        <span className="rounded bg-black/50 px-3 py-1 font-mono font-semibold">PixelRooms</span>
        {status === "reconnecting" && (
          <span className="rounded bg-amber-600/80 px-3 py-1">reconectando…</span>
        )}
        <div className="rounded bg-black/50 px-3 py-2">
          <div className="mb-1 font-semibold">online — {list.length}</div>
          <ul className="max-h-48 space-y-0.5 overflow-y-auto">
            {list.map((p) => (
              <li key={p.playerId} className={p.playerId === selfId ? "text-emerald-400" : ""}>
                {p.name}
                {p.playerId === selfId && " (você)"}
              </li>
            ))}
          </ul>
        </div>
      </header>
      <footer className="pointer-events-none absolute bottom-0 left-0 p-3 text-xs text-white/60">
        <span className="rounded bg-black/50 px-2 py-1">mover: WASD ou setas</span>
      </footer>
    </>
  );
}
