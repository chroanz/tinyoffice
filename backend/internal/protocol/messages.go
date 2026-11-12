// Package protocol define as mensagens do protocolo em tempo real.
//
// Os formatos espelham proto/pixelrooms/v1/messages.proto. Na Fase 1 o
// transporte é JSON para simplificar; a migração para Protobuf binário é
// uma troca de codec no package ws, sem mudança de semântica.
package protocol

import "encoding/json"

// Direções do avatar (valores estáveis, usados também pelo cliente).
const (
	DirDown  = "down"
	DirUp    = "up"
	DirLeft  = "left"
	DirRight = "right"
)

// Escopos de chat (RF-CHAT-01).
const (
	ChatNearby = "nearby" // quem está no raio/área (mesmo grupo de mídia)
	ChatMap    = "map"    // todos no mapa
)

// Tipos de mensagem cliente → servidor.
const (
	CJoin  = "join"
	CMove  = "move"
	CChat  = "chat"
	CEmote = "emote"
	CPing  = "ping"
)

// Tipos de mensagem servidor → cliente.
const (
	SJoinAck      = "join_ack"
	SPlayerJoined = "player_joined"
	SPlayerLeft   = "player_left"
	SMovement     = "movement"
	STeleport     = "teleport"
	SMedia        = "media"
	SChat         = "chat"
	SEmote        = "emote"
	SError        = "error"
	SPong         = "pong"
)

// Avatar é a escolha de camadas do paper-doll (ESPECIFICACAO.md §5.2).
// Os valores são ids de itens do manifesto de avatares; o servidor valida
// contra a lista conhecida e aplica o padrão quando inválido.
type Avatar struct {
	Body string `json:"body"`
	Hair string `json:"hair"`
	Top  string `json:"top"`
}

// ClientMessage é o envelope de toda mensagem recebida do cliente.
type ClientMessage struct {
	Type   string  `json:"type"`
	Name   string  `json:"name,omitempty"`   // join
	Map    string  `json:"map,omitempty"`    // join (vazio = mapa padrão)
	Avatar *Avatar `json:"avatar,omitempty"` // join
	Dir    string  `json:"dir,omitempty"`    // move
	Scope  string  `json:"scope,omitempty"`  // chat
	Text   string  `json:"text,omitempty"`   // chat
	Emote  string  `json:"emote,omitempty"`  // emote
	T      int64   `json:"t,omitempty"`      // ping (client time ms)
}

// PlayerState é o estado público de um jogador dentro de uma sala.
type PlayerState struct {
	ID     string `json:"playerId"`
	Name   string `json:"name"`
	Avatar Avatar `json:"avatar"`
	X      int    `json:"x"`
	Y      int    `json:"y"`
	Dir    string `json:"dir"`
	Moving bool   `json:"moving"`
}

// Move é uma entrada do lote de movimentos de um tick.
type Move struct {
	ID     string `json:"playerId"`
	X      int    `json:"x"`
	Y      int    `json:"y"`
	Dir    string `json:"dir"`
	Moving bool   `json:"moving"`
}

// ServerMessage é o envelope de toda mensagem enviada ao cliente.
type ServerMessage struct {
	Type string `json:"type"`

	// join_ack
	PlayerID string        `json:"playerId,omitempty"`
	MapID    string        `json:"mapId,omitempty"`
	Players  []PlayerState `json:"players,omitempty"`

	// player_joined
	Player *PlayerState `json:"player,omitempty"`

	// movement
	Tick  uint64 `json:"tick,omitempty"`
	Moves []Move `json:"moves,omitempty"`

	// teleport (usa PlayerID + destino)
	X int `json:"x,omitempty"`
	Y int `json:"y,omitempty"`

	// media: credenciais do SFU + quem este jogador deve ouvir/ver.
	// Spotlights lista quem está em tile spotlight (ouvido a volume cheio
	// por todo o mapa); Spotlight indica se o próprio jogador está num.
	URL        string   `json:"url,omitempty"`
	Token      string   `json:"token,omitempty"`
	Hear       []string `json:"hear,omitempty"`
	AreaID     string   `json:"areaId,omitempty"`
	Spotlights []string `json:"spotlights,omitempty"`
	Spotlight  bool     `json:"spotlight,omitempty"`

	// chat (usa PlayerID + Name do autor)
	Name  string `json:"name,omitempty"`
	Scope string `json:"scope,omitempty"`
	Text  string `json:"text,omitempty"`
	At    int64  `json:"at,omitempty"` // unix ms (servidor)

	// emote (usa PlayerID)
	Emote string `json:"emote,omitempty"`

	// error
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`

	// pong
	T          int64 `json:"t,omitempty"`
	ServerTime int64 `json:"serverTime,omitempty"`
}

// Marshal serializa uma ServerMessage; falha de marshal é bug de programação,
// então o retorno é []byte direto (panic em caso impossível).
func Marshal(m ServerMessage) []byte {
	b, err := json.Marshal(m)
	if err != nil {
		panic("protocol: marshal: " + err.Error())
	}
	return b
}
