package game

import (
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"pixelrooms/backend/internal/protocol"
)

const (
	// MaxChatRunes é o tamanho máximo de uma mensagem de chat.
	MaxChatRunes = 500
	// chatCooldown limita o flood por jogador (RNF-14).
	chatCooldown = 400 * time.Millisecond
	// emoteCooldown evita spam de reações.
	emoteCooldown = 250 * time.Millisecond
)

// Emotes aceitos (RF-AVATAR-05). Os ids são estáveis; o cliente mapeia para
// o emoji/sprite exibido. "clear" remove o emote atual (ex.: o ❓ persistente).
var Emotes = []string{"wave", "heart", "party", "thumbsup", "question", "laugh", "clear"}

// handleChat valida, sanitiza e entrega a mensagem ao escopo pedido:
//   - map: todos na sala (inclusive o autor, que exibe a mensagem só
//     quando o servidor confirma — fonte única de verdade).
//   - nearby: o autor + quem está no mesmo grupo de mídia (mesma área
//     privada ou dentro do raio de proximidade). Reutiliza p.hears para
//     que "quem me ouve falar" e "quem lê meu chat próximo" coincidam.
func (r *Room) handleChat(in chatIntent) {
	p, ok := r.players[in.playerID]
	if !ok {
		return
	}
	text := sanitizeChat(in.text)
	if text == "" {
		return
	}
	now := time.Now()
	if now.Sub(p.lastChat) < chatCooldown {
		return
	}
	p.lastChat = now

	scope := in.scope
	if scope != protocol.ChatNearby && scope != protocol.ChatMap {
		scope = protocol.ChatMap
	}
	msg := protocol.Marshal(protocol.ServerMessage{
		Type:     protocol.SChat,
		PlayerID: p.ID,
		Name:     p.Name,
		Scope:    scope,
		Text:     text,
		At:       now.UnixMilli(),
	})

	if scope == protocol.ChatMap {
		r.broadcastExcept("", msg)
		return
	}
	p.sess.Send(msg)
	for id := range p.hears {
		if q, ok := r.players[id]; ok {
			q.sess.Send(msg)
		}
	}
}

// handleEmote valida o emote e o transmite a toda a sala (o autor
// inclusive, para o próprio cliente só mostrar o que o servidor aceitou).
func (r *Room) handleEmote(in emoteIntent) {
	p, ok := r.players[in.playerID]
	if !ok || !contains(Emotes, in.emote) {
		return
	}
	now := time.Now()
	if now.Sub(p.lastEmote) < emoteCooldown {
		return
	}
	p.lastEmote = now
	r.broadcastExcept("", protocol.Marshal(protocol.ServerMessage{
		Type:     protocol.SEmote,
		PlayerID: p.ID,
		Emote:    in.emote,
	}))
}

// sanitizeChat remove controle/quebras excessivas e limita o tamanho. O
// escape de HTML é responsabilidade do cliente ao renderizar (React já
// escapa por padrão); aqui garantimos texto plano bem-formado (RF-CHAT-05).
func sanitizeChat(text string) string {
	if !utf8.ValidString(text) {
		return ""
	}
	var b strings.Builder
	for _, r := range text {
		switch {
		case r == '\n' || r == '\t':
			b.WriteRune(' ')
		case unicode.IsControl(r):
			// descarta
		default:
			b.WriteRune(r)
		}
	}
	out := strings.TrimSpace(b.String())
	if utf8.RuneCountInString(out) > MaxChatRunes {
		runes := []rune(out)
		out = string(runes[:MaxChatRunes])
	}
	return out
}
