package game

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"pixelrooms/backend/internal/protocol"
)

// Session é a visão que a sala tem de uma conexão de cliente. Implementada
// pelo package ws; abstraída aqui para testes e para evitar acoplamento.
type Session interface {
	// Send enfileira uma mensagem sem bloquear; retorna false se o buffer do
	// cliente está cheio (cliente lento → deve ser desconectado).
	Send(msg []byte) bool
	// Close encerra a conexão; idempotente.
	Close()
}

// Player é o estado autoritativo de um jogador dentro de uma sala.
// Só é lido/alterado pela goroutine da sala.
type Player struct {
	ID   string
	Name string
	X    int
	Y    int
	Dir  string

	sess     Session
	lastStep time.Time
}

func (p *Player) state(moving bool) protocol.PlayerState {
	return protocol.PlayerState{
		ID: p.ID, Name: p.Name, X: p.X, Y: p.Y, Dir: p.Dir, Moving: moving,
	}
}

func newPlayerID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("game: rand: " + err.Error())
	}
	return hex.EncodeToString(b[:])
}
