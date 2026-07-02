import { useEffect, useRef } from "react";
import { createGame } from "../game/createGame";
import { useAppStore } from "../state/appStore";

export function App() {
  const gameRoot = useRef<HTMLDivElement>(null);
  const backendVersion = useAppStore((s) => s.backendVersion);
  const setBackendVersion = useAppStore((s) => s.setBackendVersion);

  useEffect(() => {
    if (!gameRoot.current) return;
    const game = createGame(gameRoot.current);
    return () => game.destroy(true);
  }, []);

  useEffect(() => {
    fetch("/api/v1/version")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { version: string }) => setBackendVersion(data.version))
      .catch(() => setBackendVersion(null));
  }, [setBackendVersion]);

  return (
    <div className="relative h-full w-full">
      <div ref={gameRoot} className="absolute inset-0" />

      {/* UI em DOM por cima do canvas (ESPECIFICACAO.md §5.7) */}
      <header className="pointer-events-none absolute top-0 left-0 flex w-full items-center justify-between p-3 text-sm text-white/90">
        <span className="rounded bg-black/50 px-3 py-1 font-semibold">PixelRooms</span>
        <span className="rounded bg-black/50 px-3 py-1">
          backend:{" "}
          {backendVersion ?? <span className="text-red-400">offline</span>}
        </span>
      </header>
    </div>
  );
}
