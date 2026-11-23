import { Globe, MessageSquare, MessagesSquare, SendHorizontal, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatScope } from "../net/messages";
import { sendChat, useGameStore, type ChatEntry } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import { useUIStore } from "../state/uiStore";
import { AvatarHead } from "./AvatarView";
import { cx, Panel, Segmented } from "./kit";

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
    if (focusSeq) inputRef.current?.focus();
  }, [focusSeq]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chat, filter]);

  const submit = () => {
    sendChat(scope, text);
    setText("");
  };

  const visible = filter === "all" ? chat : chat.filter((m) => m.scope === filter);

  return (
    <Panel
      side="right"
      icon={MessageSquare}
      title="Chat"
      onClose={() => useUIStore.setState({ chatOpen: false })}
      actions={
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "Tudo" },
            { id: "nearby", label: "Perto" },
            { id: "map", label: "Mapa" },
          ]}
        />
      }
    >
      <div ref={listRef} className="thin-scroll flex-1 overflow-y-auto px-3 py-3">
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-white/[0.04] text-ink-400 ring-1 ring-white/[0.06]">
              <MessagesSquare className="size-5" />
            </span>
            <p className="text-[13px] font-medium text-ink-200">Nenhuma mensagem ainda</p>
            <p className="text-xs leading-relaxed text-ink-400">
              <b className="font-semibold text-ink-300">Perto</b> fala com quem está na sua conversa;{" "}
              <b className="font-semibold text-ink-300">Mapa</b>, com todo mundo.
            </p>
          </div>
        ) : (
          visible.map((m, i) => {
            const prev = visible[i - 1];
            const grouped = !!prev && prev.playerId === m.playerId && prev.scope === m.scope && m.at - prev.at < 120_000;
            return <Message key={m.id} m={m} own={m.playerId === selfId} grouped={grouped} />;
          })
        )}
      </div>

      <form
        className="border-t border-white/[0.06] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              {
                id: "nearby",
                title: "Só quem está na sua conversa (raio ou área)",
                label: (
                  <>
                    <UsersRound className="size-3" /> Perto · {hear.length}
                  </>
                ),
              },
              {
                id: "map",
                title: "Todos no mapa",
                label: (
                  <>
                    <Globe className="size-3" /> Mapa
                  </>
                ),
              },
            ]}
          />
          <span className="text-[10px] text-ink-500">{text.length > 400 ? `${text.length}/500` : ""}</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-black/30 p-1 pl-3.5 ring-1 ring-white/[0.08] transition focus-within:ring-2 focus-within:ring-brand-400">
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
            className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-ink-500"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Enviar"
            className="focus-ring grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-400 active:scale-90 disabled:bg-white/[0.06] disabled:text-ink-500"
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </form>
    </Panel>
  );
}

function Message({ m, own, grouped }: { m: ChatEntry; own: boolean; grouped: boolean }) {
  const avatar = useGameStore((s) => s.players[m.playerId]?.avatar);
  const time = new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cx("group flex animate-fade-up gap-2.5 rounded-xl px-1.5 hover:bg-white/[0.03]", grouped ? "py-0.5" : "mt-2 pt-1.5 pb-0.5")}>
      <div className="w-8 shrink-0">
        {!grouped && <AvatarHead avatar={avatar} size={32} className="rounded-lg bg-white/[0.05]" />}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className={cx("truncate text-[13px] font-semibold", own ? "text-brand-300" : "text-white")}>
              {m.name}
            </span>
            <span
              className={cx(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[10px] font-medium",
                m.scope === "nearby" ? "bg-violet-400/15 text-violet-200" : "bg-sky-400/10 text-sky-200",
              )}
            >
              {m.scope === "nearby" ? <UsersRound className="size-2.5" /> : <Globe className="size-2.5" />}
              {m.scope === "nearby" ? "perto" : "mapa"}
            </span>
            <span className="ml-auto text-[10px] text-ink-500 tabular-nums">{time}</span>
          </div>
        )}
        <div className="text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink-100 select-text">
          {linkify(m.text)}
        </div>
      </div>
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
        className="text-brand-300 underline decoration-brand-300/40 underline-offset-2 hover:decoration-brand-300"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}
