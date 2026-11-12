package game

import (
	"log/slog"
	"slices"

	"pixelrooms/backend/internal/protocol"
)

const (
	// ProximityRadius é a distância (em tiles, Chebyshev) em que a conversa
	// por proximidade conecta (RF-RTC-01). O desligamento usa +1 tile de
	// histerese para evitar flicker na borda (RF-RTC-03).
	ProximityRadius  = 5
	disconnectRadius = ProximityRadius + 1
)

// MediaTokenMinter emite credenciais de acesso ao SFU para um jogador.
// Implementado por internal/media (LiveKit); nil desliga a mídia (testes).
type MediaTokenMinter interface {
	MediaToken(room, identity, name string) (url, token string, err error)
}

// recomputeMedia recalcula quem cada jogador deve ouvir/ver e envia
// `media` apenas a quem teve o conjunto alterado. Chamado a cada passo
// confirmado, join, leave e teleporte — não a cada tick (as posições
// intermediárias são só interpolação visual).
//
// Regras (ESPECIFICACAO.md §3.5):
//   - Spotlight: quem está num tile spotlight é ouvido por todos no mapa,
//     esteja o ouvinte onde estiver (RF-RTC-05).
//   - Dentro de área privada: ouve todos da mesma areaId e ninguém de fora.
//   - Fora: ouve quem está a ≤ ProximityRadius tiles (também fora de áreas),
//     mantendo conexões existentes até disconnectRadius (histerese).
func (r *Room) recomputeMedia() {
	spot := r.spotlights()
	for _, p := range r.players {
		desired := r.desiredHearing(p)
		// Entrar/sair de um spotlight muda o "spotlights" da mensagem mesmo
		// sem mudar o conjunto ouvido (ex.: alguém já próximo pisa no palco),
		// então o cliente precisa ser avisado também nesse caso.
		if !sameSet(desired, p.hears) || !slices.Equal(spot, p.lastSpotlights) {
			p.hears = desired
			r.sendMedia(p)
		}
	}
}

func (r *Room) desiredHearing(p *Player) map[string]bool {
	desired := make(map[string]bool)
	pArea := r.world.AreaAt(p.X, p.Y)
	for id, q := range r.players {
		if q == p {
			continue
		}
		if r.world.SpotlightAt(q.X, q.Y) {
			desired[id] = true
			continue
		}
		qArea := r.world.AreaAt(q.X, q.Y)
		if pArea != "" || qArea != "" {
			if pArea != "" && pArea == qArea {
				desired[id] = true
			}
			continue
		}
		d := chebyshev(p.X, p.Y, q.X, q.Y)
		if d <= ProximityRadius || (p.hears[id] && d <= disconnectRadius) {
			desired[id] = true
		}
	}
	return desired
}

// spotlights lista (ordenada) quem está em tile spotlight.
func (r *Room) spotlights() []string {
	var ids []string
	for id, q := range r.players {
		if r.world.SpotlightAt(q.X, q.Y) {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	return ids
}

// sendMedia envia o estado de mídia atual do jogador (credenciais do SFU +
// quem ele deve ouvir). O token é emitido uma vez por jogador e reenviado
// em toda mensagem — o cliente conecta uma única vez e ignora repetições.
func (r *Room) sendMedia(p *Player) {
	hear := make([]string, 0, len(p.hears))
	for id := range p.hears {
		hear = append(hear, id)
	}
	slices.Sort(hear) // determinístico (facilita testes e diffs no cliente)
	p.lastSpotlights = r.spotlights()

	p.sess.Send(protocol.Marshal(protocol.ServerMessage{
		Type:       protocol.SMedia,
		URL:        p.mediaURL,
		Token:      p.mediaToken,
		Hear:       hear,
		AreaID:     r.world.AreaAt(p.X, p.Y),
		Spotlights: p.lastSpotlights,
		Spotlight:  r.world.SpotlightAt(p.X, p.Y),
	}))
}

// mintMediaToken preenche as credenciais do SFU do jogador (no join).
func (r *Room) mintMediaToken(p *Player) {
	if r.minter == nil {
		return
	}
	url, token, err := r.minter.MediaToken("map-"+r.ID, p.ID, p.Name)
	if err != nil {
		slog.Error("falha ao emitir token de mídia", "room", r.ID, "player", p.ID, "err", err)
		return
	}
	p.mediaURL, p.mediaToken = url, token
}

func chebyshev(x1, y1, x2, y2 int) int {
	dx := abs(x1 - x2)
	dy := abs(y1 - y2)
	return max(dx, dy)
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

func sameSet(a, b map[string]bool) bool {
	if len(a) != len(b) {
		return false
	}
	for k := range a {
		if !b[k] {
			return false
		}
	}
	return true
}
