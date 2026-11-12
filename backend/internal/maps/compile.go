package maps

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// TileSize é o tamanho do tile em pixels (ESPECIFICACAO.md §5.1).
const TileSize = 32

// Point é uma coordenada em tiles.
type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Tipos de objeto interativo aceitos (RF-OBJ-03).
var InteractableTypes = []string{"iframe", "image", "video", "note", "link"}

// Interactable é um objeto interativo validado (camada "Interactables").
// O cliente lê os mesmos dados do .tmj para renderizar o highlight e
// abrir o conteúdo; o servidor valida no carregamento para que mapas
// malformados sejam rejeitados cedo (RNF-13: URLs só http/https).
type Interactable struct {
	ID    string `json:"objectId"`
	Type  string `json:"type"`
	Title string `json:"title"`
	URL   string `json:"url,omitempty"`
	Text  string `json:"text,omitempty"`
	// Footprint em tiles (inclusivo) e alcance de interação (Chebyshev).
	X0, Y0, X1, Y1 int
	Range          int
}

// Compiled é o formato interno de runtime de um mapa: o que o game server
// precisa para validar movimento, posicionar jogadores e calcular grupos
// de mídia.
type Compiled struct {
	Width         int
	Height        int
	Spawns        []Point
	Interactables []Interactable
	collision     []bool          // índice y*Width+x; true = bloqueado
	areas         map[int]string  // índice do tile → areaId (área privada)
	spotlight     map[int]bool    // índice do tile → é spotlight
	portals       map[Point]Point // tile do portal → tile de destino
}

// Walkable informa se o tile (x, y) existe e é transitável.
func (c *Compiled) Walkable(x, y int) bool {
	if x < 0 || y < 0 || x >= c.Width || y >= c.Height {
		return false
	}
	return !c.collision[y*c.Width+x]
}

// AreaAt devolve o areaId da área privada que cobre (x, y), ou "" se nenhuma.
func (c *Compiled) AreaAt(x, y int) string {
	if x < 0 || y < 0 || x >= c.Width || y >= c.Height {
		return ""
	}
	return c.areas[y*c.Width+x]
}

// SpotlightAt informa se (x, y) é um tile spotlight (RF-RTC-05).
func (c *Compiled) SpotlightAt(x, y int) bool {
	if x < 0 || y < 0 || x >= c.Width || y >= c.Height {
		return false
	}
	return c.spotlight[y*c.Width+x]
}

// PortalAt devolve o destino do portal em (x, y), se houver.
func (c *Compiled) PortalAt(x, y int) (Point, bool) {
	p, ok := c.portals[Point{X: x, Y: y}]
	return p, ok
}

// Compile valida um mapa Tiled (.tmj) e o converte para o formato interno.
//
// Convenções (ESPECIFICACAO.md §5.5–5.6): a camada "Effects" é um objectgroup
// cujos retângulos têm a propriedade `effect` (impassable, spawn, private,
// portal, spotlight); a camada "Interactables" é um objectgroup de objetos
// interativos. As coordenadas dos objetos são em pixels e são convertidas
// para o grid de tiles cobrindo todos os tiles tocados pelo retângulo.
func Compile(tmj []byte) (*Compiled, error) {
	var m tmjMap
	if err := json.Unmarshal(tmj, &m); err != nil {
		return nil, fmt.Errorf("tmj inválido: %w", err)
	}
	if m.Width <= 0 || m.Height <= 0 {
		return nil, fmt.Errorf("dimensões inválidas: %dx%d", m.Width, m.Height)
	}
	if m.TileWidth != TileSize || m.TileHeight != TileSize {
		return nil, fmt.Errorf("tiles devem ser %dx%d px, mapa usa %dx%d", TileSize, TileSize, m.TileWidth, m.TileHeight)
	}

	c := &Compiled{
		Width:     m.Width,
		Height:    m.Height,
		collision: make([]bool, m.Width*m.Height),
		areas:     make(map[int]string),
		spotlight: make(map[int]bool),
		portals:   make(map[Point]Point),
	}

	for _, layer := range m.Layers {
		if layer.Type != "objectgroup" {
			continue
		}
		switch layer.Name {
		case "Effects":
			if err := c.compileEffects(layer); err != nil {
				return nil, err
			}
		case "Interactables":
			if err := c.compileInteractables(layer); err != nil {
				return nil, err
			}
		}
	}

	if len(c.Spawns) == 0 {
		return nil, fmt.Errorf("mapa não tem nenhum tile de spawn na camada Effects")
	}
	for _, s := range c.Spawns {
		if !c.Walkable(s.X, s.Y) {
			return nil, fmt.Errorf("spawn em tile bloqueado: %d,%d", s.X, s.Y)
		}
	}
	for from, to := range c.portals {
		if !c.Walkable(to.X, to.Y) {
			return nil, fmt.Errorf("portal em %d,%d aponta para tile inválido %d,%d", from.X, from.Y, to.X, to.Y)
		}
		if _, isPortal := c.portals[to]; isPortal {
			return nil, fmt.Errorf("portal em %d,%d aponta para outro portal (loop)", from.X, from.Y)
		}
	}
	return c, nil
}

func (c *Compiled) compileEffects(layer tmjLayer) error {
	for _, obj := range layer.Objects {
		x0, y0, x1, y1 := tileRect(obj)
		switch effect := obj.stringProp("effect"); effect {
		case "impassable":
			c.eachTile(x0, y0, x1, y1, func(x, y int) {
				c.collision[y*c.Width+x] = true
			})
		case "spawn":
			c.eachTile(x0, y0, x1, y1, func(x, y int) {
				c.Spawns = append(c.Spawns, Point{X: x, Y: y})
			})
		case "private":
			areaID := obj.stringProp("areaId")
			if areaID == "" {
				return fmt.Errorf("área privada sem 'areaId' (em %.0f,%.0f)", obj.X, obj.Y)
			}
			c.eachTile(x0, y0, x1, y1, func(x, y int) {
				c.areas[y*c.Width+x] = areaID
			})
		case "spotlight":
			c.eachTile(x0, y0, x1, y1, func(x, y int) {
				c.spotlight[y*c.Width+x] = true
			})
		case "portal":
			tx, okX := obj.intProp("targetX")
			ty, okY := obj.intProp("targetY")
			if !okX || !okY {
				return fmt.Errorf("portal sem targetX/targetY (em %.0f,%.0f)", obj.X, obj.Y)
			}
			c.eachTile(x0, y0, x1, y1, func(x, y int) {
				c.portals[Point{X: x, Y: y}] = Point{X: tx, Y: ty}
			})
		case "":
			return fmt.Errorf("objeto em Effects sem propriedade 'effect' (em %.0f,%.0f)", obj.X, obj.Y)
		default:
			return fmt.Errorf("efeito desconhecido %q (em %.0f,%.0f)", effect, obj.X, obj.Y)
		}
	}
	return nil
}

func (c *Compiled) compileInteractables(layer tmjLayer) error {
	seen := make(map[string]bool)
	for _, obj := range layer.Objects {
		it := Interactable{
			ID:    obj.stringProp("objectId"),
			Type:  obj.stringProp("type"),
			Title: obj.stringProp("title"),
			URL:   obj.stringProp("url"),
			Text:  obj.stringProp("text"),
			Range: 1,
		}
		it.X0, it.Y0, it.X1, it.Y1 = tileRect(obj)
		if r, ok := obj.intProp("range"); ok && r >= 0 {
			it.Range = r
		}
		if it.ID == "" {
			return fmt.Errorf("objeto interativo sem 'objectId' (em %.0f,%.0f)", obj.X, obj.Y)
		}
		if seen[it.ID] {
			return fmt.Errorf("objectId duplicado: %q", it.ID)
		}
		seen[it.ID] = true
		if it.Title == "" {
			it.Title = it.ID
		}

		switch it.Type {
		case "note":
			if strings.TrimSpace(it.Text) == "" {
				return fmt.Errorf("objeto %q (note) sem 'text'", it.ID)
			}
		case "iframe", "image", "video", "link":
			if !validHTTPURL(it.URL) {
				return fmt.Errorf("objeto %q (%s) com 'url' inválida: %q", it.ID, it.Type, it.URL)
			}
		default:
			return fmt.Errorf("objeto %q com tipo desconhecido %q", it.ID, it.Type)
		}
		c.Interactables = append(c.Interactables, it)
	}
	return nil
}

// validHTTPURL aceita URLs absolutas http(s) ou caminhos same-origin
// ("/assets/...") — nada de javascript: ou data: chegando a um iframe (RNF-13).
func validHTTPURL(raw string) bool {
	if strings.HasPrefix(raw, "/") && !strings.HasPrefix(raw, "//") {
		return true
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return false
	}
	return u.Scheme == "http" || u.Scheme == "https"
}

// eachTile aplica fn a cada tile do retângulo, recortado aos limites do mapa.
func (c *Compiled) eachTile(x0, y0, x1, y1 int, fn func(x, y int)) {
	for y := max(y0, 0); y <= min(y1, c.Height-1); y++ {
		for x := max(x0, 0); x <= min(x1, c.Width-1); x++ {
			fn(x, y)
		}
	}
}

// tileRect converte o retângulo em pixels de um objeto para o intervalo
// inclusivo de tiles que ele cobre.
func tileRect(obj tmjObject) (x0, y0, x1, y1 int) {
	x0 = int(obj.X) / TileSize
	y0 = int(obj.Y) / TileSize
	x1 = int(obj.X+obj.Width-1) / TileSize
	y1 = int(obj.Y+obj.Height-1) / TileSize
	return
}
