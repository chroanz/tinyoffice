package game

import (
	"testing"
	"time"

	"pixelrooms/backend/internal/maps"
	"pixelrooms/backend/internal/protocol"
)

// Mapa 12×8 sem paredes: spawn em (1,1), portal em (5,1) → (10,1) e
// área privada "sala" cobrindo (8..10, 5..6).
const mediaFixture = `{
  "width": 12, "height": 8, "tilewidth": 32, "tileheight": 32,
  "layers": [
    { "name": "Effects", "type": "objectgroup", "objects": [
      { "x": 32, "y": 32, "width": 32, "height": 32,
        "properties": [{ "name": "effect", "value": "spawn" }] },
      { "x": 160, "y": 32, "width": 32, "height": 32,
        "properties": [
          { "name": "effect", "value": "portal" },
          { "name": "targetX", "value": 10 },
          { "name": "targetY", "value": 1 }
        ] },
      { "x": 256, "y": 160, "width": 96, "height": 64,
        "properties": [
          { "name": "effect", "value": "private" },
          { "name": "areaId", "value": "sala" }
        ] }
    ]}
  ]
}`

func mediaWorld(t *testing.T) *maps.Compiled {
	t.Helper()
	world, err := maps.Compile([]byte(mediaFixture))
	if err != nil {
		t.Fatalf("Compile: %v", err)
	}
	return world
}

// bareRoom monta uma sala SEM goroutine, para testar o algoritmo de
// grupos com posições exatas (desiredHearing não usa channels).
func bareRoom(t *testing.T, positions map[string][2]int) *Room {
	r := &Room{world: mediaWorld(t), players: make(map[string]*Player)}
	for id, pos := range positions {
		r.players[id] = &Player{ID: id, X: pos[0], Y: pos[1], hears: map[string]bool{}}
	}
	return r
}

func TestProximityHearing(t *testing.T) {
	r := bareRoom(t, map[string][2]int{
		"a": {1, 1},
		"b": {6, 1}, // dist 5 = raio → conecta
		"c": {7, 1}, // dist 6 → não conecta (sem histerese prévia)
	})
	hears := r.desiredHearing(r.players["a"])
	if !hears["b"] || hears["c"] {
		t.Fatalf("esperava ouvir só b: %v", hears)
	}
}

func TestHysteresisKeepsExistingConnection(t *testing.T) {
	r := bareRoom(t, map[string][2]int{
		"a": {1, 1},
		"b": {7, 1}, // dist 6 = raio+1
	})
	// Sem conexão prévia: 6 tiles não conecta.
	if r.desiredHearing(r.players["a"])["b"] {
		t.Fatal("dist 6 não deveria conectar do zero")
	}
	// Com conexão prévia: 6 tiles mantém (histerese).
	r.players["a"].hears["b"] = true
	if !r.desiredHearing(r.players["a"])["b"] {
		t.Fatal("dist 6 deveria manter conexão existente")
	}
	// 7 tiles derruba mesmo com conexão prévia.
	r.players["b"].X = 8
	if r.desiredHearing(r.players["a"])["b"] {
		t.Fatal("dist 7 deveria derrubar")
	}
}

func TestPrivateAreaIsolation(t *testing.T) {
	r := bareRoom(t, map[string][2]int{
		"dentro1": {9, 5},
		"dentro2": {10, 6},
		"fora":    {8, 4}, // colado na área (dist 1 de dentro1), mas fora dela
	})
	in1 := r.desiredHearing(r.players["dentro1"])
	if !in1["dentro2"] || in1["fora"] {
		t.Fatalf("dentro da área: esperava ouvir só dentro2: %v", in1)
	}
	out := r.desiredHearing(r.players["fora"])
	if out["dentro1"] || out["dentro2"] {
		t.Fatalf("de fora não se ouve a área privada: %v", out)
	}
}

func TestJoinSendsMediaAndPortalTeleports(t *testing.T) {
	room := NewRoom("m", mediaWorld(t), nil)
	t.Cleanup(room.Stop)

	s1, s2 := newFakeSession(), newFakeSession()
	p1 := room.Join(s1, "alice", nil)
	m1 := s1.wait(t, protocol.SMedia) // sozinha: hear vazio
	if len(m1.Hear) != 0 {
		t.Fatalf("alice sozinha não deveria ouvir ninguém: %+v", m1.Hear)
	}

	p2 := room.Join(s2, "bob", nil) // mesmo spawn: dist 0
	m2 := s2.wait(t, protocol.SMedia)
	if len(m2.Hear) != 1 || m2.Hear[0] != p1.ID {
		t.Fatalf("bob deveria ouvir alice: %+v", m2.Hear)
	}
	m1 = s1.wait(t, protocol.SMedia) // diff para alice: agora ouve bob
	if len(m1.Hear) != 1 || m1.Hear[0] != p2.ID {
		t.Fatalf("alice deveria ouvir bob: %+v", m1.Hear)
	}

	// alice anda até o portal em (5,1): 4 passos para a direita.
	for i := 0; i < 4; i++ {
		room.Move(p1.ID, protocol.DirRight)
		time.Sleep(StepInterval + 20*time.Millisecond)
	}
	tp := s2.wait(t, protocol.STeleport)
	if tp.PlayerID != p1.ID || tp.X != 10 || tp.Y != 1 {
		t.Fatalf("teleporte errado: %+v", tp)
	}

	// Depois do teleporte alice está a 9 tiles de bob → mídia desconecta.
	deadline := time.After(2 * time.Second)
	for {
		m := s2.wait(t, protocol.SMedia)
		if len(m.Hear) == 0 {
			return // desconectou — ok
		}
		select {
		case <-deadline:
			t.Fatal("mídia não desconectou após o teleporte")
		default:
		}
	}
}

// Mapa 12×8 com spotlight em (1,6).
const spotlightFixture = `{
  "width": 12, "height": 8, "tilewidth": 32, "tileheight": 32,
  "layers": [
    { "name": "Effects", "type": "objectgroup", "objects": [
      { "x": 32, "y": 32, "width": 32, "height": 32,
        "properties": [{ "name": "effect", "value": "spawn" }] },
      { "x": 32, "y": 192, "width": 32, "height": 32,
        "properties": [{ "name": "effect", "value": "spotlight" }] },
      { "x": 256, "y": 160, "width": 96, "height": 64,
        "properties": [
          { "name": "effect", "value": "private" },
          { "name": "areaId", "value": "sala" }
        ] }
    ]}
  ]
}`

func TestSpotlightIsHeardByWholeMap(t *testing.T) {
	world, err := maps.Compile([]byte(spotlightFixture))
	if err != nil {
		t.Fatal(err)
	}
	r := &Room{world: world, players: make(map[string]*Player)}
	for id, pos := range map[string][2]int{
		"palco":  {1, 6},  // no spotlight
		"longe":  {11, 1}, // 10 tiles de distância
		"nasala": {9, 5},  // dentro de área privada
	} {
		r.players[id] = &Player{ID: id, X: pos[0], Y: pos[1], hears: map[string]bool{}}
	}
	if !r.desiredHearing(r.players["longe"])["palco"] {
		t.Fatal("quem está longe deveria ouvir o spotlight")
	}
	if !r.desiredHearing(r.players["nasala"])["palco"] {
		t.Fatal("quem está em área privada também ouve o spotlight")
	}
	// O palestrante continua ouvindo só por proximidade/área normal.
	h := r.desiredHearing(r.players["palco"])
	if h["longe"] || h["nasala"] {
		t.Fatalf("spotlight não é bidirecional: %v", h)
	}
	if got := r.spotlights(); len(got) != 1 || got[0] != "palco" {
		t.Fatalf("spotlights(): %v", got)
	}
}
