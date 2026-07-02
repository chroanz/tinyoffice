package game

import (
	"log/slog"
	"math/rand/v2"
	"time"

	"pixelrooms/backend/internal/maps"
	"pixelrooms/backend/internal/protocol"
)

const (
	// TickInterval é o período do loop de simulação (20 Hz, RNF-01).
	TickInterval = 50 * time.Millisecond

	// StepInterval é o tempo mínimo entre passos de 1 tile (~6,7 tiles/s).
	// O cliente usa o mesmo valor para a predição.
	StepInterval = 150 * time.Millisecond

	// stepTolerance absorve jitter de rede: intents que chegam um pouco
	// antes do cooldown ainda são aceitos.
	stepTolerance = StepInterval * 8 / 10
)

type joinRequest struct {
	sess  Session
	name  string
	reply chan *Player
}

type moveIntent struct {
	playerID string
	dir      string
}

// Room é uma instância ativa de um mapa. Todo o estado é confinado à
// goroutine de run(); a comunicação externa acontece pelos channels.
type Room struct {
	ID    string
	world *maps.Compiled

	players map[string]*Player

	joinCh  chan joinRequest
	leaveCh chan string
	moveCh  chan moveIntent
	stopCh  chan struct{}

	tick      uint64
	tickMoves []protocol.Move
}

func NewRoom(id string, world *maps.Compiled) *Room {
	r := &Room{
		ID:      id,
		world:   world,
		players: make(map[string]*Player),
		joinCh:  make(chan joinRequest),
		leaveCh: make(chan string, 16),
		moveCh:  make(chan moveIntent, 256),
		stopCh:  make(chan struct{}),
	}
	go r.run()
	return r
}

// Join adiciona a sessão à sala e devolve o jogador criado (bloqueante,
// respondido pela goroutine da sala).
func (r *Room) Join(sess Session, name string) *Player {
	req := joinRequest{sess: sess, name: name, reply: make(chan *Player, 1)}
	select {
	case r.joinCh <- req:
		return <-req.reply
	case <-r.stopCh:
		return nil
	}
}

// Move registra a intenção de andar 1 tile na direção dada.
func (r *Room) Move(playerID, dir string) {
	select {
	case r.moveCh <- moveIntent{playerID: playerID, dir: dir}:
	default:
		// Fila cheia: descartar é seguro — o cliente reconcilia com o
		// próximo delta autoritativo.
	}
}

// Leave remove o jogador da sala.
func (r *Room) Leave(playerID string) {
	select {
	case r.leaveCh <- playerID:
	case <-r.stopCh:
	}
}

// Stop encerra a goroutine da sala.
func (r *Room) Stop() { close(r.stopCh) }

func (r *Room) run() {
	ticker := time.NewTicker(TickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-r.stopCh:
			return
		case req := <-r.joinCh:
			r.handleJoin(req)
		case id := <-r.leaveCh:
			r.handleLeave(id)
		case in := <-r.moveCh:
			r.handleMove(in)
		case <-ticker.C:
			r.flushTick()
		}
	}
}

func (r *Room) handleJoin(req joinRequest) {
	spawn := r.world.Spawns[rand.IntN(len(r.world.Spawns))]
	p := &Player{
		ID:   newPlayerID(),
		Name: req.name,
		X:    spawn.X,
		Y:    spawn.Y,
		Dir:  protocol.DirDown,
		sess: req.sess,
	}

	states := make([]protocol.PlayerState, 0, len(r.players)+1)
	states = append(states, p.state(false))
	for _, other := range r.players {
		states = append(states, other.state(false))
	}

	r.players[p.ID] = p
	req.reply <- p

	p.sess.Send(protocol.Marshal(protocol.ServerMessage{
		Type:     protocol.SJoinAck,
		PlayerID: p.ID,
		MapID:    r.ID,
		Players:  states,
	}))

	st := p.state(false)
	r.broadcastExcept(p.ID, protocol.Marshal(protocol.ServerMessage{
		Type:   protocol.SPlayerJoined,
		Player: &st,
	}))
	slog.Info("player joined", "room", r.ID, "player", p.ID, "name", p.Name, "online", len(r.players))
}

func (r *Room) handleLeave(id string) {
	if _, ok := r.players[id]; !ok {
		return
	}
	delete(r.players, id)
	r.broadcastExcept(id, protocol.Marshal(protocol.ServerMessage{
		Type:     protocol.SPlayerLeft,
		PlayerID: id,
	}))
	slog.Info("player left", "room", r.ID, "player", id, "online", len(r.players))
}

func (r *Room) handleMove(in moveIntent) {
	p, ok := r.players[in.playerID]
	if !ok || !validDir(in.dir) {
		return
	}

	// Virar é sempre permitido; andar respeita o cooldown e a colisão.
	turnedOnly := p.Dir != in.dir
	p.Dir = in.dir

	now := time.Now()
	nx, ny := step(p.X, p.Y, in.dir)
	switch {
	case now.Sub(p.lastStep) < stepTolerance:
		// Cedo demais (cliente mal-comportado): reafirma a posição atual
		// para o cliente reconciliar a predição.
		r.queueMove(protocol.Move{ID: p.ID, X: p.X, Y: p.Y, Dir: p.Dir, Moving: false})
	case !r.world.Walkable(nx, ny):
		// Bloqueado: só vira. O cliente prevê o mesmo resultado.
		if turnedOnly {
			r.queueMove(protocol.Move{ID: p.ID, X: p.X, Y: p.Y, Dir: p.Dir, Moving: false})
		}
	default:
		p.X, p.Y = nx, ny
		p.lastStep = now
		r.queueMove(protocol.Move{ID: p.ID, X: p.X, Y: p.Y, Dir: p.Dir, Moving: true})
	}
}

// queueMove acumula o movimento para o broadcast do tick, substituindo uma
// entrada anterior do mesmo jogador no mesmo tick.
func (r *Room) queueMove(m protocol.Move) {
	for i := range r.tickMoves {
		if r.tickMoves[i].ID == m.ID {
			r.tickMoves[i] = m
			return
		}
	}
	r.tickMoves = append(r.tickMoves, m)
}

func (r *Room) flushTick() {
	r.tick++
	if len(r.tickMoves) == 0 {
		return
	}
	msg := protocol.Marshal(protocol.ServerMessage{
		Type:  protocol.SMovement,
		Tick:  r.tick,
		Moves: r.tickMoves,
	})
	r.tickMoves = r.tickMoves[:0]
	r.broadcastExcept("", msg)
}

// broadcastExcept envia msg a todos os jogadores, exceto exceptID (vazio =
// todos). Clientes com buffer cheio são desconectados (backpressure).
func (r *Room) broadcastExcept(exceptID string, msg []byte) {
	for id, p := range r.players {
		if id == exceptID {
			continue
		}
		if !p.sess.Send(msg) {
			slog.Warn("client too slow, closing", "room", r.ID, "player", id)
			p.sess.Close()
		}
	}
}

func step(x, y int, dir string) (int, int) {
	switch dir {
	case protocol.DirUp:
		return x, y - 1
	case protocol.DirDown:
		return x, y + 1
	case protocol.DirLeft:
		return x - 1, y
	case protocol.DirRight:
		return x + 1, y
	}
	return x, y
}

func validDir(dir string) bool {
	switch dir {
	case protocol.DirUp, protocol.DirDown, protocol.DirLeft, protocol.DirRight:
		return true
	}
	return false
}
