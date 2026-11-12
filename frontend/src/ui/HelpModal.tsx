import { useUIStore } from "../state/uiStore";

const SHORTCUTS: [string, string][] = [
  ["WASD / setas", "andar"],
  ["clique no chão", "andar até o ponto (caminho automático)"],
  ["X", "interagir com o objeto realçado"],
  ["1 – 6", "emotes 👋 ❤️ 🎉 👍 ❓ 😂"],
  ["0", "limpar emote"],
  ["Enter", "abrir o chat e digitar"],
  ["C", "mostrar/esconder o chat"],
  ["P", "mostrar/esconder participantes"],
  ["M", "ligar/desligar o microfone"],
  ["V", "ligar/desligar a câmera"],
  ["Esc", "fechar painel ou modal"],
  ["?", "esta ajuda"],
];

/** Modal de atalhos de teclado (RF-PLAT-03). */
export function HelpModal() {
  const close = () => useUIStore.setState({ helpOpen: false });
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/60"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Atalhos de teclado"
    >
      <div
        className="w-full max-w-md rounded-xl bg-slate-900 p-5 text-white shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-mono text-lg font-bold">Atalhos</h2>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map(([k, v]) => (
              <tr key={k} className="border-t border-white/5">
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
                </td>
                <td className="py-1.5 text-slate-300">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-slate-400">
          Vídeo e áudio ligam sozinhos ao se aproximar de alguém (5 tiles). Dentro de uma área
          privada (tapete roxo) só quem está lá dentro se ouve; no palco (tapete vermelho) você é
          ouvido por todo o mapa.
        </p>
      </div>
    </div>
  );
}
