package main

import (
	"image"
	"math"
	"path/filepath"
	"strings"
)

// ── Exterior animado (fora das paredes do mapa) ───────────────────
// O escritório fica num jardim: gramado, anel de árvores que balançam,
// flores e borboletas. A animação é feita no cliente (tweens/frames);
// aqui só saem as texturas, no mesmo estilo dos tiles (16 px de arte,
// ampliados 2×, contorno tingido, luz de cima-esquerda).
//
//   world/meadow.png     — 64×64 de arte (128×128): grama sem emenda
//   world/tree.png       — 2 variações de árvore, 28×32 de arte cada
//   world/flowers.png    — 4 frames 6×8 (2 cores × 2 posições de vento)
//   world/butterfly.png  — 4 frames 7×5 (2 cores × asa aberta/fechada)

func writeWorld(out string) {
	writePNG(filepath.Join(out, "world", "meadow.png"), meadow())
	trees := image.NewRGBA(image.Rect(0, 0, 2*28*2, 32*2))
	blit(trees, tree(1), 0, 0, 2, nil)
	blit(trees, tree(2), 28*2, 0, 2, nil)
	writePNG(filepath.Join(out, "world", "tree.png"), trees)

	fl := image.NewRGBA(image.Rect(0, 0, 4*6*2, 8*2))
	for i, f := range flowerFrames() {
		blit(fl, f, i*6*2, 0, 2, nil)
	}
	writePNG(filepath.Join(out, "world", "flowers.png"), fl)

	bf := image.NewRGBA(image.Rect(0, 0, 4*7*2, 5*2))
	for i, f := range butterflyFrames() {
		blit(bf, f, i*7*2, 0, 2, nil)
	}
	writePNG(filepath.Join(out, "world", "butterfly.png"), bf)
}

// meadow compõe grass/grass_b num arranjo 4×4 sem padrão óbvio.
func meadow() *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, 4*tile, 4*tile))
	layout := [4][4]int{{0, 1, 0, 0}, {0, 0, 0, 1}, {1, 0, 0, 0}, {0, 0, 1, 0}}
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			s := grass
			if layout[y][x] == 1 {
				s = grassB
			}
			blit(img, s, x*tile, y*tile, 2, nil)
		}
	}
	return img
}

// tree desenha uma copa arredondada com borda "fofa" (raio modulado),
// sombreada por posição (clara em cima-esquerda), tronco e sombra no chão.
func tree(seed int) sprite {
	const w, h = 28, 32
	g := make([][]rune, h)
	for y := range g {
		g[y] = []rune(strings.Repeat(".", w))
	}
	// sombra no chão
	for y := 28; y < 32; y++ {
		for x := 0; x < w; x++ {
			dx, dy := float64(x-15)/10, (float64(y)-29.5)/2.2
			if dx*dx+dy*dy <= 1 {
				g[y][x] = 'Z'
			}
		}
	}
	// tronco
	for y := 19; y < 30; y++ {
		for x := 12; x < 16; x++ {
			ch := '4'
			if x == 12 {
				ch = '3'
			}
			if x == 15 {
				ch = '5'
			}
			g[y][x] = ch
		}
	}
	// copa
	cx, cy, rx, ry := 13.5, 11.5, 12.5, 10.5
	fill := map[[2]int]bool{}
	for y := 0; y < 24; y++ {
		for x := 0; x < w; x++ {
			dx, dy := (float64(x)-cx)/rx, (float64(y)-cy)/ry
			a := math.Atan2(dy, dx)
			r := 1 - 0.07*(1+math.Sin(a*7+float64(seed)*1.7))
			d := math.Sqrt(dx*dx + dy*dy)
			if d > r {
				continue
			}
			fill[[2]int{x, y}] = true
			light := -dx*0.7 - dy*0.9 // >0 = lado iluminado
			// tufos: variação de tom em manchas
			blob := math.Sin(float64(x)*1.3+float64(seed)) * math.Cos(float64(y)*1.1)
			ch := 'F'
			switch {
			case light+blob*0.35 > 0.55:
				ch = 'f'
			case light+blob*0.35 < -0.55:
				ch = 'H'
			case light+blob*0.35 < -0.1:
				ch = 'h'
			}
			g[y][x] = ch
		}
	}
	// contorno da copa (anel 4-vizinho) e do tronco
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			if g[y][x] != '.' && g[y][x] != 'Z' {
				continue
			}
			for _, d := range n4 {
				nx, ny := x+d[0], y+d[1]
				if nx < 0 || ny < 0 || nx >= w || ny >= h {
					continue
				}
				c := g[ny][nx]
				if c != '.' && c != 'Z' && c != 'O' {
					g[y][x] = 'O'
					break
				}
			}
		}
	}
	out := make(sprite, h)
	for y := range g {
		out[y] = string(g[y])
	}
	return out
}

func flowerFrames() []sprite {
	a := lines(`
.0.0..
..L...
.0.0..
..h...
..h...
.hh...
..h...
..h...`)
	b := lines(`
..0.0.
...L..
..0.0.
..h...
..h...
.hh...
..h...
..h...`)
	recolor := func(s sprite, from, to rune) sprite {
		out := make(sprite, len(s))
		for i, row := range s {
			r := []rune(row)
			for j := range r {
				if r[j] == from {
					r[j] = to
				}
			}
			out[i] = string(r)
		}
		return out
	}
	return []sprite{a, b, recolor(a, '0', 'r'), recolor(b, '0', 'r')}
}

func butterflyFrames() []sprite {
	open := lines(`
vV.Vv
vV6Vv
.v6v.
..6..
.....`)
	closed := lines(`
.....
.V6V.
.v6v.
..6..
.....`)
	swap := func(s sprite) sprite {
		out := make(sprite, len(s))
		for i, row := range s {
			r := []rune(row)
			for j := range r {
				switch r[j] {
				case 'v':
					r[j] = 'l'
				case 'V':
					r[j] = 'L'
				}
			}
			out[i] = string(r)
		}
		return out
	}
	return []sprite{open, closed, swap(open), swap(closed)}
}
