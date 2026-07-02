package maps

import (
	"encoding/json"
	"fmt"
)

// TileSize é o tamanho do tile em pixels (ESPECIFICACAO.md §5.1).
const TileSize = 32

// Point é uma coordenada em tiles.
type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Compiled é o formato interno de runtime de um mapa: o que o game server
// precisa para validar movimento e posicionar jogadores. Efeitos adicionais
// (portais, áreas privadas, spotlight) serão acrescentados nas Fases 2+.
type Compiled struct {
	Width    int
	Height   int
	Spawns   []Point
	collision []bool // índice y*Width+x; true = bloqueado
}

// Walkable informa se o tile (x, y) existe e é transitável.
func (c *Compiled) Walkable(x, y int) bool {
	if x < 0 || y < 0 || x >= c.Width || y >= c.Height {
		return false
	}
	return !c.collision[y*c.Width+x]
}

// Compile valida um mapa Tiled (.tmj) e o converte para o formato interno.
//
// Convenções (ESPECIFICACAO.md §5.6): a camada "Effects" é um objectgroup
// cujos retângulos têm a propriedade `effect` com valor `impassable` ou
// `spawn`; as coordenadas dos objetos são em pixels e são convertidas para
// o grid de tiles cobrindo todos os tiles tocados pelo retângulo.
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
	}

	for _, layer := range m.Layers {
		if layer.Name != "Effects" || layer.Type != "objectgroup" {
			continue
		}
		for _, obj := range layer.Objects {
			x0, y0, x1, y1 := tileRect(obj)
			switch effect := obj.stringProp("effect"); effect {
			case "impassable":
				c.markCollision(x0, y0, x1, y1)
			case "spawn":
				for y := y0; y <= y1; y++ {
					for x := x0; x <= x1; x++ {
						if x >= 0 && y >= 0 && x < c.Width && y < c.Height {
							c.Spawns = append(c.Spawns, Point{X: x, Y: y})
						}
					}
				}
			case "":
				return nil, fmt.Errorf("objeto em Effects sem propriedade 'effect' (em %.0f,%.0f)", obj.X, obj.Y)
			default:
				// Efeitos de fases futuras (portal, private, spotlight) são
				// aceitos e ignorados por enquanto.
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
	return c, nil
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

func (c *Compiled) markCollision(x0, y0, x1, y1 int) {
	for y := max(y0, 0); y <= min(y1, c.Height-1); y++ {
		for x := max(x0, 0); x <= min(x1, c.Width-1); x++ {
			c.collision[y*c.Width+x] = true
		}
	}
}
