package main

import (
	"image"
	"path/filepath"
)

// ── Emotes em pixel art ────────────────────────────────────────────
// Substituem os emojis do sistema (que destoam da arte e mudam de visual
// em cada SO). Saídas:
//   ui/emotes.png        — ícones 12×12 (→ 24×24), um por coluna, p/ a UI
//   ui/emote-bubbles.png — balão 16×18 (→ 32×36) com o ícone, p/ o mundo
// Ordem = constants.ts (teclas 1–6): wave, heart, party, thumbsup, question, laugh.

var emoteOrder = []string{"wave", "heart", "party", "thumbsup", "question", "laugh"}

// Ícones: até 10×10 de preenchimento; o contorno é automático.
var emoteIcons = map[string]sprite{
	"wave": lines(`
..L.L.L...
..L.L.L.L.
..L.L.L.L.
..LLLLLLL.
L.LLLLLLL.
LLLLLLLLj.
.LLLLLLLj.
..LLLLLj..
...LLLjj..
....jjj...`),
	"heart": lines(`
..........
.RRR..RRR.
RrrRRRRRRR
RrRRRRRRRR
RRRRRRRRRe
.RRRRRRRe.
..RRRRRe..
...RRRe...
....Re....
..........`),
	"party": lines(`
l...R...n.
..n...l...
.....R..R.
R..LLj..l.
..LLjj....
.LLljJ..n.
LLljJ.....
LljJ...R..
ljJ.......
jJ........`),
	"thumbsup": lines(`
....LL....
....LL....
...LLL....
...LL.....
nnLLLLLLL.
nnLLLLLLj.
nnLLLLLLj.
nnLLLLLjj.
nnLLLLLj..
..........`),
	"question": lines(`
..VVVVV...
.VVvvVVV..
.VV...VVy.
......VVy.
....VVVy..
....VVy...
....yy....
..........
....VV....
....Vy....`),
	"laugh": lines(`
..LLLLLL..
.LLLLLLLL.
LL6LLLL6LL
L6L6LL6L6L
LLLLLLLLLj
L66666666j
LL6RRRR6jj
.LL6666jj.
..jjjjjj..
..........`),
}

var bubble = lines(`
..OOOOOOOOOOOO..
.O000000000000O.
O00000000000000O
O00000000000000O
O00000000000000O
O00000000000000O
O00000000000000O
O00000000000000O
O00000000000000O
O00000000000000O
O00000000000000O
O00000000000009O
.O999999999999O.
..OOOOO09OOOOO..
.......O9O......
.......OO.......
................
................`)

// iconCanvas devolve o ícone 12×12 com contorno 'O' (anel 4-vizinho).
func iconCanvas(s sprite) sprite {
	const n = 12
	g := make([][]rune, n)
	for y := range g {
		g[y] = []rune("............")
	}
	filled := func(y, x int) bool {
		y, x = y-1, x-1
		return y >= 0 && x >= 0 && y < len(s) && x < len(s[y]) && s[y][x] != '.'
	}
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			if filled(y, x) {
				g[y][x] = rune(s[y-1][x-1])
				continue
			}
			if filled(y-1, x) || filled(y+1, x) || filled(y, x-1) || filled(y, x+1) {
				g[y][x] = 'O'
			}
		}
	}
	out := make(sprite, n)
	for i, r := range g {
		out[i] = string(r)
	}
	return out
}

func writeEmotes(out string) {
	icons := image.NewRGBA(image.Rect(0, 0, len(emoteOrder)*24, 24))
	bubbles := image.NewRGBA(image.Rect(0, 0, len(emoteOrder)*32, 36))
	for i, id := range emoteOrder {
		ic := iconCanvas(emoteIcons[id])
		ic.check(12, 12, "emote "+id)
		blit(icons, ic, i*24, 0, 2, nil)
		bubble.check(16, 18, "bubble")
		blit(bubbles, bubble, i*32, 0, 2, nil)
		blit(bubbles, ic, i*32+4, 2, 2, nil)
	}
	writePNG(filepath.Join(out, "ui", "emotes.png"), icons)
	writePNG(filepath.Join(out, "ui", "emote-bubbles.png"), bubbles)
}
