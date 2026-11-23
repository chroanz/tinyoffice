import type {
  AvatarConfig,
  ChatScope,
  ClientMessage,
  Direction,
  EmoteId,
  JoinAck,
  ServerMessage,
} from "./messages";

const PING_INTERVAL_MS = 15_000;
const RECONNECT_MAX_MS = 10_000;

interface Events {
  joined: (ack: JoinAck) => void;
  message: (msg: ServerMessage) => void;
  status: (status: ClientStatus) => void;
}

export type ClientStatus = "idle" | "connecting" | "connected" | "reconnecting";

/**
 * Cliente do protocolo em tempo real: WebSocket + JSON, com reconexão
 * automática por backoff exponencial (RNF-07). Singleton compartilhado
 * entre o React (UI) e o Phaser (mundo).
 */
class GameClient {
  status: ClientStatus = "idle";
  lastAck: JoinAck | null = null;

  private ws: WebSocket | null = null;
  private name = "";
  private avatar: AvatarConfig | undefined;
  private wanted = false; // usuário quer estar conectado
  private reconnectDelay = 1000;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: { [K in keyof Events]: Set<Events[K]> } = {
    joined: new Set(),
    message: new Set(),
    status: new Set(),
  };

  on<K extends keyof Events>(event: K, fn: Events[K]): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  connect(name: string, avatar?: AvatarConfig) {
    this.name = name;
    this.avatar = avatar;
    this.wanted = true;
    this.open("connecting");
  }

  disconnect() {
    this.wanted = false;
    this.lastAck = null;
    this.ws?.close();
    this.setStatus("idle");
  }

  move(dir: Direction) {
    this.send({ type: "move", dir });
  }

  chat(scope: ChatScope, text: string) {
    this.send({ type: "chat", scope, text });
  }

  /** Troca nome/avatar sem sair da sala; também vale para reconexões. */
  updateProfile(name: string, avatar: AvatarConfig) {
    this.name = name;
    this.avatar = avatar;
    this.send({ type: "profile", name, avatar });
  }

  emote(emote: EmoteId) {
    this.send({ type: "emote", emote });
  }

  private open(status: ClientStatus) {
    this.setStatus(status);
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.send({ type: "join", name: this.name, avatar: this.avatar });
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === "join_ack") {
        this.lastAck = msg;
        this.setStatus("connected");
        this.startPing();
        this.emit("joined", msg);
      }
      this.emit("message", msg);
    };

    ws.onclose = () => {
      this.stopPing();
      if (!this.wanted) return;
      this.setStatus("reconnecting");
      const delay = this.reconnectDelay;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
      setTimeout(() => {
        if (this.wanted) this.open("reconnecting");
      }, delay);
    };
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => this.send({ type: "ping", t: Date.now() }), PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private setStatus(status: ClientStatus) {
    if (this.status === status) return;
    this.status = status;
    this.emit("status", status);
  }

  private emit<K extends keyof Events>(event: K, arg: Parameters<Events[K]>[0]) {
    for (const fn of this.listeners[event]) (fn as (a: typeof arg) => void)(arg);
  }
}

export const client = new GameClient();
