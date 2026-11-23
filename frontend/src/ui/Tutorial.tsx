import { ArrowLeft, ArrowRight, Check, MousePointerClick, PartyPopper, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { selfScreenRect } from "../game/scenes/WorldScene";
import { useGameStore } from "../state/gameStore";
import { prefs } from "../state/prefsStore";
import { useUIStore } from "../state/uiStore";
import { cx, Kbd, Logo, PixelEmote } from "./kit";

interface Step {
  /** data-tour do elemento a destacar; "self" = o próprio avatar; null = centro da tela. */
  target: string | null;
  title: string;
  body: ReactNode;
  /** Passo "tente você": conclui quando a condição vira verdadeira. */
  task?: "move";
}

const STEPS: Step[] = [
  {
    target: null,
    title: "Boas-vindas ao PixelRooms!",
    body: (
      <>
        Um escritório virtual onde você anda pelo mapa e conversa por vídeo com quem estiver por perto,
        como numa sala de verdade. Leva 1 minuto — vamos lá?
      </>
    ),
  },
  {
    target: "self",
    title: "Este é você",
    body: (
      <>
        Ande com{" "}
        <span className="inline-flex gap-0.5 align-middle">
          <Kbd>W</Kbd>
          <Kbd>A</Kbd>
          <Kbd>S</Kbd>
          <Kbd>D</Kbd>
        </span>{" "}
        ou as setas — ou <b className="text-white">clique no chão</b> para ir até lá. Experimente agora!
      </>
    ),
    task: "move",
  },
  {
    target: "videos",
    title: "Conversa por proximidade",
    body: (
      <>
        Chegue a até 5 passos de alguém e o vídeo e o áudio ligam sozinhos. Afastou, desligou. Os rostos
        aparecem aqui em cima.
      </>
    ),
  },
  {
    target: "media",
    title: "Microfone, câmera e tela",
    body: (
      <>
        Ligue e desligue o microfone (<Kbd>M</Kbd>) e a câmera (<Kbd>V</Kbd>), ou{" "}
        <b className="text-white">compartilhe sua tela</b> (<Kbd>T</Kbd>) com quem está na conversa.
      </>
    ),
  },
  {
    target: "social",
    title: "Emotes, chat e pessoas",
    body: (
      <span className="block">
        <span className="mb-2 flex gap-1">
          {["wave", "heart", "party", "thumbsup", "question", "laugh"].map((id) => (
            <PixelEmote key={id} id={id} size={24} />
          ))}
        </span>
        Reaja com <Kbd>1</Kbd>–<Kbd>6</Kbd>, escreva no chat com <Kbd>Enter</Kbd> e veja quem está online
        com <Kbd>P</Kbd>.
      </span>
    ),
  },
  {
    target: null,
    title: "Explore o escritório",
    body: (
      <ul className="space-y-2">
        <Bullet color="bg-amber-300">
          Perto de um objeto (TV, quadro branco, mural) aperte <Kbd>X</Kbd> para abrir.
        </Bullet>
        <Bullet color="bg-violet-400">
          No <b className="text-white">tapete roxo</b> (sala de reunião) só quem está dentro se ouve.
        </Bullet>
        <Bullet color="bg-rose-400">
          No <b className="text-white">palco vermelho</b> o mapa inteiro te ouve.
        </Bullet>
        <Bullet color="bg-teal-300">Sente-se numa das 28 estações de trabalho para ficar perto do time.</Bullet>
      </ul>
    ),
  },
  {
    target: "zoom",
    title: "Zoom do mapa",
    body: (
      <>
        Aproxime ou afaste com a roda do mouse, as teclas <Kbd>+</Kbd> <Kbd>−</Kbd> ou estes botões.
      </>
    ),
  },
  {
    target: "settings",
    title: "Configurações",
    body: (
      <>
        Troque nome e visual, escolha microfone e câmera, ajuste o volume e reveja este tutorial quando
        quiser.
      </>
    ),
  },
];

const PAD = 8;

/** Tour guiado de primeira visita, com destaque no elemento de cada passo. */
export function Tutorial() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const rect = useTargetRect(step.target);
  const done = useTaskDone(step.task, i);
  const last = i === STEPS.length - 1;

  const finish = () => {
    prefs.set({ tutorialDone: true });
    useUIStore.setState({ tutorialOpen: false });
  };
  const next = () => (last ? finish() : setI(i + 1));

  // Teclado: → / Enter avança, ← volta, Esc pula. Não intercepta WASD:
  // no passo de andar o usuário precisa delas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && step.task !== "move") next();
      else if (e.key === "Enter") next();
      else if (e.key === "ArrowLeft" && i > 0 && step.task !== "move") setI(i - 1);
      else if (e.key === "Escape") finish();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  // Passo de andar concluído: avança sozinho depois de comemorar.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setI((n) => (n === i ? n + 1 : n)), 1100);
    return () => clearTimeout(t);
  }, [done, i]);

  const hole = rect && {
    left: rect.x - PAD,
    top: rect.y - PAD,
    width: rect.w + PAD * 2,
    height: rect.h + PAD * 2,
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-40" role="dialog" aria-label="Tutorial">
      {/* escurece tudo menos o alvo (o "buraco" deixa o mundo clicável no passo de andar) */}
      {hole ? (
        <div
          className="absolute rounded-[20px] shadow-[0_0_0_9999px_rgb(8_7_13/0.62)] ring-2 ring-brand-400/80 transition-all duration-300 ease-[var(--ease-out-quint)]"
          style={hole}
        >
          <span className="absolute inset-0 animate-ping rounded-[20px] ring-2 ring-brand-400/40 [animation-duration:1.8s]" />
        </div>
      ) : (
        <div className="absolute inset-0 animate-fade-in bg-ink-950/62" />
      )}

      <Card rect={hole} key={i}>
        <div className="mb-3 flex items-center justify-between">
          {i === 0 ? (
            <Logo />
          ) : (
            <span className="text-[11px] font-semibold tracking-wider text-brand-300 uppercase">
              Passo {i} de {STEPS.length - 1}
            </span>
          )}
          <button
            type="button"
            onClick={finish}
            className="focus-ring rounded-lg px-2 py-1 text-xs font-medium text-ink-400 transition hover:text-white"
          >
            Pular tutorial
          </button>
        </div>
        <h2 className="mb-1.5 text-lg font-semibold text-white">{step.title}</h2>
        <div className="text-[13px] leading-relaxed text-ink-200">{step.body}</div>

        {step.task === "move" && (
          <div
            className={cx(
              "mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition",
              done ? "bg-live/15 text-live" : "bg-white/[0.04] text-ink-300",
            )}
          >
            {done ? <Check className="size-4" /> : <MousePointerClick className="size-4 animate-pulse" />}
            {done ? "Isso aí! Você já sabe andar." : "Esperando você dar uns passos…"}
          </div>
        )}

        <footer className="mt-5 flex items-center gap-2">
          <div className="mr-auto flex gap-1">
            {STEPS.map((_, n) => (
              <span
                key={n}
                className={cx(
                  "h-1.5 rounded-full transition-all duration-300",
                  n === i ? "w-5 bg-brand-400" : n < i ? "w-1.5 bg-brand-400/50" : "w-1.5 bg-white/15",
                )}
              />
            ))}
          </div>
          {i > 0 && (
            <NavButton icon={ArrowLeft} onClick={() => setI(i - 1)} subtle>
              Voltar
            </NavButton>
          )}
          <NavButton icon={last ? PartyPopper : ArrowRight} onClick={next}>
            {i === 0 ? "Começar" : last ? "Concluir" : step.task && !done ? "Pular" : "Próximo"}
          </NavButton>
        </footer>
      </Card>
    </div>
  );
}

/** Cartão do passo, posicionado ao lado do destaque (ou centralizado). */
function Card({ rect, children }: { rect: { left: number; top: number; width: number; height: number } | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!rect) {
      setPos({ left: (W - w) / 2, top: (H - h) / 2 });
      return;
    }
    const gap = 16;
    const clampX = (x: number) => Math.min(W - w - 12, Math.max(12, x));
    const clampY = (y: number) => Math.min(H - h - 12, Math.max(12, y));
    const cx = rect.left + rect.width / 2;
    // prefere abaixo; senão acima; senão ao lado
    if (rect.top + rect.height + gap + h < H) setPos({ left: clampX(cx - w / 2), top: rect.top + rect.height + gap });
    else if (rect.top - gap - h > 0) setPos({ left: clampX(cx - w / 2), top: rect.top - gap - h });
    else if (rect.left - gap - w > 0) setPos({ left: rect.left - gap - w, top: clampY(rect.top + rect.height / 2 - h / 2) });
    else setPos({ left: clampX(rect.left + rect.width + gap), top: clampY(rect.top + rect.height / 2 - h / 2) });
  }, [rect?.left, rect?.top, rect?.width, rect?.height]);

  return (
    <div
      ref={ref}
      className="glass pointer-events-auto absolute w-[min(380px,calc(100vw-24px))] animate-pop-in rounded-[22px] p-5"
      style={pos ?? { left: -9999, top: 0 }}
    >
      {children}
    </div>
  );
}

function NavButton({
  icon: Icon,
  onClick,
  subtle,
  children,
}: {
  icon: LucideIcon;
  onClick: () => void;
  subtle?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold transition active:scale-95",
        subtle
          ? "text-ink-300 hover:bg-white/[0.06] hover:text-white"
          : "bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-[0_6px_18px_-6px_rgb(124_58_237/0.8)] hover:brightness-110",
      )}
    >
      {subtle && <Icon className="size-4" />}
      {children}
      {!subtle && <Icon className="size-4" />}
    </button>
  );
}

function Bullet({ color, children }: { color: string; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className={cx("mt-1.5 size-2 shrink-0 rounded-[3px]", color)} />
      <span>{children}</span>
    </li>
  );
}

/** Acompanha a posição do alvo (elemento da UI ou o avatar) a cada frame. */
function useTargetRect(target: string | null) {
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    let raf = 0;
    let lastKey = "";
    const tick = () => {
      let r: { x: number; y: number; w: number; h: number } | null = null;
      if (target === "self") r = selfScreenRect();
      else {
        const el = document.querySelector(`[data-tour="${target}"]`);
        if (el) {
          const b = el.getBoundingClientRect();
          if (b.width && b.height) r = { x: b.left, y: b.top, w: b.width, h: b.height };
        }
      }
      const key = r ? `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}` : "";
      if (key !== lastKey) {
        lastKey = key;
        setRect(r);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return rect;
}

/** Detecta a conclusão do passo "tente você". */
function useTaskDone(task: Step["task"], stepIndex: number) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
    if (task !== "move") return;
    const { selfId, players } = useGameStore.getState();
    const start = selfId ? players[selfId] : undefined;
    let steps = 0;
    return useGameStore.subscribe((s) => {
      const me = s.selfId ? s.players[s.selfId] : undefined;
      if (!me || !start) return;
      if (me.x !== start.x || me.y !== start.y) {
        steps++;
        if (steps >= 2) setDone(true);
      }
    });
  }, [task, stepIndex]);
  return done;
}
