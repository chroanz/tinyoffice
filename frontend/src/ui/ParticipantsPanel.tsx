import { AudioLines, Megaphone, Search, Users } from "lucide-react";
import { useState } from "react";
import { useGameStore } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { useUIStore } from "../state/uiStore";
import { AvatarHead } from "./AvatarView";
import { cx, Panel } from "./kit";

/** Lista de pessoas online com status (RF-CHAT-03). */
export function ParticipantsPanel() {
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const hear = useMediaStore((s) => s.hear);
  const spotlights = useMediaStore((s) => s.spotlights);
  const speaking = useMediaStore((s) => s.speaking);
  const [q, setQ] = useState("");

  const all = Object.values(players).sort((a, b) =>
    a.playerId === selfId ? -1 : b.playerId === selfId ? 1 : a.name.localeCompare(b.name),
  );
  const list = q ? all.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : all;
  const nearbyCount = all.filter((p) => p.playerId !== selfId && hear.includes(p.playerId)).length;

  return (
    <Panel
      side="left"
      icon={Users}
      title={`Pessoas · ${all.length}`}
      subtitle={nearbyCount ? `${nearbyCount} na sua conversa` : "Ninguém por perto ainda"}
      onClose={() => useUIStore.setState({ participantsOpen: false })}
      className="bottom-auto max-h-[calc(100%-10rem)]"
    >
      {all.length > 6 && (
        <div className="px-3 pt-3">
          <label className="flex h-9 items-center gap-2 rounded-xl bg-black/30 px-3 ring-1 ring-white/[0.08] focus-within:ring-2 focus-within:ring-brand-400">
            <Search className="size-3.5 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => useUIStore.setState({ typing: true })}
              onBlur={() => useUIStore.setState({ typing: false })}
              placeholder="Buscar pessoa"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-ink-500"
            />
          </label>
        </div>
      )}
      <ul className="thin-scroll overflow-y-auto p-2">
        {list.map((p) => {
          const self = p.playerId === selfId;
          const talking = speaking.includes(p.playerId);
          const onStage = spotlights.includes(p.playerId);
          const near = !self && hear.includes(p.playerId);
          return (
            <li key={p.playerId} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.04]">
              <span
                className={cx(
                  "relative rounded-xl bg-white/[0.05] p-0.5 transition",
                  talking ? "ring-2 ring-live shadow-[0_0_14px_-2px_var(--color-live)]" : "ring-1 ring-white/[0.06]",
                )}
              >
                <AvatarHead avatar={p.avatar} size={32} className="rounded-[10px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-white">{p.name}</span>
                  {self && (
                    <span className="rounded-md bg-brand-500/20 px-1.5 py-px text-[10px] font-semibold text-brand-300">
                      você
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-ink-400">
                  {onStage ? (
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Megaphone className="size-3" /> no palco
                    </span>
                  ) : near ? (
                    <span className="inline-flex items-center gap-1 text-live">
                      <AudioLines className="size-3" /> na conversa
                    </span>
                  ) : (
                    <span>{self ? "online" : "no mapa"}</span>
                  )}
                </div>
              </div>
              {talking && <AudioLines className="size-4 animate-pulse text-live" />}
            </li>
          );
        })}
        {list.length === 0 && <li className="px-2 py-6 text-center text-xs text-ink-400">Ninguém com esse nome.</li>}
      </ul>
    </Panel>
  );
}
