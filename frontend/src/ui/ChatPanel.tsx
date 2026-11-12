import { useEffect, useRef, useState } from "react";
import type { ChatScope } from "../net/messages";
import { sendChat, useGameStore, type ChatEntry } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { useUIStore } from "../state/uiStore";

const SCOPES: { id: ChatScope; label: string; hint: string }[] = [
  { id: "nearby", label: "Perto", hint: "só quem está na sua conversa (raio/área)" },
  { id: "map", label: "Mapa", hint: "todos no mapa" },
];

/** Painel de chat (RF-CHAT-01): escopos Perto/Mapa, histórico e campo de envio. */
export function ChatPanel() {
  const chat = useGameStore((s) => s.chat);
  const selfId = useGameStore((s) => s.selfId);
  const hear = useMediaStore((s) => s.hear);
  const focusSeq = useUIStore((s) => s.chatFocusSeq);
  const [scope, setScope] = useState<ChatScope>("nearby");
  const [filter, setFilter] = useState<ChatScope | "all">("all");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useGameStore.setState({ unreadChat: 0 });
  }, [chat]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusSeq]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, filter]);

  const submit = () => {
    sendChat(scope, text);
    setText("");
  };

  const visible = filter === "all" ? chat : chat.filter((m) => m.scope === filter);

  return (
    <aside
      className="pointer-events-auto absolute top-36 right-3 bottom-20 flex w-80 flex-col rounded-xl bg-slate-900/90 text-sm text-white shadow-2xl ring-1 ring-white/10 backdrop-blur"
      aria-label="Chat"
    >
      <header className="flex items-center gap-1 border-b border-white/10 p-2">
        <span className="mr-auto px-1 font-semibold">Chat</span>
        {(["all", "nearby", "map"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-2 py-0.5 text-xs ${filter === f ? "bg-white/20" : "hover:bg-white/10"}`}
          >
            {f === "all" ? "Tudo" : f === "nearby" ? "Perto" : "Mapa"}
          </button>
        ))}
        <button
          onClick={() => useUIStore.setState({ chatOpen: false })}
          className="ml-1 rounded px-2 py-0.5 text-xs hover:bg-white/10"
          aria-label="Fechar chat"
        >
          ✕
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {visible.length === 0 && (
          <p className="p-2 text-center text-xs text-slate-400">
            Nenhuma mensagem ainda. Diga oi! 👋
          </p>
        )}
        {visible.map((m) => (
          <Message key={m.id} m={m} own={m.playerId === selfId} />
        ))}
      </div>

      <form
        className="border-t border-white/10 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="mb-1 flex gap-1">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.hint}
              onClick={() => setScope(s.id)}
              className={`rounded px-2 py-0.5 text-xs ${
                scope === s.id ? "bg-emerald-600" : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {s.label}
              {s.id === "nearby" && ` (${hear.length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            ref={inputRef}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => useUIStore.setState({ typing: true })}
            onBlur={() => useUIStore.setState({ typing: false })}
            onKeyDown={(e) => {
              if (e.key === "Escape") (e.target as HTMLInputElement).blur();
            }}
            placeholder={scope === "nearby" ? "Mensagem para quem está perto…" : "Mensagem para o mapa…"}
            className="flex-1 rounded-md bg-slate-800 px-2 py-1.5 outline-none placeholder-slate-500 focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-md bg-emerald-600 px-3 font-semibold hover:bg-emerald-500 disabled:opacity-40"
          >
            ➤
          </button>
        </div>
      </form>
    </aside>
  );
}

function Message({ m, own }: { m: ChatEntry; own: boolean }) {
  const time = new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`rounded-lg px-2 py-1 ${own ? "bg-emerald-900/40" : "bg-white/5"}`}>
      <div className="flex items-baseline gap-2 text-xs">
        <span className={`font-semibold ${own ? "text-emerald-300" : "text-sky-300"}`}>{m.name}</span>
        <span
          className={`rounded px-1 text-[10px] ${m.scope === "nearby" ? "bg-purple-700/70" : "bg-slate-600/70"}`}
        >
          {m.scope === "nearby" ? "perto" : "mapa"}
        </span>
        <span className="ml-auto text-slate-500">{time}</span>
      </div>
      <div className="break-words whitespace-pre-wrap">{linkify(m.text)}</div>
    </div>
  );
}

// Links clicáveis (RF-CHAT-05). O React escapa o texto; só URLs http(s)
// viram <a>, com rel=noopener para não vazar o opener.
const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
function linkify(text: string) {
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-300 underline hover:text-sky-200"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}
