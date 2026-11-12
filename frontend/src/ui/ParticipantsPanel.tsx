import { AVATAR_CATALOG } from "../game/avatarCatalog";
import { useGameStore } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { useUIStore } from "../state/uiStore";

/** Lista de participantes online com status (RF-CHAT-03). */
export function ParticipantsPanel() {
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const hear = useMediaStore((s) => s.hear);
  const spotlights = useMediaStore((s) => s.spotlights);
  const speaking = useMediaStore((s) => s.speaking);

  const list = Object.values(players).sort((a, b) =>
    a.playerId === selfId ? -1 : b.playerId === selfId ? 1 : a.name.localeCompare(b.name),
  );

  return (
    <aside
      className="pointer-events-auto absolute top-36 left-3 flex max-h-[60%] w-64 flex-col rounded-xl bg-slate-900/90 text-sm text-white shadow-2xl ring-1 ring-white/10 backdrop-blur"
      aria-label="Participantes"
    >
      <header className="flex items-center border-b border-white/10 p-2">
        <span className="px-1 font-semibold">Online — {list.length}</span>
        <button
          onClick={() => useUIStore.setState({ participantsOpen: false })}
          className="ml-auto rounded px-2 py-0.5 text-xs hover:bg-white/10"
          aria-label="Fechar lista"
        >
          ✕
        </button>
      </header>
      <ul className="overflow-y-auto p-1">
        {list.map((p) => {
          const self = p.playerId === selfId;
          const top = AVATAR_CATALOG.top.find((t) => t.id === p.avatar?.top)?.color ?? "#888";
          const tags: string[] = [];
          if (spotlights.includes(p.playerId)) tags.push("🎤 no palco");
          else if (!self && hear.includes(p.playerId)) tags.push("🔊 na conversa");
          return (
            <li key={p.playerId} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${speaking.includes(p.playerId) ? "ring-2 ring-emerald-400" : ""}`}
                style={{ background: top }}
              />
              <span className={`truncate ${self ? "text-emerald-300" : ""}`}>
                {p.name}
                {self && " (você)"}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-400">{tags.join(" ")}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
