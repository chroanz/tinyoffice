import {
  Room,
  RoomEvent,
  Track,
  type RemoteAudioTrack,
  type RemoteParticipant,
  type RemoteTrack,
} from "livekit-client";
import { PROXIMITY_RADIUS } from "../game/constants";
import { client } from "../net/client";
import { useGameStore } from "../state/gameStore";
import { useMediaStore } from "../state/mediaStore";
import type { MediaState } from "../net/messages";

// Volume 100% até esta distância; decai linearmente até 0 no raio+1 (RF-RTC-02).
const FULL_VOLUME_DIST = 2;

/**
 * Camada de mídia: conecta ao SFU (LiveKit) com o token emitido pelo
 * game server e assina APENAS os participantes que o servidor mandou
 * ouvir (mensagens `media`). O volume dos áudios faz fade conforme a
 * distância em tiles; quem está em spotlight é ouvido a volume cheio.
 */
class MediaManager {
  private room: Room | null = null;
  private hear = new Set<string>();
  private spotlights = new Set<string>();
  private connecting = false;

  /** Liga o manager aos eventos de rede e de posição (chamado uma vez). */
  bind() {
    client.on("message", (msg) => {
      if (msg.type === "media") void this.handleMedia(msg);
    });
    client.on("status", (status) => {
      if (status === "idle") void this.disconnect();
    });
    // Fade por distância: posições mudam → volumes mudam.
    useGameStore.subscribe((s, prev) => {
      if (s.players !== prev.players) this.updateVolumes();
    });
  }

  async setMicOn(on: boolean) {
    useMediaStore.setState({ micOn: on });
    await this.room?.localParticipant.setMicrophoneEnabled(on);
  }

  async setCamOn(on: boolean) {
    useMediaStore.setState({ camOn: on });
    await this.room?.localParticipant.setCameraEnabled(on);
  }

  /** Track de vídeo local (espelho do próprio usuário). */
  localVideoTrack(): Track | undefined {
    const pub = this.room?.localParticipant.getTrackPublication(Track.Source.Camera);
    return pub?.track;
  }

  /** Tracks assinados de um participante remoto + estado do microfone. */
  remoteTracks(id: string): { video?: RemoteTrack; audio?: RemoteTrack; micMuted: boolean } {
    const p = this.room?.remoteParticipants.get(id);
    if (!p) return { micMuted: false };
    let video: RemoteTrack | undefined;
    let audio: RemoteTrack | undefined;
    let micMuted = false;
    for (const pub of p.trackPublications.values()) {
      if (pub.kind === Track.Kind.Audio && pub.isMuted) micMuted = true;
      if (!pub.isSubscribed || !pub.track) continue;
      if (pub.kind === Track.Kind.Video) video = pub.track;
      if (pub.kind === Track.Kind.Audio) audio = pub.track;
    }
    return { video, audio, micMuted };
  }

  private async handleMedia(msg: MediaState) {
    this.hear = new Set(msg.hear ?? []);
    this.spotlights = new Set(msg.spotlights ?? []);
    useMediaStore.setState({
      hear: [...this.hear],
      areaId: msg.areaId ?? "",
      spotlights: [...this.spotlights],
      onSpotlight: !!msg.spotlight,
    });

    if (!this.room && !this.connecting && msg.url && msg.token) {
      await this.connect(msg.url, msg.token);
    }
    this.applySubscriptions();
    this.updateVolumes();
    this.bump();
  }

  private async connect(url: string, token: string) {
    this.connecting = true;
    const room = new Room({ adaptiveStream: true, dynacast: true });

    room
      .on(RoomEvent.TrackSubscribed, () => {
        this.updateVolumes();
        this.bump();
      })
      .on(RoomEvent.TrackUnsubscribed, () => this.bump())
      .on(RoomEvent.TrackMuted, () => this.bump())
      .on(RoomEvent.TrackUnmuted, () => this.bump())
      .on(RoomEvent.LocalTrackPublished, () => this.bump())
      .on(RoomEvent.TrackPublished, (_pub, participant) => this.applyFor(participant))
      .on(RoomEvent.ParticipantConnected, (p) => {
        this.applyFor(p);
        this.bump();
      })
      .on(RoomEvent.ParticipantDisconnected, () => this.bump())
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        useMediaStore.setState({ speaking: speakers.map((s) => s.identity) });
      })
      .on(RoomEvent.Disconnected, () => {
        this.room = null;
        useMediaStore.setState({ connected: false, speaking: [] });
        this.bump();
      });

    try {
      await room.connect(url, token, { autoSubscribe: false });
      this.room = room;
      const { micOn, camOn } = useMediaStore.getState();
      await room.localParticipant.setMicrophoneEnabled(micOn);
      await room.localParticipant.setCameraEnabled(camOn);
      useMediaStore.setState({ connected: true });
    } catch (err) {
      console.error("falha ao conectar ao SFU:", err);
    } finally {
      this.connecting = false;
      this.bump();
    }
  }

  private async disconnect() {
    const room = this.room;
    this.room = null;
    this.hear.clear();
    this.spotlights.clear();
    useMediaStore.setState({
      connected: false,
      hear: [],
      areaId: "",
      spotlights: [],
      onSpotlight: false,
      speaking: [],
    });
    await room?.disconnect();
    this.bump();
  }

  private applySubscriptions() {
    if (!this.room) return;
    for (const p of this.room.remoteParticipants.values()) this.applyFor(p);
  }

  private applyFor(p: RemoteParticipant) {
    const want = this.hear.has(p.identity);
    for (const pub of p.trackPublications.values()) {
      if (pub.isSubscribed !== want) pub.setSubscribed(want);
    }
  }

  /** Fade de volume por distância em tiles (Chebyshev, como o servidor). */
  private updateVolumes() {
    if (!this.room) return;
    const { players, selfId } = useGameStore.getState();
    const self = selfId ? players[selfId] : null;
    if (!self) return;

    for (const p of this.room.remoteParticipants.values()) {
      const other = players[p.identity];
      if (!other) continue;
      let volume = 1;
      if (!this.spotlights.has(p.identity)) {
        const d = Math.max(Math.abs(self.x - other.x), Math.abs(self.y - other.y));
        volume =
          d <= FULL_VOLUME_DIST
            ? 1
            : Math.max(0, 1 - (d - FULL_VOLUME_DIST) / (PROXIMITY_RADIUS - FULL_VOLUME_DIST + 1));
      }
      for (const pub of p.audioTrackPublications.values()) {
        (pub.track as RemoteAudioTrack | undefined)?.setVolume(volume);
      }
    }
  }

  // Re-render da UI de vídeo (os tracks vivem fora do estado React).
  private bump() {
    useMediaStore.setState((s) => ({ version: s.version + 1 }));
  }
}

export const mediaManager = new MediaManager();
