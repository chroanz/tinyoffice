package game

import (
	"encoding/json"
	"testing"
	"time"

	"pixelrooms/backend/internal/maps"
	"pixelrooms/backend/internal/protocol"
)

// Mapa 4×3 com a linha y=0 bloqueada e spawn único em (1,1).
const fixture = `{
  "width": 4, "height": 3, "tilewidth": 32, "tileheight": 32,
  "layers": [
    { "name": "Effects", "type": "objectgroup", "objects": [
      { "x": 0, "y": 0, "width": 128, "height": 32,
        "properties": [{ "name": "effect", "value": "impassable" }] },
      { "x": 32, "y": 32, "width": 32, "height": 32,
        "properties": [{ "name": "effect", "value": "spawn" }] }
    ]}
  ]
}`

type fakeSession struct {
	msgs chan []byte
}

func newFakeSession() *fakeSession {
	return &fakeSession{msgs: make(chan []byte, 64)}
}

func (s *fakeSession) Send(msg []byte) bool {
	select {
	case s.msgs <- msg:
		return true
	default:
		return false
	}
}

func (s *fakeSession) Close() {}

// wait espera até receber uma mensagem do tipo dado (descartando outras).
func (s *fakeSession) wait(t *testing.T, msgType string) protocol.ServerMessage {
	t.Helper()
	deadline := time.After(2 * time.Second)
	for {
		select {
		case raw := <-s.msgs:
			var m protocol.ServerMessage
			if err := json.Unmarshal(raw, &m); err != nil {
				t.Fatalf("mensagem inválida: %v", err)
			}
			if m.Type == msgType {
				return m
			}
		case <-deadline:
			t.Fatalf("timeout esperando mensagem %q", msgType)
		}
	}
}

func newTestRoom(t *testing.T) *Room {
	t.Helper()
	world, err := maps.Compile([]byte(fixture))
	if err != nil {
		t.Fatalf("Compile: %v", err)
	}
	r := NewRoom("test", world)
	t.Cleanup(r.Stop)
	return r
}

func TestJoinSendsAckAndNotifiesOthers(t *testing.T) {
	room := newTestRoom(t)
	s1, s2 := newFakeSession(), newFakeSession()

	p1 := room.Join(s1, "alice")
	ack1 := s1.wait(t, protocol.SJoinAck)
	if ack1.PlayerID != p1.ID || len(ack1.Players) != 1 {
		t.Fatalf("join_ack errado: %+v", ack1)
	}
	if p1.X != 1 || p1.Y != 1 {
		t.Fatalf("spawn errado: %d,%d", p1.X, p1.Y)
	}

	p2 := room.Join(s2, "bob")
	ack2 := s2.wait(t, protocol.SJoinAck)
	if len(ack2.Players) != 2 {
		t.Fatalf("join_ack de p2 deveria listar 2 jogadores: %+v", ack2)
	}
	joined := s1.wait(t, protocol.SPlayerJoined)
	if joined.Player == nil || joined.Player.ID != p2.ID {
		t.Fatalf("player_joined errado: %+v", joined)
	}
}

func TestMovementIsValidatedAndBroadcast(t *testing.T) {
	room := newTestRoom(t)
	s1, s2 := newFakeSession(), newFakeSession()
	p1 := room.Join(s1, "alice")
	room.Join(s2, "bob")
	s1.wait(t, protocol.SJoinAck)
	s2.wait(t, protocol.SJoinAck)

	// Passo válido: (1,1) → direita → (2,1).
	room.Move(p1.ID, protocol.DirRight)
	mv := s2.wait(t, protocol.SMovement)
	if len(mv.Moves) != 1 || mv.Moves[0].X != 2 || mv.Moves[0].Y != 1 || !mv.Moves[0].Moving {
		t.Fatalf("delta errado: %+v", mv.Moves)
	}

	// Passo bloqueado: (2,1) → cima → (2,0) é parede. Só vira.
	time.Sleep(StepInterval)
	room.Move(p1.ID, protocol.DirUp)
	mv = s2.wait(t, protocol.SMovement)
	m := mv.Moves[0]
	if m.X != 2 || m.Y != 1 || m.Dir != protocol.DirUp || m.Moving {
		t.Fatalf("passo bloqueado deveria só virar: %+v", m)
	}
}

func TestMovementCooldownRejectsFastSteps(t *testing.T) {
	room := newTestRoom(t)
	s1 := newFakeSession()
	p1 := room.Join(s1, "alice")
	s1.wait(t, protocol.SJoinAck)

	room.Move(p1.ID, protocol.DirRight) // ok: (2,1)
	room.Move(p1.ID, protocol.DirRight) // cedo demais: rejeitado, reafirma (2,1)
	mv := s1.wait(t, protocol.SMovement)
	m := mv.Moves[0]
	if m.X != 2 || m.Y != 1 {
		t.Fatalf("cooldown não segurou o segundo passo: %+v", m)
	}
}
