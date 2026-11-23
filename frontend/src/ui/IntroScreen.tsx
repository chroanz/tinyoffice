import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AVATAR_OPTIONS,
  AVATAR_PRESETS,
  joinId,
  randomAvatar,
  splitId,
  type AvatarLayer,
} from "../game/avatarCatalog";
import { client } from "../net/client";
import type { AvatarConfig, Direction } from "../net/messages";
import { useMediaStore } from "../state/mediaStore";
import { loadProfile, saveProfile } from "../state/profile";
import { AvatarHead, AvatarSprite } from "./AvatarView";
import { cx } from "./kit";
import { useMicLevel } from "./useMicLevel";

/**
 * Entrada no estilo das introduções de RPG de GBA: uma anfitriã conversa
 * com você numa caixa de texto (digitação letra a letra, ▼ para avançar,
 * menu SIM/NÃO com cursor ▶), pergunta seu nome, abre a personalização e
 * testa câmera/microfone antes de entrar. Personagem e falas são
 * originais do PixelRooms.
 *
 * Controles: Enter/Espaço/Z/clique avançam; ↑↓ movem o cursor; ←→ mudam
 * valores; Esc/X voltam no menu.
 */

const HOST: AvatarConfig = { body: "tone4", bottom: "skirt-black", top: "jacket-purple", hair: "bun-black", hat: "none", bag: "none" };
const HOST_NAME = "IARA";

type Step =
  | { kind: "say"; text: string; next: StepId }
  | { kind: "ask"; text: string; options: { label: string; next: StepId }[] }
  | { kind: "name" }
  | { kind: "custom" }
  | { kind: "devices" }
  | { kind: "enter" };

type StepId =
  | "hello"
  | "intro1"
  | "intro2"
  | "intro3"
  | "askName"
  | "name"
  | "confirmName"
  | "lookIntro"
  | "custom"
  | "lookDone"
  | "devIntro"
  | "devices"
  | "final"
  | "enter"
  | "back"
  | "backMenu";

export function IntroScreen() {
  const saved = useMemo(loadProfile, []);
  const returning = saved.name.trim() !== "";
  const [name, setName] = useState(saved.name);
  const [avatar, setAvatar] = useState<AvatarConfig>(saved.avatar);
  const [stepId, setStepId] = useState<StepId>(returning ? "back" : "hello");
  const [flash, setFlash] = useState(false);

  const n = name.trim() || "Convidado";
  const steps: Record<StepId, Step> = {
    hello: { kind: "say", text: "Olá, olá! Boas-vindas ao PixelRooms!", next: "intro1" },
    intro1: { kind: "say", text: `Meu nome é Iara. Sou a recepcionista deste escritório.`, next: "intro2" },
    intro2: {
      kind: "say",
      text: "Aqui, as pessoas andam pelas salas e conversam por vídeo com quem estiver por perto… como num escritório de verdade!",
      next: "intro3",
    },
    intro3: { kind: "say", text: "Antes de te deixar entrar, preciso fazer o seu crachá.", next: "askName" },
    askName: { kind: "say", text: "Primeiro, me diga: como você quer ser chamado?", next: "name" },
    name: { kind: "name" },
    confirmName: {
      kind: "ask",
      text: `Então seu nome é ${n}?`,
      options: [
        { label: "SIM", next: "lookIntro" },
        { label: "NÃO", next: "name" },
      ],
    },
    lookIntro: {
      kind: "say",
      text: `Prazer, ${n}! Agora me mostre como você é. Pode caprichar no visual!`,
      next: "custom",
    },
    custom: { kind: "custom" },
    lookDone: { kind: "say", text: "Uau, ficou ótimo! Combina muito com você.", next: "devIntro" },
    devIntro: {
      kind: "say",
      text: "Por último, vamos testar sua câmera e seu microfone. Assim todo mundo te vê e te ouve direitinho.",
      next: "devices",
    },
    devices: { kind: "devices" },
    final: {
      kind: "say",
      text: `Tudo pronto, ${n}! Seu crachá está feito. O escritório inteiro te espera… Vamos lá!`,
      next: "enter",
    },
    enter: { kind: "enter" },
    back: { kind: "say", text: `Ah, ${n}! Que bom te ver de novo por aqui.`, next: "backMenu" },
    backMenu: {
      kind: "ask",
      text: "O que vamos fazer hoje?",
      options: [
        { label: "ENTRAR", next: "devIntro" },
        { label: "MUDAR VISUAL", next: "custom" },
        { label: "TROCAR NOME", next: "name" },
      ],
    },
  };
  const step = steps[stepId];
  const stage = step.kind === "say" || step.kind === "ask" || step.kind === "enter";
  const showMe =
    returning || ["confirmName", "lookIntro", "lookDone", "devIntro", "final", "enter"].includes(stepId);

  useEffect(() => {
    if (step.kind !== "enter") return;
    saveProfile({ name: n, avatar });
    setFlash(true);
    const t = setTimeout(() => client.connect(n, avatar), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  const go = (id: StepId) => setStepId(id);

  return (
    <div className="absolute inset-0 z-30 overflow-hidden bg-[#0d0b1a] font-pixel select-none">
      <Backdrop />

      {/* palco: anfitriã e, depois que você tem nome, você ao lado dela */}
      {stage && (
        <div className="absolute inset-x-0 top-[8%] bottom-[34%] flex items-end justify-center gap-[12vw]">
          <Character avatar={HOST} label={HOST_NAME} />
          {showMe && <Character avatar={avatar} label={n.toUpperCase()} />}
        </div>
      )}

      {step.kind === "say" && <DialogBox key={stepId} text={step.text} onDone={() => go(step.next)} />}
      {step.kind === "ask" && (
        <DialogBox key={stepId} text={step.text} onDone={() => undefined}>
          {(typed) =>
            typed && <ChoiceMenu options={step.options.map((o) => o.label)} onPick={(i) => go(step.options[i].next)} />
          }
        </DialogBox>
      )}
      {step.kind === "name" && (
        <NameEntry
          initial={name}
          avatar={avatar}
          onCancel={returning ? () => go("backMenu") : undefined}
          onDone={(v) => {
            setName(v);
            go(returning ? "backMenu" : "confirmName");
          }}
        />
      )}
      {step.kind === "custom" && (
        <Customizer
          value={avatar}
          onChange={setAvatar}
          onDone={() => {
            saveProfile({ name: n, avatar });
            go(returning ? "backMenu" : "lookDone");
          }}
        />
      )}
      {step.kind === "devices" && <DeviceCheck onDone={() => go("final")} />}

      {/* transição de entrada: flash branco */}
      <div
        className={cx(
          "pointer-events-none absolute inset-0 bg-white transition-opacity duration-300",
          flash ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

// ── Cenário ─────────────────────────────────────────────────────────

function Backdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_45%,#3a2f6b_0%,#1a1533_55%,#0d0b1a_100%)]" />
      {/* piso em losangos pixelados, rolando devagar */}
      <div
        className="pixelated absolute inset-x-0 bottom-[30%] h-[22%] opacity-60 [mask-image:linear-gradient(to_top,transparent,black_40%,black_70%,transparent)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #2c2454 0 12px, #241d47 12px 24px), repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.03) 0 12px, transparent 12px 24px)",
          animation: "intro-floor 6s linear infinite",
        }}
      />
      {/* partículas flutuando */}
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="absolute size-1 bg-brand-300/60"
          style={{
            left: `${(i * 53) % 100}%`,
            top: `${(i * 37) % 70}%`,
            animation: `intro-float ${6 + (i % 5)}s ease-in-out ${i * 0.4}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes intro-floor { to { background-position: 48px 0, -48px 0; } }
        @keyframes intro-float { 0%,100% { transform: translateY(0); opacity: .2 } 50% { transform: translateY(-18px); opacity: .9 } }
        @keyframes intro-blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
        @keyframes intro-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(3px) } }
      `}</style>
    </>
  );
}

function Character({ avatar, label }: { avatar: AvatarConfig; label: string }) {
  return (
    <div className="flex animate-fade-up flex-col items-center">
      <div className="relative">
        <div className="absolute bottom-1 left-1/2 h-4 w-20 -translate-x-1/2 rounded-[50%] bg-black/40" />
        <AvatarSprite avatar={avatar} scale={4} anim="idle" />
      </div>
      <span className="mt-1 text-sm tracking-widest text-white/70">{label}</span>
    </div>
  );
}

// ── Caixa de diálogo ────────────────────────────────────────────────

/** Moldura de janela no estilo GBA: borda dupla, cantos arredondados, fundo claro. */
function GbaWindow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-[14px] border-[4px] border-[#2b2945] bg-[#f8f8f0] p-[3px] shadow-[0_6px_0_0_rgb(0_0_0/0.35)]",
        className,
      )}
    >
      <div className="h-full rounded-[9px] border-[3px] border-[#7fa6d8] bg-[#f8f8f0] px-5 py-3">{children}</div>
    </div>
  );
}

const TEXT_SHADOW = "2px 2px 0 #d0d0c8";

/** Texto com digitação letra a letra; ▼ pisca quando termina. */
function DialogBox({
  text,
  onDone,
  children,
}: {
  text: string;
  onDone: () => void;
  children?: (typed: boolean) => ReactNode;
}) {
  const [shown, setShown] = useState(0);
  const typed = shown >= text.length;

  useEffect(() => {
    if (typed) return;
    const t = setTimeout(() => setShown((s) => s + 1), text[shown] === "," || text[shown] === "." ? 70 : 24);
    return () => clearTimeout(t);
  }, [shown, typed, text]);

  const advance = useCallback(() => {
    if (!typed) setShown(text.length);
    else if (!children) onDone();
  }, [typed, text.length, children, onDone]);

  useKeys((e) => {
    if (["Enter", " ", "z", "Z"].includes(e.key)) {
      // com menu aberto, o Enter é do menu (exceto para completar o texto)
      if (children && typed) return false;
      advance();
      return true;
    }
    return false;
  });

  return (
    <div className="absolute inset-x-0 bottom-[4%] mx-auto w-[min(920px,94vw)]" onClick={advance}>
      {children?.(typed)}
      <GbaWindow className="h-[140px] cursor-pointer">
        <p
          className="text-[clamp(18px,2.2vw,26px)] leading-[1.45] text-[#3c3c50]"
          style={{ textShadow: TEXT_SHADOW }}
        >
          {text.slice(0, shown)}
          {typed && !children && (
            <span className="ml-2 inline-block text-[#e04848]" style={{ animation: "intro-blink 0.9s steps(1) infinite" }}>
              ▼
            </span>
          )}
        </p>
      </GbaWindow>
    </div>
  );
}

/** Menu de escolha com cursor ▶ (acima da caixa, à direita). */
function ChoiceMenu({ options, onPick }: { options: string[]; onPick: (i: number) => void }) {
  const [i, setI] = useState(0);
  useKeys((e) => {
    if (e.key === "ArrowDown") setI((v) => (v + 1) % options.length);
    else if (e.key === "ArrowUp") setI((v) => (v - 1 + options.length) % options.length);
    else if (["Enter", " ", "z", "Z"].includes(e.key)) onPick(i);
    else return false;
    return true;
  });
  return (
    <GbaWindow className="mb-3 ml-auto w-fit min-w-[220px] animate-pop-in">
      <ul>
        {options.map((o, n) => (
          <li key={o}>
            <button
              type="button"
              onMouseEnter={() => setI(n)}
              onClick={(e) => {
                e.stopPropagation();
                onPick(n);
              }}
              className="flex w-full items-center gap-2 py-0.5 text-left text-[clamp(18px,2vw,24px)] text-[#3c3c50] outline-none"
              style={{ textShadow: TEXT_SHADOW }}
            >
              <span className={cx("w-5 text-[#3c3c50]", n !== i && "invisible")}>▶</span>
              {o}
            </button>
          </li>
        ))}
      </ul>
    </GbaWindow>
  );
}

// ── Nome ────────────────────────────────────────────────────────────

function NameEntry({
  initial,
  avatar,
  onDone,
  onCancel,
}: {
  initial: string;
  avatar: AvatarConfig;
  onDone: (name: string) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [empty, setEmpty] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const openedAt = useRef(performance.now());
  useEffect(() => ref.current?.focus(), []);
  const ok = () => {
    // Enter "atropelado" vindo do diálogo anterior não confirma a tela de nome
    if (performance.now() - openedAt.current < 350) return;
    const name = v.trim().slice(0, 24);
    if (!name) {
      setEmpty(true);
      ref.current?.focus();
      return;
    }
    onDone(name);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-4">
      <GbaWindow className="w-[min(640px,94vw)] animate-pop-in">
        <p className="mb-3 text-[clamp(20px,2.4vw,28px)] text-[#3c3c50]" style={{ textShadow: TEXT_SHADOW }}>
          SEU NOME?
        </p>
        <div className="flex items-center gap-3">
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#e8ecf6]">
            <AvatarHead avatar={avatar} size={48} />
          </div>
          <input
            ref={ref}
            value={v}
            maxLength={24}
            onChange={(e) => {
              setV(e.target.value);
              setEmpty(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") ok();
              if (e.key === "Escape" && onCancel) onCancel();
              e.stopPropagation();
            }}
            spellCheck={false}
            className="h-14 min-w-0 flex-1 rounded-lg border-b-4 border-[#7fa6d8] bg-[#e8ecf6] px-4 text-[clamp(22px,2.6vw,30px)] tracking-[0.12em] text-[#3c3c50] caret-[#e04848] outline-none"
            style={{ textShadow: TEXT_SHADOW }}
            placeholder="_ _ _ _ _ _"
          />
        </div>
        {empty && <p className="mt-2 text-[clamp(15px,1.6vw,18px)] text-[#e04848]">Digite um nome para o seu crachá!</p>}
        <div className="mt-4 flex justify-end gap-6 text-[clamp(16px,1.8vw,20px)] text-[#5a5a70]">
          {onCancel && (
            <button type="button" onClick={onCancel} className="outline-none hover:text-[#3c3c50]">
              ESC: VOLTAR
            </button>
          )}
          <button type="button" onClick={ok} className="outline-none hover:text-[#3c3c50]">
            ▶ ENTER: OK
          </button>
        </div>
      </GbaWindow>
    </div>
  );
}

// ── Personalização ─────────────────────────────────────────────────

type Row =
  | { kind: "layer-style"; layer: Exclude<AvatarLayer, "body">; label: string; hint: string }
  | { kind: "layer-color"; layer: AvatarLayer; label: string; hint: string }
  | { kind: "preset"; label: string; hint: string }
  | { kind: "random"; label: string; hint: string }
  | { kind: "done"; label: string; hint: string };

const ROWS: Row[] = [
  { kind: "preset", label: "VISUAL PRONTO", hint: "Comece por um dos visuais prontos e ajuste depois." },
  { kind: "layer-color", layer: "body", label: "PELE", hint: "Escolha o tom de pele." },
  { kind: "layer-style", layer: "hair", label: "CABELO", hint: "Escolha um estilo de cabelo." },
  { kind: "layer-color", layer: "hair", label: "COR DO CABELO", hint: "Escolha a cor do cabelo." },
  { kind: "layer-style", layer: "top", label: "ROUPA", hint: "Escolha um estilo de roupa." },
  { kind: "layer-color", layer: "top", label: "COR DA ROUPA", hint: "Escolha a cor da roupa." },
  { kind: "layer-style", layer: "bottom", label: "PARTE DE BAIXO", hint: "Escolha um estilo para a parte de baixo." },
  { kind: "layer-color", layer: "bottom", label: "COR", hint: "A cor da parte de baixo." },
  { kind: "layer-style", layer: "hat", label: "ACESSÓRIO", hint: "Escolha um acessório de cabeça (ou nenhum)." },
  { kind: "layer-color", layer: "hat", label: "COR DO ACESSÓRIO", hint: "Escolha a cor do acessório." },
  { kind: "layer-style", layer: "bag", label: "BOLSA", hint: "Escolha uma bolsa (ou nenhuma)." },
  { kind: "layer-color", layer: "bag", label: "COR DA BOLSA", hint: "Escolha a cor da bolsa." },
  { kind: "random", label: "SURPREENDA-ME", hint: "Deixe que eu escolho tudo para você!" },
  { kind: "done", label: "PRONTO!", hint: "Quando estiver satisfeito, é só confirmar." },
];

const TURN: Direction[] = ["down", "left", "up", "right"];

function Customizer({
  value,
  onChange,
  onDone,
}: {
  value: AvatarConfig;
  onChange: (a: AvatarConfig) => void;
  onDone: () => void;
}) {
  const [row, setRow] = useState(0);
  const [preset, setPreset] = useState(0);
  const [turn, setTurn] = useState(0);

  // o boneco gira sozinho para você ver todos os lados
  useEffect(() => {
    const t = setInterval(() => setTurn((d) => (d + 1) % 4), 1400);
    return () => clearInterval(t);
  }, []);

  const valueLabel = (r: Row): string => {
    switch (r.kind) {
      case "preset":
        return AVATAR_PRESETS[preset].label.toUpperCase();
      case "layer-style": {
        const { style } = splitId(r.layer, value[r.layer]);
        return (AVATAR_OPTIONS[r.layer].styles.find((s) => s.id === style)?.label ?? "").toUpperCase();
      }
      case "layer-color": {
        const { color } = splitId(r.layer, value[r.layer]);
        return (AVATAR_OPTIONS[r.layer].colors.find((c) => c.id === color)?.label ?? "—").toUpperCase();
      }
      default:
        return "";
    }
  };

  const cycle = (r: Row, d: number) => {
    const wrap = (i: number, len: number) => (i + d + len) % len;
    if (r.kind === "preset") {
      const i = wrap(preset, AVATAR_PRESETS.length);
      setPreset(i);
      onChange(AVATAR_PRESETS[i].avatar);
    } else if (r.kind === "layer-style") {
      const { styles, colors } = AVATAR_OPTIONS[r.layer];
      const cur = splitId(r.layer, value[r.layer]);
      const i = wrap(Math.max(0, styles.findIndex((s) => s.id === cur.style)), styles.length);
      onChange({ ...value, [r.layer]: joinId(r.layer, styles[i].id, cur.color || colors[0].id) });
    } else if (r.kind === "layer-color") {
      const { styles, colors } = AVATAR_OPTIONS[r.layer];
      const cur = splitId(r.layer, value[r.layer]);
      const i = wrap(Math.max(0, colors.findIndex((c) => c.id === cur.color)), colors.length);
      const style = r.layer === "body" ? "" : cur.style === "none" ? styles[1].id : cur.style;
      onChange({ ...value, [r.layer]: joinId(r.layer, style, colors[i].id) });
    }
  };

  const activate = (r: Row) => {
    if (r.kind === "random") onChange(randomAvatar());
    else if (r.kind === "done") onDone();
    else cycle(r, 1);
  };

  useKeys((e) => {
    const r = ROWS[row];
    if (e.key === "ArrowDown") setRow((v) => (v + 1) % ROWS.length);
    else if (e.key === "ArrowUp") setRow((v) => (v - 1 + ROWS.length) % ROWS.length);
    else if (e.key === "ArrowRight") cycle(r, 1);
    else if (e.key === "ArrowLeft") cycle(r, -1);
    else if (["Enter", " ", "z", "Z"].includes(e.key)) activate(r);
    else return false;
    return true;
  });

  const swatch = (r: Row) => {
    if (r.kind !== "layer-color") return null;
    const { color } = splitId(r.layer, value[r.layer]);
    const c = AVATAR_OPTIONS[r.layer].colors.find((x) => x.id === color);
    return c ? <span className="size-4 rounded-sm border-2 border-[#3c3c50]" style={{ background: c.base }} /> : null;
  };
  const slot = (r: Row) => <span className="grid w-4 place-items-center">{swatch(r)}</span>;

  return (
    <>
      <div className="absolute inset-x-0 top-[6%] bottom-[30%] mx-auto flex w-[min(1000px,96vw)] items-center gap-6">
        <div className="flex flex-1 flex-col items-center">
          <div className="relative" style={{ animation: "intro-bob 1.6s ease-in-out infinite" }}>
            <div className="absolute bottom-1 left-1/2 h-5 w-28 -translate-x-1/2 rounded-[50%] bg-black/40" />
            <AvatarSprite avatar={value} scale={6} dir={TURN[turn]} anim="walk" />
          </div>
        </div>
        <GbaWindow className="w-[min(470px,56vw)] animate-pop-in">
          <ul className="flex flex-col">
            {ROWS.map((r, i) => (
              <li key={r.label}>
                <div
                  onMouseEnter={() => setRow(i)}
                  className="flex items-center gap-2 py-[2px] text-[clamp(15px,1.6vw,20px)] text-[#3c3c50]"
                  style={{ textShadow: TEXT_SHADOW }}
                >
                  <span className={cx("w-4", i !== row && "invisible")}>▶</span>
                  <button type="button" onClick={() => activate(r)} className="mr-auto text-left outline-none">
                    {r.label}
                  </button>
                  {(r.kind === "preset" || r.kind === "layer-style" || r.kind === "layer-color") && (
                    <span className="flex items-center gap-1.5">
                      <button type="button" onClick={() => cycle(r, -1)} className="px-1 text-[#7fa6d8] outline-none hover:text-[#3c3c50]">
                        ◀
                      </button>
                      {slot(r)}
                      <span className="min-w-[8.5rem] text-center">{valueLabel(r)}</span>
                      <button type="button" onClick={() => cycle(r, 1)} className="px-1 text-[#7fa6d8] outline-none hover:text-[#3c3c50]">
                        ▶
                      </button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </GbaWindow>
      </div>
      <div className="absolute inset-x-0 bottom-[4%] mx-auto w-[min(920px,94vw)]">
        <GbaWindow className="h-[110px]">
          <p className="text-[clamp(17px,2vw,24px)] leading-snug text-[#3c3c50]" style={{ textShadow: TEXT_SHADOW }}>
            {ROWS[row].hint}
          </p>
          <p className="mt-1 text-[clamp(13px,1.3vw,16px)] text-[#7a7a90]">↑↓ ESCOLHER · ←→ MUDAR · ENTER CONFIRMAR</p>
        </GbaWindow>
      </div>
    </>
  );
}

// ── Câmera e microfone ──────────────────────────────────────────────

function DeviceCheck({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState(false);
  const micOn = useMediaStore((s) => s.micOn);
  const camOn = useMediaStore((s) => s.camOn);
  const level = useMicLevel(micOn ? stream : null);
  const [i, setI] = useState(2);

  useEffect(() => {
    let s: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices) setError(true);
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((got) => {
        if (cancelled) return got.getTracks().forEach((t) => t.stop());
        s = got;
        setStream(got);
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, camOn]);

  const items = [
    { label: micOn ? "MICROFONE: LIGADO" : "MICROFONE: MUDO", act: () => useMediaStore.setState({ micOn: !micOn }) },
    { label: camOn ? "CÂMERA: LIGADA" : "CÂMERA: DESLIGADA", act: () => useMediaStore.setState({ camOn: !camOn }) },
    { label: "TUDO CERTO!", act: onDone },
  ];

  useKeys((e) => {
    if (e.key === "ArrowDown") setI((v) => (v + 1) % items.length);
    else if (e.key === "ArrowUp") setI((v) => (v - 1 + items.length) % items.length);
    else if (["Enter", " ", "z", "Z"].includes(e.key)) items[i].act();
    else return false;
    return true;
  });

  return (
    <>
      <div className="absolute inset-x-0 top-[8%] bottom-[30%] mx-auto flex w-[min(900px,96vw)] items-center justify-center gap-6">
        <GbaWindow className="animate-pop-in">
          <div className="relative h-[min(30vh,240px)] w-[min(42vw,420px)] overflow-hidden rounded-md bg-[#2b2945]">
            {error || !camOn ? (
              <div className="flex h-full items-center justify-center text-lg text-[#c8c8d8]">
                {error ? "SEM ACESSO À CÂMERA" : "CÂMERA DESLIGADA"}
              </div>
            ) : (
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-base text-[#3c3c50]">
            MIC
            <div className="flex flex-1 gap-[3px]">
              {Array.from({ length: 16 }, (_, k) => (
                <span
                  key={k}
                  className={cx("h-3 flex-1 rounded-[2px]", level * 1.4 > k / 16 ? (k > 12 ? "bg-[#e04848]" : "bg-[#48c060]") : "bg-[#d8dce8]")}
                />
              ))}
            </div>
          </div>
        </GbaWindow>
        <GbaWindow className="animate-pop-in">
          <ul>
            {items.map((it, n) => (
              <li key={n}>
                <button
                  type="button"
                  onMouseEnter={() => setI(n)}
                  onClick={it.act}
                  className="flex items-center gap-2 py-1 text-[clamp(16px,1.7vw,21px)] text-[#3c3c50] outline-none"
                  style={{ textShadow: TEXT_SHADOW }}
                >
                  <span className={cx("w-4", n !== i && "invisible")}>▶</span>
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </GbaWindow>
      </div>
      <div className="absolute inset-x-0 bottom-[4%] mx-auto w-[min(920px,94vw)]">
        <GbaWindow className="h-[110px]">
          <p className="text-[clamp(17px,2vw,24px)] leading-snug text-[#3c3c50]" style={{ textShadow: TEXT_SHADOW }}>
            Fale alguma coisa: a barrinha verde tem que se mexer. Se preferir, entre com o microfone ou a câmera
            desligados.
          </p>
        </GbaWindow>
      </div>
    </>
  );
}

// ── Teclado ─────────────────────────────────────────────────────────

/** Listener de teclado do passo atual; o handler devolve true se tratou a tecla. */
function useKeys(handler: (e: KeyboardEvent) => boolean) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.repeat && !e.key.startsWith("Arrow")) return;
      if (ref.current(e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
