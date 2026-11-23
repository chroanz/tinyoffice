import {
  Check,
  GraduationCap,
  LogOut,
  Settings,
  SlidersHorizontal,
  UserRound,
  Video,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { randomAvatar } from "../game/avatarCatalog";
import { mediaManager } from "../media/manager";
import { client } from "../net/client";
import type { AvatarConfig } from "../net/messages";
import { useGameStore } from "../state/gameStore";
import { usePrefs, prefs, ZOOM_LEVELS, type MotionPref, type NamesPref } from "../state/prefsStore";
import { loadProfile, saveProfile } from "../state/profile";
import { ui, useUIStore } from "../state/uiStore";
import { AvatarStage, CharacterCreator } from "./CharacterCreator";
import { cx, IconButton, Segmented } from "./kit";
import { useMicLevel } from "./useMicLevel";

type Tab = "profile" | "media" | "prefs";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Perfil", icon: UserRound },
  { id: "media", label: "Áudio e vídeo", icon: Video },
  { id: "prefs", label: "Preferências", icon: SlidersHorizontal },
];

/** Menu de configurações do usuário: perfil, dispositivos e preferências. */
export function SettingsModal() {
  const [tab, setTab] = useState<Tab>("profile");
  const close = () => useUIStore.setState({ settingsOpen: false });

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-20 flex animate-fade-in items-center justify-center bg-ink-950/60 p-4 backdrop-blur-[2px]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Configurações"
    >
      <div
        className="glass flex h-[min(640px,100%)] w-full max-w-4xl animate-pop-in overflow-hidden rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-white/[0.06] bg-black/20 p-3">
          <div className="mb-3 flex items-center gap-2 px-2 pt-1">
            <Settings className="size-4 text-brand-300" />
            <h2 className="text-sm font-semibold text-white">Configurações</h2>
          </div>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id}
              className={cx(
                "focus-ring flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium transition",
                tab === t.id ? "bg-white/[0.1] text-white" : "text-ink-300 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
          <div className="mt-auto flex flex-col gap-1 border-t border-white/[0.06] pt-2">
            <button
              type="button"
              onClick={ui.openTutorial}
              className="focus-ring flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium text-ink-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              <GraduationCap className="size-4" /> Rever tutorial
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                client.disconnect();
              }}
              className="focus-ring flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium text-rose-300 transition hover:bg-rose-500/10"
            >
              <LogOut className="size-4" /> Sair do espaço
            </button>
          </div>
        </nav>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/[0.06] py-2.5 pr-2.5 pl-6">
            <h3 className="text-sm font-semibold text-white">{TABS.find((t) => t.id === tab)?.label}</h3>
            <IconButton icon={X} label="Fechar (Esc)" onClick={close} />
          </header>
          <div key={tab} className="thin-scroll min-h-0 flex-1 animate-fade-up overflow-y-auto p-6">
            {tab === "profile" && <ProfileTab />}
            {tab === "media" && <MediaTab />}
            {tab === "prefs" && <PrefsTab />}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Perfil ──────────────────────────────────────────────────────────

function ProfileTab() {
  const selfId = useGameStore((s) => s.selfId);
  const me = useGameStore((s) => (s.selfId ? s.players[s.selfId] : undefined));
  const [name, setName] = useState(me?.name ?? loadProfile().name);
  const [avatar, setAvatar] = useState<AvatarConfig>(me?.avatar ?? loadProfile().avatar);
  const [saved, setSaved] = useState(false);
  const dirty =
    name.trim() !== (me?.name ?? "") ||
    JSON.stringify(avatar) !== JSON.stringify(me?.avatar ?? {});

  const save = () => {
    const n = name.trim() || "Convidado";
    saveProfile({ name: n, avatar });
    client.updateProfile(n, avatar);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-4">
        <div className="h-[300px]">
          <AvatarStage avatar={avatar} onRandom={() => setAvatar(randomAvatar())} />
        </div>
        <label className="block">
          <FieldLabel>Seu nome</FieldLabel>
          <input
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => useUIStore.setState({ typing: true })}
            onBlur={() => useUIStore.setState({ typing: false })}
            onKeyDown={(e) => e.key === "Enter" && dirty && save()}
            className="h-11 w-full rounded-2xl bg-black/30 px-4 text-sm text-white ring-1 ring-white/[0.08] outline-none placeholder:text-ink-500 focus:ring-2 focus:ring-brand-400"
          />
        </label>
        <button
          type="button"
          disabled={!dirty || !selfId}
          onClick={save}
          className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-brand-400 to-brand-600 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgb(124_58_237/0.7)] transition hover:brightness-110 active:scale-[0.98] disabled:from-white/[0.08] disabled:to-white/[0.08] disabled:text-ink-400 disabled:shadow-none"
        >
          {saved ? (
            <>
              <Check className="size-4" /> Salvo — todos já veem
            </>
          ) : (
            "Salvar alterações"
          )}
        </button>
      </div>
      <div className="flex h-[440px] min-h-0 flex-col">
        <CharacterCreator value={avatar} onChange={setAvatar} />
      </div>
    </div>
  );
}

// ── Áudio e vídeo ──────────────────────────────────────────────────

function useDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.enumerateDevices) return;
    const refresh = () => void md.enumerateDevices().then(setDevices).catch(() => setDevices([]));
    refresh();
    md.addEventListener?.("devicechange", refresh);
    return () => md.removeEventListener?.("devicechange", refresh);
  }, []);
  return devices;
}

function MediaTab() {
  const devices = useDevices();
  const p = usePrefs();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState(false);
  const level = useMicLevel(stream);
  const canPickSpeaker = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

  // Prévia local com os dispositivos escolhidos.
  useEffect(() => {
    let s: MediaStream | null = null;
    let cancelled = false;
    setError(false);
    navigator.mediaDevices
      ?.getUserMedia({
        video: p.camDeviceId ? { deviceId: { exact: p.camDeviceId } } : true,
        audio: p.micDeviceId ? { deviceId: { exact: p.micDeviceId } } : true,
      })
      .then((got) => {
        if (cancelled) return got.getTracks().forEach((t) => t.stop());
        s = got;
        setStream(got);
        if (videoRef.current) videoRef.current.srcObject = got;
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, [p.camDeviceId, p.micDeviceId]);

  const options = (kind: MediaDeviceKind) =>
    devices
      .filter((d) => d.kind === kind && d.deviceId !== "default" && d.deviceId !== "communications")
      .map((d, i) => ({ id: d.deviceId, label: d.label || `${kindLabel(kind)} ${i + 1}` }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/[0.08]">
          {error ? (
            <div className="flex h-full items-center justify-center text-xs text-ink-400">
              Sem acesso à câmera ou ao microfone
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cx("h-full w-full object-cover", p.mirrorSelf && "-scale-x-100")}
            />
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wider text-ink-400 uppercase">Microfone</span>
          <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-live transition-[width] duration-75"
              style={{ width: `${Math.min(100, level * 140)}%` }}
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-500">Fale algo: a barra verde deve se mexer.</p>
      </div>

      <div className="flex flex-col gap-5">
        <Field label="Microfone">
          <DeviceSelect
            value={p.micDeviceId}
            options={options("audioinput")}
            onChange={(id) => void mediaManager.setDevice("audioinput", id)}
          />
        </Field>
        <Field label="Câmera">
          <DeviceSelect
            value={p.camDeviceId}
            options={options("videoinput")}
            onChange={(id) => void mediaManager.setDevice("videoinput", id)}
          />
        </Field>
        {canPickSpeaker && (
          <Field label="Alto-falante">
            <DeviceSelect
              value={p.speakerDeviceId}
              options={options("audiooutput")}
              onChange={(id) => void mediaManager.setDevice("audiooutput", id)}
            />
          </Field>
        )}
        <Field label="Volume das pessoas">
          <div className="flex items-center gap-3">
            <Volume2 className="size-4 text-ink-400" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(p.volume * 100)}
              onChange={(e) => prefs.set({ volume: Number(e.target.value) / 100 })}
              className="flex-1 accent-brand-400"
              aria-label="Volume das pessoas"
            />
            <span className="w-10 text-right text-xs text-ink-300 tabular-nums">{Math.round(p.volume * 100)}%</span>
          </div>
        </Field>
        <Toggle
          label="Espelhar minha câmera"
          hint="Só na sua tela; os outros sempre veem você sem espelho."
          checked={p.mirrorSelf}
          onChange={(v) => prefs.set({ mirrorSelf: v })}
        />
      </div>
    </div>
  );
}

const kindLabel = (k: MediaDeviceKind) =>
  k === "audioinput" ? "Microfone" : k === "videoinput" ? "Câmera" : "Alto-falante";

function DeviceSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="focus-ring h-11 w-full appearance-none rounded-2xl bg-black/30 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239a93b8%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat px-4 pr-10 text-sm text-white ring-1 ring-white/[0.08] transition hover:ring-white/15"
    >
      <option value="">Padrão do sistema</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Preferências ───────────────────────────────────────────────────

function PrefsTab() {
  const p = usePrefs();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Field label="Zoom do mapa" hint="Também dá para usar a roda do mouse ou as teclas + e −.">
        <Segmented
          size="md"
          value={String(p.zoom)}
          onChange={(v) => prefs.set({ zoom: Number(v) })}
          options={ZOOM_LEVELS.map((z) => ({ id: String(z), label: `${Math.round((z / 2) * 100)}%` }))}
        />
      </Field>
      <Field label="Nomes sobre os personagens">
        <Segmented<NamesPref>
          size="md"
          value={p.names}
          onChange={(v) => prefs.set({ names: v })}
          options={[
            { id: "auto", label: "Automático", title: "Esconde nomes que se sobrepõem" },
            { id: "always", label: "Sempre" },
            { id: "hover", label: "Ao passar o mouse" },
          ]}
        />
      </Field>
      <Field label="Animações" hint="Reduzido desliga pulinhos, poeira e transições — bom para quem sente enjoo.">
        <Segmented<MotionPref>
          size="md"
          value={p.motion}
          onChange={(v) => prefs.set({ motion: v })}
          options={[
            { id: "system", label: "Seguir o sistema" },
            { id: "full", label: "Completas" },
            { id: "reduce", label: "Reduzidas" },
          ]}
        />
      </Field>
    </div>
  );
}

// ── Peças ──────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-ink-400 uppercase">{children}</span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "focus-ring relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition",
          checked ? "bg-brand-500" : "bg-white/[0.12]",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-spring)]",
            checked && "translate-x-4",
          )}
        />
      </button>
      <span>
        <span className="block text-[13px] font-medium text-white">{label}</span>
        {hint && <span className="block text-[11px] text-ink-500">{hint}</span>}
      </span>
    </label>
  );
}
