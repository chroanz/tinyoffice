package game

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sync"

	"pixelrooms/backend/internal/maps"
)

// DefaultMap é o mapa usado quando o cliente não pede um específico.
// Na Fase 1 os mapas vêm dos templates em assets/; nas próximas fases o
// Manager passa a carregar mapas de espaços do banco (package store).
const DefaultMap = "lobby"

var validMapID = regexp.MustCompile(`^[a-z0-9-]{1,64}$`)

// Manager mantém as salas ativas, criando-as sob demanda a partir dos
// templates .tmj no diretório de assets.
type Manager struct {
	assetsDir string

	mu    sync.Mutex
	rooms map[string]*Room
}

func NewManager(assetsDir string) *Manager {
	return &Manager{assetsDir: assetsDir, rooms: make(map[string]*Room)}
}

// Room devolve a sala do mapa pedido, carregando e compilando o template na
// primeira vez.
func (m *Manager) Room(id string) (*Room, error) {
	if id == "" {
		id = DefaultMap
	}
	if !validMapID.MatchString(id) {
		return nil, fmt.Errorf("id de mapa inválido")
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if r, ok := m.rooms[id]; ok {
		return r, nil
	}

	path := filepath.Join(m.assetsDir, "maps", "templates", id+".tmj")
	tmj, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("mapa %q não encontrado", id)
	}
	world, err := maps.Compile(tmj)
	if err != nil {
		return nil, fmt.Errorf("mapa %q inválido: %w", id, err)
	}

	r := NewRoom(id, world)
	m.rooms[id] = r
	return r, nil
}
