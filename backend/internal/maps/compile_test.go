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

const interactablesFixture = `{
  "width": 4, "height": 3, "tilewidth": 32, "tileheight": 32,
  "layers": [
    { "name": "Effects", "type": "objectgroup", "objects": [
      { "x": 32, "y": 32, "width": 32, "height": 32,
        "properties": [{ "name": "effect", "value": "spawn" }] },
      { "x": 0, "y": 64, "width": 32, "height": 32,
        "properties": [{ "name": "effect", "value": "spotlight" }] }
    ]},
    { "name": "Interactables", "type": "objectgroup", "objects": [
      { "x": 64, "y": 0, "width": 64, "height": 32, "properties": [
        { "name": "objectId", "value": "quadro" },
        { "name": "type", "value": "iframe" },
        { "name": "title", "value": "Quadro branco" },
        { "name": "url", "value": "https://excalidraw.com" },
        { "name": "range", "value": 2 }
      ]},
      { "x": 0, "y": 0, "width": 32, "height": 32, "properties": [
        { "name": "objectId", "value": "aviso" },
        { "name": "type", "value": "note" },
        { "name": "text", "value": "Bem-vindo!" }
      ]}
    ]}
  ]
}`

func TestCompileInteractablesAndSpotlight(t *testing.T) {
	c, err := Compile([]byte(interactablesFixture))
	if err != nil {
		t.Fatalf("Compile: %v", err)
	}
	if !c.SpotlightAt(0, 2) || c.SpotlightAt(1, 1) {
		t.Error("spotlight em tile errado")
	}
	if len(c.Interactables) != 2 {
		t.Fatalf("esperava 2 objetos: %+v", c.Interactables)
	}
	q := c.Interactables[0]
	if q.ID != "quadro" || q.Type != "iframe" || q.Title != "Quadro branco" || q.Range != 2 {
		t.Errorf("quadro errado: %+v", q)
	}
	if q.X0 != 2 || q.Y0 != 0 || q.X1 != 3 || q.Y1 != 0 {
		t.Errorf("footprint errado: %+v", q)
	}
	if n := c.Interactables[1]; n.Title != "aviso" || n.Range != 1 {
		t.Errorf("note deveria herdar title=id e range=1: %+v", n)
	}
}

func TestCompileRejectsBadInteractables(t *testing.T) {
	bad := []string{
		// URL javascript: num iframe
		`{"x":0,"y":0,"width":32,"height":32,"properties":[{"name":"objectId","value":"a"},{"name":"type","value":"iframe"},{"name":"url","value":"javascript:alert(1)"}]}`,
		// tipo desconhecido
		`{"x":0,"y":0,"width":32,"height":32,"properties":[{"name":"objectId","value":"a"},{"name":"type","value":"portal"}]}`,
		// note sem texto
		`{"x":0,"y":0,"width":32,"height":32,"properties":[{"name":"objectId","value":"a"},{"name":"type","value":"note"}]}`,
		// sem objectId
		`{"x":0,"y":0,"width":32,"height":32,"properties":[{"name":"type","value":"link"},{"name":"url","value":"https://x.y"}]}`,
	}
	for i, obj := range bad {
		tmj := `{"width":2,"height":2,"tilewidth":32,"tileheight":32,"layers":[
		  {"name":"Effects","type":"objectgroup","objects":[{"x":32,"y":32,"width":32,"height":32,"properties":[{"name":"effect","value":"spawn"}]}]},
		  {"name":"Interactables","type":"objectgroup","objects":[` + obj + `]}]}`
		if _, err := Compile([]byte(tmj)); err == nil {
			t.Errorf("caso %d deveria falhar", i)
		}
	}
}
