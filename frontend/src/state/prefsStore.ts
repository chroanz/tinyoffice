import { create } from "zustand";

/**
 * Preferências do usuário, salvas no navegador (localStorage). Valem para
 * todos os espaços; nada aqui vai para o servidor.
 */
export const ZOOM_LEVELS = [1, 1.5, 2, 2.5, 3] as const; // múltiplos de 0,5: pixels inteiros (arte = 2 px/pixel)
export const DEFAULT_ZOOM = 2;

export type MotionPref = "system" | "reduce" | "full";
export type NamesPref = "auto" | "always" | "hover";

export interface Prefs {
  zoom: number;
  motion: MotionPref;
  names: NamesPref;
  /** Volume geral das pessoas (0..1), multiplica o fade por distância. */
  volume: number;
  micDeviceId: string;
  camDeviceId: string;
  speakerDeviceId: string;
  /** Espelhar a própria câmera (só na sua tela). */
  mirrorSelf: boolean;
  tutorialDone: boolean;
}

const KEY = "pixelrooms.prefs";

const DEFAULTS: Prefs = {
  zoom: DEFAULT_ZOOM,
  motion: "system",
  names: "auto",
  volume: 1,
  micDeviceId: "",
  camDeviceId: "",
  speakerDeviceId: "",
  mirrorSelf: true,
  tutorialDone: false,
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
      if (!ZOOM_LEVELS.includes(p.zoom as (typeof ZOOM_LEVELS)[number])) p.zoom = DEFAULT_ZOOM;
      p.volume = Math.min(1, Math.max(0, Number(p.volume) || 0));
      return p;
    }
  } catch {
    // storage indisponível ou corrompido
  }
  return { ...DEFAULTS };
}

export const usePrefs = create<Prefs>(load);

usePrefs.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignorar (modo privado etc.)
  }
});

export const prefs = {
  set: (patch: Partial<Prefs>) => usePrefs.setState(patch),
  zoomBy(step: number) {
    const z = usePrefs.getState().zoom;
    let i = ZOOM_LEVELS.findIndex((l) => l === z);
    if (i < 0) i = ZOOM_LEVELS.indexOf(DEFAULT_ZOOM);
    const next = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + step))];
    if (next !== z) usePrefs.setState({ zoom: next });
  },
  resetZoom: () => usePrefs.setState({ zoom: DEFAULT_ZOOM }),
};

const mq = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : undefined;

/** Reduzir movimento: preferência do app, ou a do sistema se "system". */
export function motionReduced() {
  const m = usePrefs.getState().motion;
  return m === "reduce" || (m === "system" && !!mq?.matches);
}
