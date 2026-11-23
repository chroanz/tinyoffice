package ws

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/coder/websocket"

	"pixelrooms/backend/internal/game"
	"pixelrooms/backend/internal/protocol"
)

const (
	maxMessageSize = 4 << 10
	// readTimeout derruba conexões sem tráfego; o cliente envia ping a cada 15 s.
	readTimeout = 60 * time.Second
	joinTimeout = 10 * time.Second
)

// Handler devolve o endpoint /ws: faz o upgrade, exige uma mensagem `join`
// e então repassa intenções à sala até a conexão cair.
func Handler(mgr *game.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			// Em dev o Vite (5173) faz proxy para o backend, então a origem
			// já é a mesma; estes padrões cobrem acesso direto em dev.
			OriginPatterns: []string{"localhost:*", "127.0.0.1:*"},
		})
		if err != nil {
			return
		}
		conn.SetReadLimit(maxMessageSize)

		c := newClient(conn)
		defer c.Close()

		join, ok := readMessage(r.Context(), conn, joinTimeout)
		if !ok || join.Type != protocol.CJoin {
			sendError(c, "join_expected", "a primeira mensagem deve ser join")
			return
		}
		name := sanitizeName(join.Name)

		room, err := mgr.Room(join.Map)
		if err != nil {
			sendError(c, "map_not_found", err.Error())
			return
		}

		player := room.Join(c, name, join.Avatar)
		if player == nil {
			return
		}
		defer room.Leave(player.ID)

		for {
			msg, ok := readMessage(r.Context(), conn, readTimeout)
			if !ok {
				return
			}
			switch msg.Type {
			case protocol.CMove:
				room.Move(player.ID, msg.Dir)
			case protocol.CChat:
				room.Chat(player.ID, msg.Scope, msg.Text)
			case protocol.CEmote:
				room.Emote(player.ID, msg.Emote)
			case protocol.CProfile:
				name := ""
				if strings.TrimSpace(msg.Name) != "" {
					name = sanitizeName(msg.Name)
				}
				room.UpdateProfile(player.ID, name, msg.Avatar)
			case protocol.CPing:
				c.Send(protocol.Marshal(protocol.ServerMessage{
					Type:       protocol.SPong,
					T:          msg.T,
					ServerTime: time.Now().UnixMilli(),
				}))
			default:
				slog.Debug("mensagem desconhecida", "type", msg.Type, "player", player.ID)
			}
		}
	}
}

func readMessage(ctx context.Context, conn *websocket.Conn, timeout time.Duration) (protocol.ClientMessage, bool) {
	var msg protocol.ClientMessage
	rctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	_, data, err := conn.Read(rctx)
	if err != nil {
		return msg, false
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return msg, false
	}
	return msg, true
}

func sendError(c *client, code, message string) {
	c.Send(protocol.Marshal(protocol.ServerMessage{
		Type: protocol.SError, Code: code, Message: message,
	}))
	// Dá tempo do write pump drenar antes de fechar.
	time.Sleep(100 * time.Millisecond)
}

func sanitizeName(name string) string {
	name = strings.TrimSpace(name)
	runes := []rune(name)
	if len(runes) > 24 {
		name = string(runes[:24])
	}
	if name == "" {
		name = "Convidado"
	}
	return name
}
