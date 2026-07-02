package maps

import "testing"

// Mapa 4×3: parede cobrindo os tiles (0,0)-(3,0) e spawn em (1,1).
const fixture = `{
  "width": 4, "height": 3, "tilewidth": 32, "tileheight": 32,
  "layers": [
    { "name": "Ground", "type": "tilelayer", "data": [1,1,1,1,1,1,1,1,1,1,1,1] },
    { "name": "Effects", "type": "objectgroup", "objects": [
      { "x": 0, "y": 0, "width": 128, "height": 32,
        "properties": [{ "name": "effect", "value": "impassable" }] },
      { "x": 32, "y": 32, "width": 32, "height": 32,
        "properties": [{ "name": "effect", "value": "spawn" }] }
    ]}
  ]
}`

func TestCompile(t *testing.T) {
	c, err := Compile([]byte(fixture))
	if err != nil {
		t.Fatalf("Compile: %v", err)
	}
	if c.Width != 4 || c.Height != 3 {
		t.Fatalf("dimensões erradas: %dx%d", c.Width, c.Height)
	}

	for x := 0; x < 4; x++ {
		if c.Walkable(x, 0) {
			t.Errorf("tile (%d,0) deveria estar bloqueado", x)
		}
	}
	if !c.Walkable(1, 1) {
		t.Error("tile (1,1) deveria ser transitável")
	}
	if c.Walkable(-1, 1) || c.Walkable(4, 1) || c.Walkable(1, 3) {
		t.Error("tiles fora do mapa deveriam ser intransitáveis")
	}

	if len(c.Spawns) != 1 || c.Spawns[0] != (Point{X: 1, Y: 1}) {
		t.Errorf("spawns errados: %+v", c.Spawns)
	}
}

func TestCompileRejectsMapWithoutSpawn(t *testing.T) {
	noSpawn := `{"width":2,"height":2,"tilewidth":32,"tileheight":32,"layers":[]}`
	if _, err := Compile([]byte(noSpawn)); err == nil {
		t.Fatal("esperava erro para mapa sem spawn")
	}
}

func TestCompileRejectsWrongTileSize(t *testing.T) {
	wrong := `{"width":2,"height":2,"tilewidth":16,"tileheight":16,"layers":[]}`
	if _, err := Compile([]byte(wrong)); err == nil {
		t.Fatal("esperava erro para tile diferente de 32px")
	}
}
