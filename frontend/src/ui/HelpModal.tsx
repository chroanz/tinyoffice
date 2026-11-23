import { Keyboard, Lock, Megaphone, Radio, X } from "lucide-react";
import type { ReactNode } from "react";
import { EMOTES } from "../game/constants";
import { useUIStore } from "../state/uiStore";
import { IconButton, Kbd, PixelEmote } from "./kit";

const GROUPS: { title: string; items: [ReactNode, string][] }[] = [
  {
    title: "Movimento",
    items: [
      [
        <>
          <Kbd>W</Kbd>
          <Kbd>A</Kbd>
          <Kbd>S</Kbd>
          <Kbd>D</Kbd>
        </>,
        "andar",
      ],
      [<Kbd>clique</Kbd>, "andar até o ponto"],
      [<Kbd>X</Kbd>, "interagir com objeto"],
      [
        <>
          <Kbd>+</Kbd>
          <Kbd>−</Kbd>
        </>,
        "zoom (ou roda do mouse)",
      ],
    ],
  },
  {
    title: "Comunicação",
    items: [
      [<Kbd>M</Kbd>, "microfone"],
      [<Kbd>V</Kbd>, "câmera"],
      [<Kbd>T</Kbd>, "compartilhar tela"],
      [<Kbd>Enter</Kbd>, "escrever no chat"],
      [<Kbd>E</Kbd>, "abrir emotes"],
      [
        <>
          <Kbd>1</Kbd>–<Kbd>6</Kbd>
        </>,
        "enviar emote",
      ],
      [<Kbd>0</Kbd>, "limpar emote"],
    ],
  },
  {
    title: "Interface",
    items: [
      [<Kbd>C</Kbd>, "mostrar/esconder chat"],
      [<Kbd>P</Kbd>, "lista de pessoas"],
      [<Kbd>,</Kbd>, "configurações"],
      [<Kbd>?</Kbd>, "esta ajuda"],
      [<Kbd>Esc</Kbd>, "fechar painel"],
    ],
  },
];

/** Modal de atalhos e de como a conversa por proximidade funciona (RF-PLAT-03). */
export function HelpModal() {
  const close = () => useUIStore.setState({ helpOpen: false });
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 flex animate-fade-in items-center justify-center bg-ink-950/60 p-4 backdrop-blur-[2px]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Atalhos de teclado"
    >
      <div
        className="glass thin-scroll max-h-full w-full max-w-2xl animate-pop-in overflow-y-auto rounded-[24px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-5 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
            <Keyboard className="size-[18px]" />
          </span>
          <div className="mr-auto">
            <h2 className="text-base font-semibold text-white">Atalhos e dicas</h2>
            <p className="text-xs text-ink-400">Tudo que dá para fazer sem tirar a mão do teclado.</p>
          </div>
          <IconButton icon={X} label="Fechar (Esc)" onClick={close} />
        </header>

        <div className="grid gap-5 sm:grid-cols-3">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">{g.title}</h3>
              <ul className="space-y-1.5">
                {g.items.map(([keys, label], i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-[13px] text-ink-200">
                    <span>{label}</span>
                    <span className="flex shrink-0 items-center gap-0.5 text-ink-500">{keys}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-black/25 p-3 ring-1 ring-white/[0.05] sm:grid-cols-3">
          {EMOTES.map((e, i) => (
            <span key={e.id} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] py-1 pr-2.5 pl-1.5 text-xs text-ink-200">
              <PixelEmote id={e.id} size={24} />
              {e.label}
              <Kbd className="ml-auto">{i + 1}</Kbd>
            </span>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Tip icon={Radio} color="text-live bg-live/10" title="Proximidade">
            Vídeo e áudio ligam sozinhos ao chegar a até 5 passos de alguém.
          </Tip>
          <Tip icon={Lock} color="text-violet-300 bg-violet-400/10" title="Área privada">
            No tapete roxo, só quem está dentro se ouve.
          </Tip>
          <Tip icon={Megaphone} color="text-amber-300 bg-amber-400/10" title="Palco">
            No tapete vermelho, o mapa inteiro te ouve.
          </Tip>
        </div>
      </div>
    </div>
  );
}

function Tip({
  icon: Icon,
  color,
  title,
  children,
}: {
  icon: typeof Lock;
  color: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.05]">
      <span className={`mb-2 grid size-8 place-items-center rounded-xl ${color}`}>
        <Icon className="size-4" />
      </span>
      <p className="text-[13px] font-semibold text-white">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{children}</p>
    </div>
  );
}
