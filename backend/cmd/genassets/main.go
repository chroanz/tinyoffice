// genassets gera os assets gráficos do PixelRooms (CC0, feitos do zero):
// tileset, spritesheets de avatar por camada (grade da ESPECIFICACAO.md
// §5.2), pôster de exemplo e o mapa template "lobby" no formato Tiled
// (.tmj, convenções da §5.6). O estilo e as técnicas estão em
// docs/art-style.md; a arte em si está em art.go.
//
// Uso: go run ./cmd/genassets [-out ../assets]
//
// Os arquivos gerados são commitados no repositório; rode de novo apenas se
// mudar este gerador.
package main

import (
	"encoding/json"
	"flag"
	"image"
	"image/color"
	"image/png"
	"log"
	"os"
	"path/filepath"
)

const tile = 32

func main() {
	out := flag.String("out", "../assets", "diretório raiz de assets")
	flag.Parse()

	tiles := tileCatalog()
	img, gids := renderTileset(tiles)
	writePNG(filepath.Join(*out, "tilesets", "basic.png"), img)
	names := make([]string, len(tiles))
	for i, t := range tiles {
		names[i] = t.name
	}
	writeJSON(filepath.Join(*out, "tilesets", "manifest.json"), map[string]any{
		"tileSize": tile,
		"items": []map[string]any{{
			"id": "basic", "file": "tilesets/basic.png", "columns": tilesetColumns,
			"tiles": names, "license": "CC0", "author": "PixelRooms (gerado por cmd/genassets)",
		}},
	})

	manifest := avatarManifest()
	for _, item := range manifest.Items {
		writePNG(filepath.Join(*out, item.Sheet), avatarSheet(item.Layer, item.ID))
	}
	writeJSON(filepath.Join(*out, "avatars", "manifest.json"), manifest)

	writePNG(filepath.Join(*out, "objects", "poster-pixelrooms.png"), posterImage())
	writeJSON(filepath.Join(*out, "objects", "manifest.json"), map[string]any{
		"items": []map[string]any{{
			"id": "poster-pixelrooms", "file": "objects/poster-pixelrooms.png",
			"license": "CC0", "author": "PixelRooms (gerado por cmd/genassets)",
		}},
	})

	writeJSON(filepath.Join(*out, "maps", "templates", "lobby.tmj"), lobbyMap(gids, len(tiles)))
	log.Println("assets gerados em", *out)
}

// ── Manifesto do avatar ───────────────────────────────────────────

type avatarItem struct {
	ID      string `json:"id"`
	Layer   string `json:"layer"`
	Sheet   string `json:"sheet"`
	Label   string `json:"label"`
	Color   string `json:"color"`
	License string `json:"license"`
	Author  string `json:"author"`
}

type avatarManifestT struct {
	FrameSize   map[string]int `json:"frameSize"`
	SheetLayout string         `json:"sheetLayout"`
	Layers      []string       `json:"layers"`
	Items       []avatarItem   `json:"items"`
}

// Ordem estável para o manifesto e para o seletor na UI (espelhada em
// backend/internal/game/avatar.go e frontend/src/game/avatarCatalog.ts).
var (
	skinOrder = []string{"light", "medium", "dark"}
	hairOrder = []string{"brown", "black", "blonde", "red", "blue"}
	topOrder  = []string{"blue", "green", "red", "yellow", "purple", "white"}
	labels    = map[string]string{
		"light": "Clara", "medium": "Média", "dark": "Escura",
		"brown": "Castanho", "black": "Preto", "blonde": "Loiro", "red": "Ruivo", "blue": "Azul",
		"green": "Verde", "yellow": "Amarelo", "purple": "Roxo", "white": "Branco",
	}
)

func avatarManifest() avatarManifestT {
	m := avatarManifestT{
		FrameSize:   map[string]int{"w": 32, "h": 64},
		SheetLayout: "6 colunas × 5 linhas (idle×2, walk×4; linhas: down, up, left, right, sit)",
		Layers:      []string{"body", "top", "hair"},
	}
	add := func(layer string, ids []string, key rune) {
		for _, id := range ids {
			c := avatarPalette(layer, id)[key]
			m.Items = append(m.Items, avatarItem{
				ID: id, Layer: layer, Sheet: "avatars/" + layer + "/" + id + ".png",
				Label: labels[id], Color: hexColor(c),
				License: "CC0", Author: "PixelRooms (gerado por cmd/genassets)",
			})
		}
	}
	add("body", skinOrder, 'S')
	add("top", topOrder, 'T')
	add("hair", hairOrder, 'H')
	return m
}

// ── Pôster (objeto "image") ─────────────────────────────────────

func posterImage() *image.RGBA {
	const w, h = 192, 256
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	fillRect(img, 0, 0, w, h, hex("#1a1b26"))
	fillRect(img, 8, 8, w-16, h-16, hex("#24283b"))
	for y := 0; y < 6; y++ {
		for x := 0; x < 8; x++ {
			c := hex("#45953a")
			if (x+y)%3 == 0 {
				c = hex("#b7ec8d")
			} else if (x*y)%5 == 1 {
				c = hex("#5fb6ec")
			}
			fillRect(img, 24+x*18, 40+y*18, 14, 14, c)
		}
	}
	fillRect(img, 24, 160, 144, 10, hex("#ffffff"))
	fillRect(img, 24, 180, 96, 6, hex("#a0a8c0"))
	fillRect(img, 24, 194, 120, 6, hex("#a0a8c0"))
	fillRect(img, 24, 208, 72, 6, hex("#a0a8c0"))
	return img
}

// ── Mapa lobby ───────────────────────────────────────────────────

const (
	lobbyW = 30
	lobbyH = 20
)

// Sala de reunião (área privada): perímetro de parede com porta em (25,12);
// interior 5×5 com tapete roxo.
const (
	roomX0, roomY0 = 22, 12
	roomX1, roomY1 = 28, 18
	doorX          = 25
)

// Palco (spotlight): tapete vermelho 4×2 no topo, com 2 tiles spotlight.
const (
	stageX0, stageY0 = 13, 2
	stageX1, stageY1 = 16, 3
)

// Portais: pisar em `pad` teleporta para `target` (que nunca é outro
// portal, senão haveria loop).
var portals = []struct{ padX, padY, targetX, targetY int }{
	{2, 2, 26, 2},
	{27, 2, 3, 2},
}

// Objetos interativos: sobreposições na parede de cima (y=0, já bloqueada)
// e um pôster na parede da sala. O jogador interage de um tile adjacente.
type interactable struct {
	x, y, w        int
	tiles          []string
	id, typ, title string
	url, text      string
	rng            int
}

var interactables = []interactable{
	{x: 8, y: 0, w: 2, tiles: []string{"whiteboard_l", "whiteboard_r"}, id: "quadro-branco", typ: "iframe",
		title: "Quadro branco", url: "https://excalidraw.com/", rng: 1},
	{x: 19, y: 0, w: 2, tiles: []string{"tv_l", "tv_r"}, id: "tv-lobby", typ: "video",
		title: "TV do lobby", url: "https://www.youtube.com/embed/jfKfPfyJRdk", rng: 1},
	{x: 4, y: 0, w: 1, tiles: []string{"board"}, id: "mural", typ: "note", title: "Mural de avisos",
		text: "Bem-vindo ao PixelRooms!\n\n• Ande com WASD/setas ou clique no chão.\n• Chegue perto de alguém para abrir vídeo e áudio.\n• A sala roxa à direita é uma área privada.\n• Suba no palco vermelho para falar com o mapa inteiro.\n• Aperte X perto de objetos para interagir, 1–6 para emotes e ? para os atalhos.", rng: 1},
	{x: 24, y: 12, w: 1, tiles: []string{"poster"}, id: "poster", typ: "image", title: "Pôster",
		url: "/assets/objects/poster-pixelrooms.png", rng: 1},
	{x: 26, y: 0, w: 1, tiles: []string{"board"}, id: "link-tiled", typ: "link",
		title: "Editor de mapas (Tiled)", url: "https://www.mapeditor.org/", rng: 1},
}

type lobbyBuilder struct {
	gids                   map[string]int
	ground, objects, above []int
	solid                  []bool
}

func (b *lobbyBuilder) g(name string) int {
	gid, ok := b.gids[name]
	if !ok {
		log.Fatalf("tile desconhecido: %q", name)
	}
	return gid
}

func (b *lobbyBuilder) put(layer []int, x, y int, name string) { layer[y*lobbyW+x] = b.g(name) }

// block coloca um tile em Objects e marca colisão.
func (b *lobbyBuilder) block(x, y int, name string) {
	b.put(b.objects, x, y, name)
	b.solid[y*lobbyW+x] = true
}

// rug aplica um 9-slice de tapete no retângulo inclusivo.
func (b *lobbyBuilder) rug(name string, x0, y0, x1, y1 int) {
	for y := y0; y <= y1; y++ {
		for x := x0; x <= x1; x++ {
			part := "c"
			switch {
			case y == y0 && x == x0:
				part = "tl"
			case y == y0 && x == x1:
				part = "tr"
			case y == y1 && x == x0:
				part = "bl"
			case y == y1 && x == x1:
				part = "br"
			case y == y0:
				part = "t"
			case y == y1:
				part = "b"
			case x == x0:
				part = "l"
			case x == x1:
				part = "r"
			}
			b.put(b.ground, x, y, name+"_"+part)
		}
	}
}

func lobbyMap(gids map[string]int, tileCount int) map[string]any {
	n := lobbyW * lobbyH
	b := &lobbyBuilder{
		gids: gids, ground: make([]int, n), objects: make([]int, n), above: make([]int, n), solid: make([]bool, n),
	}

	// Pisos: madeira por padrão, pátio de grama (sudoeste), cozinha de
	// cerâmica (nordeste).
	for y := 0; y < lobbyH; y++ {
		for x := 0; x < lobbyW; x++ {
			name := "floor_wood"
			if (x*7+y*13)%5 == 0 {
				name = "floor_wood_b"
			}
			if x >= 1 && x <= 8 && y >= 13 && y <= 18 {
				name = "grass"
				if (x*5+y*3)%4 == 0 {
					name = "grass_b"
				}
			}
			if x >= 21 && x <= 28 && y >= 1 && y <= 6 {
				name = "floor_tile"
				if (x+y)%3 == 0 {
					name = "floor_tile_b"
				}
			}
			b.put(b.ground, x, y, name)
		}
	}
	b.rug("rug_teal", 12, 8, 17, 11)
	b.rug("rug_purple", roomX0+1, roomY0+1, roomX1-1, roomY1-1)
	b.rug("rug_stage", stageX0, stageY0, stageX1, stageY1)
	b.put(b.ground, 14, 2, "spotlight")
	b.put(b.ground, 15, 2, "spotlight")

	// Paredes externas: face na parede de cima, topo nas demais.
	for x := 0; x < lobbyW; x++ {
		b.block(x, 0, "wall_front")
		b.block(x, lobbyH-1, "wall_top")
	}
	for y := 1; y < lobbyH-1; y++ {
		b.block(0, y, "wall_top")
		b.block(lobbyW-1, y, "wall_top")
	}
	b.put(b.objects, 12, 0, "window")
	b.put(b.objects, 17, 0, "window")
	b.put(b.objects, 23, 0, "window")

	// Sala de reunião: face em cima (com porta), topo nos lados e embaixo.
	for x := roomX0; x <= roomX1; x++ {
		if x != doorX {
			b.block(x, roomY0, "wall_front")
		}
		b.block(x, roomY1, "wall_top")
	}
	for y := roomY0 + 1; y < roomY1; y++ {
		b.block(roomX0, y, "wall_top")
		b.block(roomX1, y, "wall_top")
	}

	// Escritório (noroeste): mesas 2×1 com cadeiras (cadeira é transitável:
	// pisar nela = sentar).
	for _, d := range [][2]int{{3, 4}, {6, 4}, {3, 8}, {6, 8}} {
		b.block(d[0], d[1], "desk_l")
		b.block(d[0]+1, d[1], "desk_r")
		b.put(b.objects, d[0], d[1]+1, "chair")
	}
	// Estante alta: base bloqueia, topo vai na camada Above (sobre a parede).
	b.block(10, 1, "bookshelf_bot")
	b.put(b.above, 10, 0, "bookshelf_top")

	// Cozinha (nordeste).
	b.block(22, 1, "cooler")
	b.block(27, 5, "boxes")
	b.block(28, 5, "boxes")
	b.block(25, 3, "table")
	b.put(b.objects, 25, 4, "chair")

	// Lounge (centro-sul) e pátio (sudoeste).
	b.block(17, 14, "couch_l")
	b.block(18, 14, "couch_r")
	b.block(17, 16, "table")
	b.block(20, 14, "plant")
	b.block(4, 15, "table")
	b.put(b.objects, 4, 16, "chair")
	for _, p := range [][2]int{{1, 1}, {12, 7}, {17, 7}, {2, 14}, {7, 17}, {28, 18}} {
		b.block(p[0], p[1], "plant")
	}

	for _, p := range portals {
		b.put(b.objects, p.padX, p.padY, "portal")
	}
	for _, it := range interactables {
		for dx, name := range it.tiles {
			b.block(it.x+dx, it.y, name)
		}
	}

	// ── Camada Effects ──
	id := 1
	var effects []map[string]any
	addRect := func(effect string, x, y, w, h int, extra ...map[string]any) {
		r := effectRect(id, effect, x, y, w, h)
		if len(extra) > 0 {
			props := r["properties"].([]map[string]any)
			r["properties"] = append(props, extra...)
		}
		effects = append(effects, r)
		id++
	}
	// Colisão: um retângulo por linha contígua de tiles sólidos.
	for y := 0; y < lobbyH; y++ {
		for x := 0; x < lobbyW; {
			if !b.solid[y*lobbyW+x] {
				x++
				continue
			}
			x0 := x
			for x < lobbyW && b.solid[y*lobbyW+x] {
				x++
			}
			addRect("impassable", x0*tile, y*tile, (x-x0)*tile, tile)
		}
	}
	addRect("private", (roomX0+1)*tile, (roomY0+1)*tile, (roomX1-roomX0-1)*tile, (roomY1-roomY0-1)*tile,
		map[string]any{"name": "areaId", "type": "string", "value": "sala-reuniao"})
	addRect("spotlight", 14*tile, 2*tile, 2*tile, tile)
	for _, p := range portals {
		addRect("portal", p.padX*tile, p.padY*tile, tile, tile,
			map[string]any{"name": "targetX", "type": "int", "value": p.targetX},
			map[string]any{"name": "targetY", "type": "int", "value": p.targetY})
	}
	addRect("spawn", 14*tile, 9*tile, 2*tile, 2*tile)

	// ── Camada Interactables (ESPECIFICACAO.md §5.6) ──
	var objs []map[string]any
	for _, it := range interactables {
		props := []map[string]any{
			{"name": "objectId", "type": "string", "value": it.id},
			{"name": "type", "type": "string", "value": it.typ},
			{"name": "title", "type": "string", "value": it.title},
			{"name": "range", "type": "int", "value": it.rng},
		}
		if it.url != "" {
			props = append(props, map[string]any{"name": "url", "type": "string", "value": it.url})
		}
		if it.text != "" {
			props = append(props, map[string]any{"name": "text", "type": "string", "value": it.text})
		}
		objs = append(objs, map[string]any{
			"id": id, "name": it.id, "x": it.x * tile, "y": it.y * tile,
			"width": it.w * tile, "height": tile,
			"rotation": 0, "visible": true, "point": false, "properties": props,
		})
		id++
	}

	rows := (tileCount + tilesetColumns - 1) / tilesetColumns
	return map[string]any{
		"type": "map", "version": "1.10", "tiledversion": "1.10.2",
		"orientation": "orthogonal", "renderorder": "right-down",
		"infinite": false, "compressionlevel": -1,
		"width": lobbyW, "height": lobbyH,
		"tilewidth": tile, "tileheight": tile,
		"nextlayerid": 7, "nextobjectid": id + 1,
		"tilesets": []map[string]any{{
			"firstgid": 1, "name": "basic",
			"image":      "../../tilesets/basic.png",
			"imagewidth": tilesetColumns * tile, "imageheight": rows * tile,
			"tilewidth": tile, "tileheight": tile,
			"tilecount": tileCount, "columns": tilesetColumns, "margin": 0, "spacing": 0,
		}},
		"layers": []map[string]any{
			tileLayer(1, "Ground", b.ground),
			tileLayer(2, "Objects", b.objects),
			tileLayer(3, "Above", b.above),
			{
				"id": 4, "name": "Effects", "type": "objectgroup",
				"visible": true, "opacity": 1, "x": 0, "y": 0,
				"draworder": "topdown", "objects": effects,
			},
			{
				"id": 5, "name": "Interactables", "type": "objectgroup",
				"visible": true, "opacity": 1, "x": 0, "y": 0,
				"draworder": "topdown", "objects": objs,
			},
		},
	}
}

func tileLayer(id int, name string, data []int) map[string]any {
	return map[string]any{
		"id": id, "name": name, "type": "tilelayer",
		"width": lobbyW, "height": lobbyH,
		"visible": true, "opacity": 1, "x": 0, "y": 0,
		"data": data,
	}
}

func effectRect(id int, effect string, x, y, w, h int) map[string]any {
	return map[string]any{
		"id": id, "name": effect, "x": x, "y": y, "width": w, "height": h,
		"rotation": 0, "visible": true, "point": false,
		"properties": []map[string]any{{"name": "effect", "type": "string", "value": effect}},
	}
}

// ── Helpers ──────────────────────────────────────────────────────

func hexColor(c color.RGBA) string {
	const hx = "0123456789abcdef"
	b := []byte{'#', hx[c.R>>4], hx[c.R&15], hx[c.G>>4], hx[c.G&15], hx[c.B>>4], hx[c.B&15]}
	return string(b)
}

func fillRect(img *image.RGBA, x, y, w, h int, c color.RGBA) {
	for dy := 0; dy < h; dy++ {
		for dx := 0; dx < w; dx++ {
			img.SetRGBA(x+dx, y+dy, c)
		}
	}
}

func writePNG(path string, img image.Image) {
	mustMkdir(path)
	f, err := os.Create(path)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		log.Fatal(err)
	}
}

func writeJSON(path string, v any) {
	mustMkdir(path)
	b, err := json.MarshalIndent(v, "", " ")
	if err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(path, b, 0o644); err != nil {
		log.Fatal(err)
	}
}

func mustMkdir(path string) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		log.Fatal(err)
	}
}
