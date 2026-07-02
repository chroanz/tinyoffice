// genassets gera os assets placeholder da Fase 1 (CC0): tileset básico,
// spritesheet de avatar (grade da ESPECIFICACAO.md §5.2) e o mapa template
// "lobby" no formato Tiled (.tmj, convenções da §5.6).
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

	writePNG(filepath.Join(*out, "tilesets", "basic.png"), tileset())
	writePNG(filepath.Join(*out, "avatars", "body", "placeholder.png"), avatarSheet())
	writeJSON(filepath.Join(*out, "maps", "templates", "lobby.tmj"), lobbyMap())
	log.Println("assets gerados em", *out)
}

// ── Tileset ──────────────────────────────────────────────────────
// 5 tiles de 32×32 (gids 1..5): piso A, piso B, parede, caixote, tapete.

func tileset() *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, 5*tile, tile))

	floorA := rgb(0xd4, 0xb4, 0x8c)
	floorB := rgb(0xcb, 0xaa, 0x82)
	fillTile(img, 0, floorA)
	speckle(img, 0, rgb(0xc6, 0xa5, 0x7c))
	fillTile(img, 1, floorB)
	speckle(img, 1, rgb(0xbd, 0x9c, 0x73))

	// Parede: corpo escuro com topo iluminado e base sombreada.
	fillTile(img, 2, rgb(0x6b, 0x5d, 0x4f))
	hband(img, 2, 0, 6, rgb(0x8a, 0x7a, 0x68))
	hband(img, 2, 28, 4, rgb(0x4e, 0x44, 0x3a))

	// Caixote: madeira com borda e travessas.
	fillTile(img, 3, rgb(0xa9, 0x74, 0x3e))
	border(img, 3, 2, rgb(0x7c, 0x54, 0x26))
	hband(img, 3, 15, 2, rgb(0x7c, 0x54, 0x26))
	vband(img, 3, 15, 2, rgb(0x7c, 0x54, 0x26))

	// Tapete.
	fillTile(img, 4, rgb(0x4e, 0x8f, 0x8b))
	border(img, 4, 2, rgb(0x3d, 0x72, 0x6f))

	return img
}

// ── Avatar ───────────────────────────────────────────────────────
// Sheet 192×320: frames 32×64, colunas [idle1 idle2 walk1..4],
// linhas [down up left right sit]. Linha sit fica vazia na Fase 1.

func avatarSheet() *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, 6*32, 5*64))
	dirs := []string{"down", "up", "left", "right"}
	for row, dir := range dirs {
		for col := 0; col < 6; col++ {
			drawAvatarFrame(img, col*32, row*64, dir, col)
		}
	}
	return img
}

var (
	skin  = rgb(0xed, 0xbd, 0x94)
	hair  = rgb(0x5a, 0x3b, 0x28)
	shirt = rgb(0x4f, 0x86, 0xc6)
	pants = rgb(0x3f, 0x4a, 0x5a)
	shoes = rgb(0x2b, 0x32, 0x40)
	eyes  = rgb(0x2b, 0x2b, 0x33)
)

// drawAvatarFrame desenha um frame na posição (ox, oy) do sheet.
// col: 0-1 idle, 2-5 ciclo de caminhada (esq, neutro, dir, neutro).
func drawAvatarFrame(img *image.RGBA, ox, oy int, dir string, col int) {
	r := func(x, y, w, h int, c color.RGBA) { fillRect(img, ox+x, oy+y, w, h, c) }

	// Pernas: no ciclo de caminhada uma perna encolhe 3px alternadamente.
	leftLift, rightLift := 0, 0
	switch col {
	case 2:
		leftLift = 3
	case 4:
		rightLift = 3
	}
	r(10, 48+leftLift, 5, 10-leftLift, pants)
	r(17, 48+rightLift, 5, 10-rightLift, pants)
	r(10, 56+leftLift/2, 5, 2, shoes)
	r(17, 56+rightLift/2, 5, 2, shoes)

	// Torso e braços.
	r(9, 36, 14, 13, shirt)
	r(7, 38, 2, 8, shirt)
	r(23, 38, 2, 8, shirt)
	r(7, 44, 2, 3, skin)
	r(23, 44, 2, 3, skin)

	// Cabeça.
	r(9, 22, 14, 15, skin)

	switch dir {
	case "up":
		// De costas: cabelo cobre a cabeça inteira.
		r(9, 20, 14, 13, hair)
	case "down":
		r(9, 20, 14, 7, hair)
		r(8, 22, 2, 6, hair)
		r(22, 22, 2, 6, hair)
		blinkEyes(r, col, 12, 18)
	case "left":
		r(9, 20, 14, 7, hair)
		r(21, 22, 3, 9, hair) // nuca à direita do frame
		blinkEyes(r, col, 10, -1)
	case "right":
		r(9, 20, 14, 7, hair)
		r(8, 22, 3, 9, hair)
		blinkEyes(r, col, 20, -1)
	}
}

// blinkEyes desenha os olhos; no frame idle2 (col 1) eles piscam.
// x2 < 0 desenha um único olho (perfil).
func blinkEyes(r func(x, y, w, h int, c color.RGBA), col, x1, x2 int) {
	h := 2
	if col == 1 {
		h = 1
	}
	r(x1, 29, 2, h, eyes)
	if x2 >= 0 {
		r(x2, 29, 2, h, eyes)
	}
}

// ── Mapa lobby ───────────────────────────────────────────────────

const (
	lobbyW = 30
	lobbyH = 20
)

// gids do tileset "basic" (firstgid = 1)
const (
	gFloorA = 1
	gFloorB = 2
	gWall   = 3
	gCrate  = 4
	gRug    = 5
)

var crates = [][2]int{
	{6, 6}, {7, 6}, {6, 7},
	{22, 5}, {23, 5},
	{10, 14}, {11, 14},
	{21, 14}, {22, 14},
}

func lobbyMap() map[string]any {
	ground := make([]int, lobbyW*lobbyH)
	objects := make([]int, lobbyW*lobbyH)
	above := make([]int, lobbyW*lobbyH)

	for y := 0; y < lobbyH; y++ {
		for x := 0; x < lobbyW; x++ {
			i := y*lobbyW + x
			if (x+y)%2 == 0 {
				ground[i] = gFloorA
			} else {
				ground[i] = gFloorB
			}
			if x >= 12 && x <= 17 && y >= 8 && y <= 11 {
				ground[i] = gRug
			}
			if x == 0 || x == lobbyW-1 || y == 0 || y == lobbyH-1 {
				objects[i] = gWall
			}
		}
	}
	for _, c := range crates {
		objects[c[1]*lobbyW+c[0]] = gCrate
	}

	// Efeitos: colisão da borda, dos caixotes e spawn 2×2 no tapete.
	effects := []map[string]any{
		effectRect(1, "impassable", 0, 0, lobbyW*tile, tile),
		effectRect(2, "impassable", 0, (lobbyH-1)*tile, lobbyW*tile, tile),
		effectRect(3, "impassable", 0, tile, tile, (lobbyH-2)*tile),
		effectRect(4, "impassable", (lobbyW-1)*tile, tile, tile, (lobbyH-2)*tile),
	}
	id := 5
	for _, c := range crates {
		effects = append(effects, effectRect(id, "impassable", c[0]*tile, c[1]*tile, tile, tile))
		id++
	}
	effects = append(effects, effectRect(id, "spawn", 14*tile, 9*tile, 2*tile, 2*tile))

	return map[string]any{
		"type": "map", "version": "1.10", "tiledversion": "1.10.2",
		"orientation": "orthogonal", "renderorder": "right-down",
		"infinite": false, "compressionlevel": -1,
		"width": lobbyW, "height": lobbyH,
		"tilewidth": tile, "tileheight": tile,
		"nextlayerid": 6, "nextobjectid": id + 1,
		"tilesets": []map[string]any{{
			"firstgid": 1, "name": "basic",
			"image":      "../../tilesets/basic.png",
			"imagewidth": 5 * tile, "imageheight": tile,
			"tilewidth": tile, "tileheight": tile,
			"tilecount": 5, "columns": 5, "margin": 0, "spacing": 0,
		}},
		"layers": []map[string]any{
			tileLayer(1, "Ground", ground),
			tileLayer(2, "Objects", objects),
			tileLayer(3, "Above", above),
			{
				"id": 4, "name": "Effects", "type": "objectgroup",
				"visible": true, "opacity": 1, "x": 0, "y": 0,
				"draworder": "topdown", "objects": effects,
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

// ── Helpers de desenho ───────────────────────────────────────────

func rgb(r, g, b uint8) color.RGBA { return color.RGBA{r, g, b, 0xff} }

func fillRect(img *image.RGBA, x, y, w, h int, c color.RGBA) {
	for dy := 0; dy < h; dy++ {
		for dx := 0; dx < w; dx++ {
			img.SetRGBA(x+dx, y+dy, c)
		}
	}
}

func fillTile(img *image.RGBA, idx int, c color.RGBA)     { fillRect(img, idx*tile, 0, tile, tile, c) }
func hband(img *image.RGBA, idx, y, h int, c color.RGBA)  { fillRect(img, idx*tile, y, tile, h, c) }
func vband(img *image.RGBA, idx, x, w int, c color.RGBA)  { fillRect(img, idx*tile+x, 0, w, tile, c) }

func border(img *image.RGBA, idx, w int, c color.RGBA) {
	hband(img, idx, 0, w, c)
	hband(img, idx, tile-w, w, c)
	vband(img, idx, 0, w, c)
	vband(img, idx, tile-w, w, c)
}

// speckle adiciona pontos determinísticos para dar textura ao piso.
func speckle(img *image.RGBA, idx int, c color.RGBA) {
	for y := 0; y < tile; y++ {
		for x := 0; x < tile; x++ {
			if (x*31+y*17+idx*7)%23 == 0 {
				img.SetRGBA(idx*tile+x, y, c)
			}
		}
	}
}

// ── IO ───────────────────────────────────────────────────────────

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
