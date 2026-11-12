package game

import (
	"strings"
	"testing"
	"time"

	"pixelrooms/backend/internal/protocol"
)

// Fixture de mídia (12×8): spawn em (1,1). c é colocado longe de a/b.
func socialRoom(t *testing.T) (*Room, *fakeSession, *fakeSession, *Player, *Player) {
	t.Helper()
	room := NewRoom("s", mediaWorld(t), nil)
	t.Cleanup(room.Stop)
	s1, s2 := newFakeSession(), newFakeSession()
	p1 := room.Join(s1, "alice", nil)
	p2 := room.Join(s2, "bob", nil)
	s1.wait(t, protocol.SJoinAck)
	s2.wait(t, protocol.SJoinAck)
	return room, s1, s2, p1, p2
}

func TestChatMapReachesEveryoneIncludingAuthor(t *testing.T) {
	room, s1, s2, p1, _ := socialRoom(t)
	room.Chat(p1.ID, protocol.ChatMap, "  olá <b>mundo</b>\n")

	for _, s := range []*fakeSession{s1, s2} {
		m := s.wait(t, protocol.SChat)
		if m.PlayerID != p1.ID || m.Name != "alice" || m.Scope != protocol.ChatMap {
			t.Fatalf("chat errado: %+v", m)
		}
		if m.Text != "olá <b>mundo</b>" {
			t.Fatalf("texto deveria ser trimado e sem quebras: %q", m.Text)
		}
		if m.At == 0 {
			t.Fatal("chat sem timestamp")
		}
	}
}

func TestChatNearbyOnlyReachesMediaGroup(t *testing.T) {
	room, s1, s2, p1, p2 := socialRoom(t)
	s3 := newFakeSession()
	p3 := room.Join(s3, "carol", nil)
	s3.wait(t, protocol.SJoinAck)

	// carol se teleporta para longe via portal (5,1) → (10,1).
	for i := 0; i < 4; i++ {
		room.Move(p3.ID, protocol.DirRight)
		time.Sleep(StepInterval + 20*time.Millisecond)
	}
	s3.wait(t, protocol.STeleport)
	// espera o diff de mídia em que carol não ouve mais ninguém
	for {
		m := s3.wait(t, protocol.SMedia)
		if len(m.Hear) == 0 {
			break
		}
	}

	room.Chat(p1.ID, protocol.ChatNearby, "psiu")
	if m := s1.wait(t, protocol.SChat); m.Text != "psiu" || m.Scope != protocol.ChatNearby {
		t.Fatalf("autor deveria receber o próprio nearby: %+v", m)
	}
	if m := s2.wait(t, protocol.SChat); m.PlayerID != p1.ID {
		t.Fatalf("bob (perto) deveria receber: %+v", m)
	}
	_ = p2
	// carol não deve receber nada de chat.
	select {
	case raw := <-s3.msgs:
		if strings.Contains(string(raw), `"type":"chat"`) {
			t.Fatalf("carol (longe) recebeu chat nearby: %s", raw)
		}
	case <-time.After(150 * time.Millisecond):
	}
}

func TestChatRejectsEmptyAndFlood(t *testing.T) {
	room, s1, _, p1, _ := socialRoom(t)
	room.Chat(p1.ID, protocol.ChatMap, "   \t ")
	room.Chat(p1.ID, protocol.ChatMap, "1")
	room.Chat(p1.ID, protocol.ChatMap, "2") // dentro do cooldown → descartada

	m := s1.wait(t, protocol.SChat)
	if m.Text != "1" {
		t.Fatalf("primeira mensagem válida deveria ser '1': %+v", m)
	}
	select {
	case raw := <-s1.msgs:
		if strings.Contains(string(raw), `"type":"chat"`) {
			t.Fatalf("flood não foi barrado: %s", raw)
		}
	case <-time.After(150 * time.Millisecond):
	}
}

func TestSanitizeChatTruncates(t *testing.T) {
	long := strings.Repeat("é", MaxChatRunes+10)
	if got := len([]rune(sanitizeChat(long))); got != MaxChatRunes {
		t.Fatalf("esperava %d runas, veio %d", MaxChatRunes, got)
	}
	if sanitizeChat("a\x00b\x07c") != "abc" {
		t.Fatal("caracteres de controle deveriam ser removidos")
	}
}

func TestEmoteBroadcastAndValidation(t *testing.T) {
	room, s1, s2, p1, _ := socialRoom(t)
	room.Emote(p1.ID, "nope") // inválido: ignorado
	room.Emote(p1.ID, "wave") // ok
	for _, s := range []*fakeSession{s1, s2} {
		m := s.wait(t, protocol.SEmote)
		if m.PlayerID != p1.ID || m.Emote != "wave" {
			t.Fatalf("emote errado: %+v", m)
		}
	}
}

func TestJoinNormalizesAvatar(t *testing.T) {
	room := NewRoom("a", mediaWorld(t), nil)
	t.Cleanup(room.Stop)
	s := newFakeSession()
	p := room.Join(s, "x", &protocol.Avatar{Body: "dark", Hair: "nope", Top: "red"})
	want := protocol.Avatar{Body: "dark", Hair: DefaultAvatar.Hair, Top: "red"}
	if p.Avatar != want {
		t.Fatalf("avatar normalizado errado: %+v", p.Avatar)
	}
	ack := s.wait(t, protocol.SJoinAck)
	if ack.Players[0].Avatar != want {
		t.Fatalf("join_ack sem avatar: %+v", ack.Players[0])
	}
}
