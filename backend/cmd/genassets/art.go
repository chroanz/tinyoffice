package main

import (
	"fmt"
	"image"
	"image/color"
	"strings"
)

// ── Paleta ────────────────────────────────────────────────────────
// Rampas curtas com hue-shift (docs/art-style.md §2). Cada caractere da
// "ASCII art" dos tiles/avatares mapeia para uma cor desta legenda; '.'
// é transparente.

const outlineColor = "#2b1d14" // marrom quase preto: contorno de tudo

var legend = map[rune]color.RGBA{
	'O': hex(outlineColor),
	// madeira (claro → escuro)
	'1': hex("#f0c88a"), '2': hex("#d9a66a"), '3': hex("#b7803f"), '4': hex("#8a5a2a"), '5': hex("#5e3a1a"),
	'%': hex("#c6945a"), // junta entre tábuas (contraste baixo)
	// piso de pedra/cerâmica
	'a': hex("#f3ebd9"), 'b': hex("#e2d6bd"), 'c': hex("#c9b99a"), 'd': hex("#a08c6c"),
	// grama
	'q': hex("#a8dc7a"), 'g': hex("#7cc256"), 'G': hex("#58a03a"), 'k': hex("#3d7a2a"),
	// topo de parede
	'w': hex("#8f7a63"), 'W': hex("#6f5a46"), 'x': hex("#4f3e2f"),
	// face de parede (pintura)
	'p': hex("#f2e4cf"), 'P': hex("#e3cfb4"), 'm': hex("#c9b093"),
	// teal
	't': hex("#7fd3c6"), 'T': hex("#4fb3a5"), 'u': hex("#338a7e"), 'U': hex("#246359"),
	// roxo
	'v': hex("#c3a2e6"), 'V': hex("#9b78c9"), 'y': hex("#76539f"), 'Y': hex("#563a78"),
	// vermelho / terracota
	'r': hex("#ef8a7a"), 'R': hex("#d9574a"), 'e': hex("#a93a30"), 'E': hex("#7b2820"),
	// azul (telas, tecido)
	'i': hex("#a9e4ff"), 'B': hex("#5fb6ec"), 'n': hex("#2f7fc1"), 'N': hex("#1e4f82"), 'z': hex("#122c4d"),
	// amarelo
	'l': hex("#fff2a8"), 'L': hex("#f7d35a"), 'j': hex("#d9a52e"), 'J': hex("#a8731c"),
	// folhas
	'f': hex("#b7ec8d"), 'F': hex("#76c45a"), 'h': hex("#45953a"), 'H': hex("#2f6b2a"),
	// cinzas (branco → grafite)
	// sombra de contato no chão (semitransparente, premultiplicada)
	'Z': {18, 10, 24, 72},
	'0': hex("#f4f4f0"), '9': hex("#cfd0cc"), '8': hex("#9a9c98"), '7': hex("#666863"), '6': hex("#3b3c39"),
}

func hex(s string) color.RGBA {
	var r, g, b uint8
	if _, err := fmt.Sscanf(s, "#%02x%02x%02x", &r, &g, &b); err != nil {
		panic("cor inválida: " + s)
	}
	return color.RGBA{r, g, b, 0xff}
}

// ── Motor de ASCII art ────────────────────────────────────────────

const art = 16 // resolução de desenho: 16 px por tile, ampliado 2× (docs/art-style.md)

// sprite é um desenho de h linhas × w colunas (um caractere por pixel).
type sprite []string

func (s sprite) check(w, h int, name string, extra ...map[rune]color.RGBA) {
	if len(s) != h {
		panic(fmt.Sprintf("%s: %d linhas, esperava %d", name, len(s), h))
	}
	for i, row := range s {
		if len(row) != w {
			panic(fmt.Sprintf("%s: linha %d tem %d colunas, esperava %d: %q", name, i, len(row), w, row))
		}
		for _, ch := range row {
			if ch == '.' {
				continue
			}
			_, ok := legend[ch]
			for _, m := range extra {
				if _, k := m[ch]; k {
					ok = true
				}
			}
			if !ok {
				panic(fmt.Sprintf("%s: caractere %q sem cor na legenda", name, ch))
			}
		}
	}
}

// blit desenha s em img com origem (ox, oy), ampliando cada caractere para
// scale×scale pixels. extra sobrepõe/estende a legenda (cores variáveis).
func blit(img *image.RGBA, s sprite, ox, oy, scale int, extra map[rune]color.RGBA) {
	for y, row := range s {
		for x, ch := range row {
			if ch == '.' {
				continue
			}
			c, ok := extra[ch]
			if !ok {
				c = legend[ch]
			}
			fillRect(img, ox+x*scale, oy+y*scale, scale, scale, c)
		}
	}
}

// over compõe overlay sobre base (ambos sprites do mesmo tamanho).
func over(base, overlay sprite) sprite {
	out := make(sprite, len(base))
	for y := range base {
		row := []rune(base[y])
		for x, ch := range overlay[y] {
			if ch != '.' {
				row[x] = ch
			}
		}
		out[y] = string(row)
	}
	return out
}

// mirror espelha horizontalmente.
func mirror(s sprite) sprite {
	out := make(sprite, len(s))
	for y, row := range s {
		r := []rune(row)
		for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
			r[i], r[j] = r[j], r[i]
		}
		out[y] = string(r)
	}
	return out
}

// fill cria um sprite w×h preenchido com ch.
func fill(w, h int, ch rune) sprite {
	row := strings.Repeat(string(ch), w)
	out := make(sprite, h)
	for i := range out {
		out[i] = row
	}
	return out
}

func lines(s string) sprite {
	return sprite(strings.Split(strings.TrimSpace(s), "\n"))
}

// ── Tiles desenhados à mão (16×16) ────────────────────────────────

var floorWood = lines(`
2222222222222222
2211222222222222
2222222222222322
%%%%%%%%%%%%%%%%
2222222222222222
2222222211222222
2232222222222222
%%%%%%%%%%%%%%%%
2222222222222222
2222222222222222
2222222222322112
%%%%%%%%%%%%%%%%
2222222222222222
2222112222222222
2222222223222222
%%%%%%%%%%%%%%%%`)

var floorWoodB = lines(`
2222222222222222
2222222222221122
2222322222222222
%%%%%%%%%%%%%%%%
2222222222222222
2211222222222222
2222222222232222
%%%%%%%%%%%%%%%%
2222222222222222
2222222211222222
2222222222222222
%%%%%%%%%%%%%%%%
2222222222222222
2222222222222222
2222112222322222
%%%%%%%%%%%%%%%%`)

var grass = lines(`
gggggggggggggggg
ggggGggggggggggg
gggGgGggggggqggg
gggggggggggggggg
gggggggggggggggg
ggggggggGggggggg
gggggggGgGgggggg
gqgggggggggggggg
gggggggggggggggg
ggggggggggggGggg
gggGgggggggGgGgg
ggGgGggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggGgggggggg
ggggggGgGggggqgg`)

var grassB = lines(`
gggggggggggggggg
ggggGggggggggggg
gggGgGgggggggggg
gggggggggggggggg
gggggggggggLgggg
ggggggggggLlLggg
ggGgggggggGLGggg
gGgGgggggggkgggg
gggggggggggggggg
gggggggggggggggg
gggggGgggggggggg
ggggGgGggggggggg
gggggggggggggggg
gqgggggggggggggg
ggggggggggGggggg
gggggggggGgGgggg`)

var wallTop = lines(`
OOOOOOOOOOOOOOOO
wwwwwwwwwwwwwwww
WWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWW
WWWWxWWWWWWWWWWW
WWWWWWWWWWWxWWWW
WWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWW
WWxWWWWWWWWWWWWW
WWWWWWWWxWWWWWWW
WWWWWWWWWWWWWWWW
WWWWWWWWWWWWWxWW
WWWWWxWWWWWWWWWW
WWWWWWWWWWWWWWWW
xxxxxxxxxxxxxxxx
OOOOOOOOOOOOOOOO`)

var wallFront = lines(`
xxxxxxxxxxxxxxxx
OOOOOOOOOOOOOOOO
pppppppppppppppp
PPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPP
PPPPPPPPPPPPPPPP
mmmmmmmmmmmmmmmm
3333333333333333
4444444444444444
OOOOOOOOOOOOOOOO`)

var window = lines(`
................
................
...OOOOOOOOOO...
...OaaaaaaaaO...
...OaiiiiaiiO...
...OaiBBiaBiO...
...OaiBBiaBiO...
...OaaaaaaaaO...
...OaiBBiaBiO...
...OaiBBiaBiO...
...OaiiiiaiiO...
...OaaaaaaaaO...
...OOOOOOOOOO...
....mmmmmmmm....
................
................`)

var whiteboardL = lines(`
................
................
..OOOOOOOOOOOOOO
..O9999999999999
..O9000000000000
..O9000000000000
..O900nnnn000000
..O9000000000000
..O900RRRRRRR000
..O9000000000000
..O9000000000000
..O9999999999999
..OOOOOOOOOOOOOO
...8888888888888
................
................`)

var tvL = lines(`
................
................
..OOOOOOOOOOOOOO
..O6666666666666
..O6NNNNNNNNNNNN
..O6NnnnnnnnnnnN
..O6NniinnnnnnnN
..O6NninnnnnnnnN
..O6NnnnnnnnnnnN
..O6NNNNNNNNNNNN
..O6666666666666
..OOOOOOOOOOOOOO
................
................
................
................`)

var board = lines(`
................
................
..OOOOOOOOOOOO..
..O3333333333O..
..O3222222223O..
..O32ll220023O..
..O32ll220023O..
..O3222222223O..
..O322ii22223O..
..O322ii22l23O..
..O3222222l23O..
..O3222222223O..
..O3333333333O..
..OOOOOOOOOOOO..
................
................`)

var poster = lines(`
................
....OOOOOOOO....
....OzzzzzzO....
....OzzLLzzO....
....OzzLLzzO....
....OzzzzzzO....
....OnnnnnnO....
....ONNNNNNO....
....OhhhhhhO....
....OHHHHHHO....
....O000000O....
....O0zzz00O....
....OOOOOOOO....
................
................
................`)

// Mesa com monitor em pé (tela com brilho), base e teclado — a leitura 3/4
// dos móveis de RPG Maker: tampo claro, frente mais escura, pernas.
var deskL = lines(`
...OOOOOOO......
...OiiiBnO......
...OiBBBnO......
OOOOBBBnnOOOOOOO
O11OOOOOOO111111
O1222O7O22222222
O122OOOOO2222222
O122222222222222
O12222OOOOOOO222
O12222O90909O222
O22222OOOOOOO222
O333333333333333
O333333333333333
O444444444444444
.O4O............
.O4O............`)

var deskR = lines(`
................
................
................
OOOOOOOOOOOOOOOO
111111111111111O
222222222222222O
2222O0OO2222222O
2222O0O92222222O
2222OOO92222222O
222222222222222O
222222222222222O
333333333333333O
333333333333333O
444444444444444O
............O4O.
............O4O.`)

// Cadeira vista de costas (encosto à frente): usada nas estações de
// trabalho, onde quem senta fica de frente para o monitor.
var chairUp = lines(`
................
................
................
....OOOOOOOO....
....O111111O....
....O122221O....
....O122221O....
....O233332O....
...OOOOOOOOOO...
...O33333333O...
...O44444444O...
...OOOOOOOOOO...
...O4O....O4O...
...O4O....O4O...
...OOO....OOO...
................`)

// withShadow acrescenta a sombra de contato (estilo RPG Maker) nas duas
// últimas linhas, sob o móvel: ancora o objeto no chão.
func withShadow(s sprite) sprite {
	minX, maxX := len(s[0]), -1
	for _, row := range s[len(s)/2:] {
		for x, ch := range row {
			if ch != '.' {
				minX = min(minX, x)
				maxX = max(maxX, x)
			}
		}
	}
	if maxX < 0 {
		return s
	}
	out := append(sprite{}, s...)
	for y := len(s) - 2; y < len(s); y++ {
		r := []rune(out[y])
		x0, x1 := minX+1, min(maxX+1, len(r)-1) // leve deslocamento para a direita (luz da esquerda)
		if y == len(s)-1 {
			x0++
		}
		for x := x0; x <= x1; x++ {
			if r[x] == '.' {
				r[x] = 'Z'
			}
		}
		out[y] = string(r)
	}
	return out
}

var chair = lines(`
................
................
....OOOOOOOO....
....O333333O....
....O322223O....
....O322223O....
....O333333O....
...OOOOOOOOOO...
...O22222222O...
...O22222222O...
...O33333333O...
...OOOOOOOOOO...
...O4O....O4O...
...O4O....O4O...
...OOO....OOO...
................`)

var bookshelfTop = lines(`
................
................
..OOOOOOOOOOOO..
..O3333333333O..
..O4444444444O..
..O4RRnnLLvv4O..
..O4RRnnLLvv4O..
..O4RRnnLLvv4O..
..O4eeNNjjyy4O..
..O4444444444O..
..O3333333333O..
..O4444444444O..
..O4ttRRnn004O..
..O4ttRRnn004O..
..O4ttRRnn004O..
..O4uueeNN994O..`)

var bookshelfBot = lines(`
..O4444444444O..
..O3333333333O..
..O4444444444O..
..O4LLvvttRR4O..
..O4LLvvttRR4O..
..O4LLvvttRR4O..
..O4jjyyuuee4O..
..O4444444444O..
..O3333333333O..
..O4444444444O..
..O4444444444O..
..O3333333333O..
..O3333333333O..
..OOOOOOOOOOOO..
..O4O......O4O..
..OOO......OOO..`)

var plant = lines(`
................
......OOO.......
....OOfFfOO.....
...OfFFFFFfO....
..OfFFhFFFFfO...
..OFFhhFFFhFO...
..OFhHhFFhhFO...
..OFHHhFFhHFO...
...OhHHOOHhO....
....OOO3OOO.....
.....O333O......
....OOOOOOOO....
....OrRRRReO....
....OrRRRReO....
....OeRRRReO....
.....OOOOOO.....`)

var couchL = lines(`
................
................
................
.OOOOOOOOOOOOOOO
.OiiiiiiiiiiiiiB
.OBBBBBBBBBBBBBB
.OBBBBBBBBBBBBBB
.OnnnnnnnnnnnnnN
.OOOOOOOOOOOOOOO
.OBiiiiiiiiiiiii
.OBBBBBBBBBBBBBB
.OnBBBBBBBBBBBBB
.OnnnnnnnnnnnnnN
.OOOOOOOOOOOOOOO
..O6O...........
..OOO...........`)

var table = lines(`
................
................
................
.....OOOOOO.....
...OO111111OO...
..O1111111111O..
..O1222222221O..
..O1222222221O..
..O1222222221O..
...OO222222OO...
.....O3333O.....
.....O3333O.....
......O44O......
......O44O......
.....OO44OO.....
.....OOOOOO.....`)

var portal = lines(`
................
..OOOOOOOOOOOO..
.O666666666666O.
.O66hhhhhhhh66O.
.O6hFFFFFFFFh6O.
.O6hFffffffFh6O.
.O6hFfllllfFh6O.
.O6hFfl00lfFh6O.
.O6hFfl00lfFh6O.
.O6hFfllllfFh6O.
.O6hFffffffFh6O.
.O6hFFFFFFFFh6O.
.O66hhhhhhhh66O.
.O666666666666O.
..OOOOOOOOOOOO..
................`)

var spotlight = lines(`
RRRRRRRRRRRRRRRR
RRRReeeeeeeeRRRR
RReeJJJJJJJJeeRR
ReJJjjjjjjjjJJeR
ReJjLLLLLLLLjJeR
ReJjLllllllLjJeR
ReJjLl0000lLjJeR
ReJjLl0000lLjJeR
ReJjLl0000lLjJeR
ReJjLl0000lLjJeR
ReJjLllllllLjJeR
ReJjLLLLLLLLjJeR
ReJJjjjjjjjjJJeR
RReeJJJJJJJJeeRR
RRRReeeeeeeeRRRR
RRRRRRRRRRRRRRRR`)

var boxes = lines(`
................
................
....OOOOOOOO....
....O111111O....
....O2llll2O....
....O222222O....
....O333333O....
..OOOOOOOOOOOO..
..O1111111111O..
..O22llllll22O..
..O2222222222O..
..O2222222222O..
..O3333333333O..
..O3333333333O..
..OOOOOOOOOOOO..
................`)

var cooler = lines(`
................
.....OOOOOO.....
....OOiiiiOO....
....OiBBBBiO....
....OiBBBBiO....
....OiBBBBiO....
....OnnnnnnO....
....OOOOOOOO....
....O009999O....
....O009999O....
....O0R9i99O....
....O009999O....
....O888888O....
....O888888O....
....O777777O....
....OOOOOOOO....`)

// floorTiles gera o piso cerâmico 8×8 (brilho em cima/esquerda, rejunte
// em baixo/direita); variant>0 escurece uma peça para quebrar a repetição.
func floorTiles(variant int) sprite {
	out := make([]string, art)
	for y := 0; y < art; y++ {
		row := make([]rune, art)
		for x := 0; x < art; x++ {
			cx, cy := x%8, y%8
			switch {
			case cx == 7 || cy == 7:
				row[x] = 'c'
			case cx == 0 || cy == 0:
				row[x] = 'a'
			default:
				row[x] = 'b'
			}
			if variant == 1 && x >= 8 && y < 7 && cx > 0 && cx < 7 && cy > 0 {
				row[x] = 'c'
			}
		}
		out[y] = string(row)
	}
	return out
}

// rugSlice gera uma peça do 9-slice de tapete. ramp = [brilho, base,
// sombra, escuro]; trim (opcional) é a cor do friso interno (palco).
// left/right/top/bottom indicam quais lados são bordas externas.
func rugSlice(ramp [4]rune, trim rune, left, right, top, bottom bool) sprite {
	hi, base, shade, dark := ramp[0], ramp[1], ramp[2], ramp[3]
	out := make([]string, art)
	for y := 0; y < art; y++ {
		row := make([]rune, art)
		for x := 0; x < art; x++ {
			// distância até a borda externa mais próxima (∞ se o lado não é borda)
			d := art
			if left {
				d = min(d, x)
			}
			if right {
				d = min(d, art-1-x)
			}
			if top {
				d = min(d, y)
			}
			if bottom {
				d = min(d, art-1-y)
			}
			switch {
			case d == 0:
				row[x] = dark
			case d == 1:
				row[x] = shade
			case d == 2 && trim != 0:
				row[x] = trim
			case d == 2:
				row[x] = hi
			default:
				// padrão discreto em treliça
				if (x+y)%8 == 0 && (x-y+art)%8 == 0 {
					row[x] = hi
				} else {
					row[x] = base
				}
			}
		}
		out[y] = string(row)
	}
	return out
}

// rugSet devolve as 9 peças (tl,t,tr,l,c,r,bl,b,br) de um tapete.
func rugSet(ramp [4]rune, trim rune) map[string]sprite {
	return map[string]sprite{
		"tl": rugSlice(ramp, trim, true, false, true, false),
		"t":  rugSlice(ramp, trim, false, false, true, false),
		"tr": rugSlice(ramp, trim, false, true, true, false),
		"l":  rugSlice(ramp, trim, true, false, false, false),
		"c":  rugSlice(ramp, trim, false, false, false, false),
		"r":  rugSlice(ramp, trim, false, true, false, false),
		"bl": rugSlice(ramp, trim, true, false, false, true),
		"b":  rugSlice(ramp, trim, false, false, false, true),
		"br": rugSlice(ramp, trim, false, true, false, true),
	}
}

// ── Catálogo do tileset ───────────────────────────────────────────

type tileDef struct {
	name string
	art  sprite
}

// tileCatalog devolve todos os tiles na ordem do tileset (gid = índice+1).
func tileCatalog() []tileDef {
	tiles := []tileDef{
		{"floor_wood", floorWood},
		{"floor_wood_b", floorWoodB},
		{"floor_tile", floorTiles(0)},
		{"floor_tile_b", floorTiles(1)},
		{"grass", grass},
		{"grass_b", grassB},
		{"wall_top", wallTop},
		{"wall_front", wallFront},
		{"window", over(wallFront, window)},
		{"whiteboard_l", over(wallFront, whiteboardL)},
		{"whiteboard_r", over(wallFront, mirror(whiteboardL))},
		{"tv_l", over(wallFront, tvL)},
		{"tv_r", over(wallFront, mirror(tvL))},
		{"board", over(wallFront, board)},
		{"poster", over(wallFront, poster)},
		{"desk_l", withShadow(deskL)},
		{"desk_r", withShadow(deskR)},
		{"chair", withShadow(chair)},
		{"chair_up", withShadow(chairUp)},
		{"bookshelf_top", bookshelfTop},
		{"bookshelf_bot", withShadow(bookshelfBot)},
		{"plant", withShadow(plant)},
		{"couch_l", withShadow(couchL)},
		{"couch_r", withShadow(mirror(couchL))},
		{"table", withShadow(table)},
		{"portal", portal},
		{"spotlight", spotlight},
		{"boxes", withShadow(boxes)},
		{"cooler", withShadow(cooler)},
	}
	rugs := []struct {
		name string
		ramp [4]rune
		trim rune
	}{
		{"rug_teal", [4]rune{'t', 'T', 'u', 'U'}, 0},
		{"rug_purple", [4]rune{'v', 'V', 'y', 'Y'}, 0},
		{"rug_stage", [4]rune{'r', 'R', 'e', 'E'}, 'L'},
	}
	for _, r := range rugs {
		set := rugSet(r.ramp, r.trim)
		for _, part := range []string{"tl", "t", "tr", "l", "c", "r", "bl", "b", "br"} {
			tiles = append(tiles, tileDef{r.name + "_" + part, set[part]})
		}
	}
	for _, t := range tiles {
		t.art.check(art, art, t.name)
	}
	return tiles
}

const tilesetColumns = 16

// renderTileset desenha o catálogo em uma imagem com tilesetColumns colunas
// e devolve também o mapa nome → gid.
func renderTileset(tiles []tileDef) (*image.RGBA, map[string]int) {
	rows := (len(tiles) + tilesetColumns - 1) / tilesetColumns
	img := image.NewRGBA(image.Rect(0, 0, tilesetColumns*tile, rows*tile))
	gids := make(map[string]int, len(tiles))
	for i, t := range tiles {
		blit(img, t.art, (i%tilesetColumns)*tile, (i/tilesetColumns)*tile, 2, nil)
		gids[t.name] = i + 1
	}
	return img, gids
}
