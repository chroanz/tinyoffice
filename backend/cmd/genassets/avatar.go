package main

import (
	"fmt"
	"go/format"
	"image"
	"image/color"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// ── Avatar paper-doll (16×32 → 32×64) ──────────────────────────────
//
// O avatar é montado a partir de PARTES (cabeça, tronco, braços, pernas,
// mangas, cabelo…) posicionadas por frame. Cada parte ganha contorno
// automático (anel 4-vizinho, cor tingida da própria camada), e as partes
// são compostas por profundidade (z). Assim a animação vira geometria:
// a caminhada tem balanço vertical (bob), braços que balançam opostos às
// pernas e passada de verdade na vista lateral — sem redesenhar cada frame.
//
// Camadas (todas na mesma grade, compostas nesta ordem no cliente):
//   body   — pele: cabeça, rosto, braços, pernas
//   bottom — calça / short / saia + sapatos
//   top    — camiseta / regata / moletom / jaqueta / vestido
//   hair   — 8 estilos (ou nenhum)
//
// Como as camadas são PNGs separados, uma peça de roupa precisa "saber"
// quando uma parte do corpo passa na frente dela (ex.: a mão do braço da
// frente cruzando a camiseta na vista lateral). Para isso, ao desenhar uma
// camada, as partes do corpo com z maior recortam a peça (oclusão). A
// geometria do corpo é a mesma para todos os tons de pele, então o recorte
// é exato para qualquer combinação.
//
// Sheet: 6 colunas × 4 linhas de frames 32×64.
//   colunas: 0 parado, 1 piscando, 2 passo A, 3 meio A, 4 passo B, 5 meio B
//   linhas:  down, up, left, right (left = espelho de right)

const (
	frameW     = 32 // frame 32×32 de arte, como os personagens de B/W (tile 16×16)
	figureX    = 8  // a figura é desenhada numa faixa de 16 px centralizada no frame
	frameH     = 32
	sheetCols  = 6
	sheetRows  = 4
	avatarAuth = "PixelRooms (gerado por cmd/genassets)"
)

var sheetDirs = []string{"down", "up", "left", "right"}

// Profundidades globais (iguais em todas as camadas, para a oclusão).
const (
	zHairBack  = 5
	zFarArm    = 10
	zFarSleeve = 11
	zFarLeg    = 18
	zFarPants  = 19
	zLegs      = 20
	zPants     = 21
	zSkirt     = 23
	zTorso     = 30
	zShirt     = 31
	zHead      = 40
	zArm       = 50
	zSleeve    = 51
	zHair      = 60
	zHat       = 70
	zBagBack   = 25 // mochila de lado: atrás do tronco (o corpo recorta)
	zStrap     = 35 // alças sobre a camiseta, sob os braços
	zBagFront  = 55 // bolsa no quadril, na frente do braço / mochila de costas
)

// part é um conjunto de pixels (caractere de material) em coordenadas do
// frame. group: partes do mesmo grupo não desenham contorno umas sobre as
// outras (ex.: quadril + duas pernas formam uma silhueta só).
type part struct {
	px    map[[2]int]rune // (x,y) → material
	z     int
	group string
}

func newPart(z int, group string) part { return part{px: map[[2]int]rune{}, z: z, group: group} }

// fromSprite cria uma parte a partir de ASCII ('.' = vazio) com origem (x,y).
func fromSprite(s sprite, x, y, z int, group string) part {
	p := newPart(z, group)
	for r, row := range s {
		for c, ch := range []rune(row) {
			if ch != '.' {
				p.px[[2]int{x + c, y + r}] = ch
			}
		}
	}
	return p
}

// recolor troca materiais (ex.: base → sombra para membros do lado de lá).
func (p part) recolor(m map[rune]rune) part {
	q := newPart(p.z, p.group)
	for k, ch := range p.px {
		if n, ok := m[ch]; ok {
			ch = n
		}
		q.px[k] = ch
	}
	return q
}

// shift desloca a parte.
func (p part) shift(dx, dy int) part {
	q := newPart(p.z, p.group)
	for k, ch := range p.px {
		q.px[[2]int{k[0] + dx, k[1] + dy}] = ch
	}
	return q
}

var n4 = [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}}

// outline devolve o anel 4-vizinho da parte que não pertence a fill.
func (p part) outline(skip map[[2]int]bool) map[[2]int]bool {
	out := map[[2]int]bool{}
	for k := range p.px {
		for _, d := range n4 {
			q := [2]int{k[0] + d[0], k[1] + d[1]}
			if _, in := p.px[q]; in || skip[q] {
				continue
			}
			out[q] = true
		}
	}
	return out
}

// footprint = preenchimento + contorno.
func (p part) footprint() map[[2]int]bool {
	f := p.outline(nil)
	for k := range p.px {
		f[k] = true
	}
	return f
}

type canvas [frameH][frameW]rune

func blankCanvas() canvas {
	var c canvas
	for y := range c {
		for x := range c[y] {
			c[y][x] = '.'
		}
	}
	return c
}

// compose desenha as partes de UMA camada. occluders são as partes do corpo
// do mesmo frame: uma parte com z menor que um occluder é recortada por ele.
//
// Contorno seletivo (técnica de Pokémon GBA / RPG Maker): o anel de uma
// parte só é escuro ('X') na borda da silhueta; onde ele cai DENTRO do
// boneco (sobre outra parte do corpo — silhouette — ou sobre algo já
// desenhado nesta camada) vira uma costura suave ('x', sombra escura do
// próprio material). Assim manga, braço, franja e barra não parecem
// "armadura" com linhas pretas por dentro.
func compose(parts []part, occluders []part, silhouette map[[2]int]bool) canvas {
	c := blankCanvas()
	sort.SliceStable(parts, func(i, j int) bool { return parts[i].z < parts[j].z })
	groupFill := map[string]map[[2]int]bool{}
	for _, p := range parts {
		if p.group == "" {
			continue
		}
		if groupFill[p.group] == nil {
			groupFill[p.group] = map[[2]int]bool{}
		}
		for k := range p.px {
			groupFill[p.group][k] = true
		}
	}
	for _, p := range parts {
		blocked := map[[2]int]bool{}
		for _, o := range occluders {
			if o.z > p.z {
				for k := range o.footprint() {
					blocked[k] = true
				}
			}
		}
		var skip map[[2]int]bool
		if p.group != "" {
			skip = groupFill[p.group]
		}
		set := func(k [2]int, ch rune) {
			x, y := k[0], k[1]
			if x < 0 || y < 0 || x >= frameW || y >= frameH || blocked[k] {
				return
			}
			c[y][x] = ch
		}
		for k := range p.outline(skip) {
			x, y := k[0], k[1]
			inner := silhouette[k] || (x >= 0 && y >= 0 && x < frameW && y < frameH && c[y][x] != '.')
			if inner {
				set(k, 'x')
			} else {
				set(k, 'X')
			}
		}
		for k, ch := range p.px {
			set(k, ch)
		}
	}
	return c
}

func (c canvas) mirror() canvas {
	var m canvas
	for y := range c {
		for x := range c[y] {
			m[y][frameW-1-x] = c[y][x]
		}
	}
	return m
}

// ── Pose de cada coluna do sheet ───────────────────────────────────

type pose struct {
	bob   int  // deslocamento vertical do tronco/cabeça (−1 = sobe)
	blink bool // olhos fechados
	// vista frontal/costas
	liftL, liftR int // pé erguido (linhas)
	armL, armR   int // deslocamento vertical do braço
	// vista lateral: passada
	side sideStride
}

type sideStride int

const (
	strideIdle     sideStride = iota
	strideNearFwd             // perna de cá à frente, braço de cá atrás
	strideNearPass            // perna de cá apoiada, de lá erguida
	strideFarFwd              // perna de lá à frente, braço de cá à frente
	strideFarPass             // perna de lá apoiada, de cá erguida
)

// Ciclo de 4 frames: contato (base) → passagem (corpo sobe 1 px) →
// contato oposto → passagem. Os braços balançam opostos às pernas.
var poses = [sheetCols]pose{
	{},
	{blink: true},
	{liftR: 1, armL: 1, armR: -1, side: strideNearFwd},
	{bob: -1, side: strideNearPass},
	{liftL: 1, armL: -1, armR: 1, side: strideFarFwd},
	{bob: -1, side: strideFarPass},
}

// ── Corpo (camada body) ────────────────────────────────────────────
// Materiais: S pele, s sombra, e olho, m bochecha.

var headDown = lines(`
..SSSSSS..
.SSSSSSSS.
SSSSSSSSSS
SSSSSSSSSS
SSSSSSSSSS
SSweSSewSS
SSSeSSeSSS
SmSSSSSSmS
.sSSSSSSs.
..ssssss..`)

var headUp = lines(`
..SSSSSS..
.SSSSSSSS.
SSSSSSSSSS
SSSSSSSSSS
SSSSSSSSSS
SSSSSSSSSS
SSSSSSSSSS
sSSSSSSSSs
.sSSSSSSs.
..ssssss..`)

var headSide = lines(`
..SSSSSS..
.SSSSSSSS.
SSSSSSSSSS
SSSSSSSSSS
SSSSSSSSSS
SSSsSSSweS
SSSsSSSSeS
sSSSSSSSmS
.sSSSSSSSS
..sssssss.`)

var torsoFront = lines(`
.SSSS.
SSSSSS
SSSSSS
sSSSSs
ssssss`)

var torsoSide = lines(`
.SSS.
SSSSS
SSSSS
SSSSs
sssss`)

// Braço de frente/costas, pendurado POR FORA do tronco: encosta no ombro
// e abre levemente para baixo (silhueta em "A"), com a mão na altura do
// quadril — como nos sprites de RPG de GBA. O direito é o espelho.
var armFrontL = lines(`
.S
SS
SS
SS
ss`)

var armFrontR = mirror(armFrontL)

var armSideNeutral = lines(`
SS
SS
SS
SS
ss`)

var armSideFwd = lines(`
SS.
SSS
.SS
.SS
.ss`)

var armSideBack = lines(`
.SS
SSS
SS.
SS.
ss.`)

// Geometria fixa (coordenadas do frame, escala 16).
const (
	headX, headY   = 3, 9 // proporção de GBA: figura compacta (~16×27), pés na base
	torsoY         = 19
	legTop         = 23 // pernas começam escondidas sob o tronco
	legLen         = 8  // 23..30; sapato na última linha
	frontLegLX     = 5  // pernas juntas e mais finas que o tronco (sem vão escuro)
	frontLegRX     = 8
	sideLegX       = 6
	hairX, hairY   = 1, 5
	frontArmLX     = 3 // braços ao lado do tronco (5..10), sem cobri-lo
	frontArmRX     = 11
	sideNearArmX   = 7
	frontTorsoX    = 5 // tronco 6 px (frente) / 5 px (lado): proporção chibi
	sideTorsoX     = 6
	sleeveShortLen = 2
	sleeveLongLen  = 4
)

// legSpec descreve uma perna: posição, quanto o pé sobe e o deslocamento
// horizontal por linha (passada na vista lateral).
type legSpec struct {
	x      int
	lift   int
	offs   [legLen]int
	toe    int // +1/−1: bico do sapato para o lado (vista lateral); 0 = frente
	far    bool
	z      int
	group  string
	hipped bool // inclui o quadril (só a perna principal)
}

var (
	offsZero = [legLen]int{}
	offsFwd  = [legLen]int{0, 0, 0, 1, 1, 2, 2, 2}
	offsBack = [legLen]int{0, 0, 0, -1, -1, -2, -2, -2}
	offsLift = [legLen]int{0, 0, 0, -1, -1, -1, -1, -1}
)

// legKind: o que a camada desenha na perna.
type legKind int

const (
	legSkin   legKind = iota // corpo: perna inteira de pele
	legPants                 // calça até o sapato + sapato
	legShorts                // short até o joelho + sapato
	legShoes                 // só o sapato (saia/vestido)
)

// buildLeg gera a parte de uma perna para um tipo de camada.
func buildLeg(l legSpec, kind legKind) part {
	p := newPart(l.z, l.group)
	n := legLen - l.lift
	for i := 0; i < n; i++ {
		y := legTop + i
		shoe := i >= n-2 // tênis de 2 linhas: cabedal + sola clara (estilo B/W)
		sole := i == n-1
		var ch rune
		switch {
		case shoe:
			switch {
			case kind == legSkin:
				ch = 'S'
			case sole:
				ch = 'o'
			default:
				ch = 'k'
			}
		case kind == legSkin:
			ch = 'S'
		case kind == legPants:
			ch = 'P'
		case kind == legShorts && i <= 3:
			ch = 'P'
		default:
			continue
		}
		w := 3
		x0 := l.x + l.offs[i]
		if shoe && l.toe != 0 {
			w = 4
			if l.toe < 0 {
				x0--
			}
		}
		for dx := 0; dx < w; dx++ {
			c := ch
			// luz da esquerda: coluna da direita na sombra
			if dx == w-1 && c != 'k' && c != 'o' {
				c = lower(c)
			}
			if shoe && !sole && dx == 0 && kind != legSkin {
				c = 'K' // brilho do tênis
			}
			p.px[[2]int{x0 + dx, y}] = c
		}
	}
	if l.far {
		p = p.recolor(map[rune]rune{'S': 's', 'P': 'p', 'K': 'k'})
	}
	return p
}

func lower(c rune) rune {
	switch c {
	case 'S':
		return 's'
	case 'P':
		return 'p'
	}
	return c
}

// hip devolve o quadril que une as pernas (mesmo grupo das pernas).
func hip(dir string, ch rune, z int, group string) part {
	x0, w := frontLegLX, 6
	if dir == "right" {
		x0, w = sideLegX, 3
	}
	p := newPart(z, group)
	for y := legTop; y <= legTop+3; y++ {
		for dx := 0; dx < w; dx++ {
			p.px[[2]int{x0 + dx, y}] = ch
		}
	}
	return p
}

// legSpecs devolve as pernas (principal primeiro) para direção/pose.
func legSpecs(dir string, ps pose) []legSpec {
	if dir != "right" {
		return []legSpec{
			{x: frontLegLX, lift: ps.liftL, z: zLegs, group: "legs"},
			{x: frontLegRX, lift: ps.liftR, z: zLegs, group: "legs"},
		}
	}
	near := legSpec{x: sideLegX, toe: 1, z: zLegs, group: "legs"}
	far := legSpec{x: sideLegX, toe: 1, far: true, z: zFarLeg, group: "farleg"}
	switch ps.side {
	case strideNearFwd:
		near.offs, far.offs = offsFwd, offsBack
	case strideFarFwd:
		near.offs, far.offs = offsBack, offsFwd
	case strideNearPass:
		far.offs, far.lift = offsLift, 1
	case strideFarPass:
		near.offs, near.lift = offsLift, 1
	}
	return []legSpec{near, far}
}

// armSpec: braço (sprite + posição); usado pelo corpo e pelas mangas.
type armSpec struct {
	spr  sprite
	x, y int
	far  bool
	z    int
}

func armSpecs(dir string, ps pose) []armSpec {
	y := torsoY + 1 + ps.bob
	if dir != "right" {
		return []armSpec{
			{spr: armFrontL, x: frontArmLX, y: y + ps.armL, z: zArm},
			{spr: armFrontR, x: frontArmRX, y: y + ps.armR, z: zArm},
		}
	}
	near := armSpec{spr: armSideNeutral, x: sideNearArmX, y: y, z: zArm}
	far := armSpec{spr: armSideNeutral, x: sideNearArmX, y: y, far: true, z: zFarArm}
	switch ps.side {
	case strideNearFwd: // perna de cá à frente → braço de cá atrás
		near.spr, near.x = armSideBack, sideNearArmX-1
		far.spr, far.x = armSideFwd, sideNearArmX+2
	case strideFarFwd:
		near.spr, near.x = armSideFwd, sideNearArmX
		far.spr, far.x = armSideBack, sideNearArmX-3
	}
	return []armSpec{near, far}
}

func (a armSpec) part(group string) part {
	p := fromSprite(a.spr, a.x, a.y, a.z, group)
	if a.far {
		p = p.recolor(map[rune]rune{'S': 's'})
	}
	return p
}

// bodyParts: partes da camada body (também usadas como oclusoras).
func bodyParts(dir string, ps pose) []part {
	var parts []part
	head := headDown
	switch dir {
	case "up":
		head = headUp
	case "right":
		head = headSide
	}
	h := fromSprite(head, headX, headY+ps.bob, zHead, "")
	if ps.blink {
		// olho fecha: a metade de cima vira pele
		top := headY + ps.bob + 5
		for k, ch := range h.px {
			if (ch == 'e' || ch == 'w') && k[1] == top {
				h.px[k] = 'S'
			}
		}
	}
	parts = append(parts, h)
	if dir == "right" {
		parts = append(parts, fromSprite(torsoSide, sideTorsoX, torsoY+ps.bob, zTorso, ""))
	} else {
		parts = append(parts, fromSprite(torsoFront, frontTorsoX, torsoY+ps.bob, zTorso, ""))
	}
	for _, a := range armSpecs(dir, ps) {
		parts = append(parts, a.part(""))
	}
	legs := legSpecs(dir, ps)
	parts = append(parts, hip(dir, 'S', zLegs, "legs"))
	for _, l := range legs {
		parts = append(parts, buildLeg(l, legSkin))
	}
	return parts
}

// ── Parte de baixo (camada bottom) ─────────────────────────────────
// Materiais: P tecido, p sombra, Q brilho, k sapato, K brilho do sapato.

var skirtFront = lines(`
.PPPPPP.
.PPPPPP.
.QPPPPp.
PQPPPPPp`)

var skirtSide = lines(`
.PPPPP.
.PPPPP.
.QPPPp.
PQPPPPp`)

func bottomParts(style, dir string, ps pose) []part {
	var parts []part
	kind := legPants
	switch style {
	case "shorts":
		kind = legShorts
	case "skirt":
		kind = legShoes
	}
	for _, l := range legSpecs(dir, ps) {
		z := zPants
		if l.far {
			z = zFarPants
		}
		l.z = z
		parts = append(parts, buildLeg(l, kind))
	}
	if kind != legShoes {
		parts = append(parts, hip(dir, 'P', zPants, "legs"))
	}
	if style == "skirt" {
		if dir == "right" {
			parts = append(parts, fromSprite(skirtSide, 5, legTop, zSkirt, ""))
		} else {
			parts = append(parts, fromSprite(skirtFront, 4, legTop, zSkirt, ""))
		}
	}
	return parts
}

// ── Parte de cima (camada top) ─────────────────────────────────────
// Materiais: T tecido, t sombra, U brilho, a detalhe (branco/cordão).

var shirtFront = lines(`
.TTTT.
TUTTTT
TUTTTt
TTTTTt
TTTTTt
tttttt`)

var shirtSide = lines(`
.TTT.
TTTTt
TUTTt
TUTTt
TTTTt
ttttt`)

var hoodieFront = lines(`
.TTTT.
TUaaTT
TUaaTt
TttttT
TtTTtT
tttttt`)

var hoodieBack = lines(`
.tttt.
tttttt
TUTTTt
TUTTTt
TTTTTt
tttttt`)

var hoodieSide = lines(`
.TTTT
ttTTt
TUTTt
TUTTt
TTTTt
ttttt`)

var jacketFront = lines(`
.TaaT.
TUaaTT
TUaaTt
TUaaTt
TTaaTt
ttaatt`)

var dressFront = lines(`
..TTTT..
.TUTTTT.
.TUTTTt.
.tttttt.
.TTTTTT.
.TUTTTt.
TUTTTTTt
tttttttt`)

var dressSide = lines(`
..TTT..
.TTTTt.
.TUTTt.
.ttttt.
.TTTTT.
.UTTTt.
TUTTTTt
ttttttt`)

func topParts(style, dir string, ps pose) []part {
	var parts []part
	y := torsoY + ps.bob
	var torso sprite
	tx := frontTorsoX
	if dir == "right" {
		tx = sideTorsoX
	}
	switch style {
	case "hoodie":
		switch dir {
		case "down":
			torso = hoodieFront
		case "up":
			torso = hoodieBack
		default:
			torso = hoodieSide
		}
	case "jacket":
		if dir == "down" {
			torso = jacketFront
		} else if dir == "up" {
			torso = shirtFront
		} else {
			torso = shirtSide
		}
	case "dress":
		if dir == "right" {
			torso, tx = dressSide, sideTorsoX-1
		} else {
			torso, tx = dressFront, frontTorsoX-1
		}
	default: // tee, tank
		if dir == "right" {
			torso = shirtSide
		} else {
			torso = shirtFront
		}
	}
	parts = append(parts, fromSprite(torso, tx, y, zShirt, ""))

	sleeve := 0
	switch style {
	case "tee", "dress":
		sleeve = sleeveShortLen
	case "hoodie", "jacket":
		sleeve = sleeveLongLen
	}
	if sleeve > 0 {
		for _, a := range armSpecs(dir, ps) {
			s := make(sprite, 0, sleeve)
			for r := 0; r < sleeve && r < len(a.spr); r++ {
				row := strings.Map(func(ch rune) rune {
					if ch == '.' {
						return '.'
					}
					return 'T'
				}, a.spr[r])
				if r == sleeve-1 {
					row = strings.ReplaceAll(row, "T", "t") // punho
				}
				s = append(s, row)
			}
			z := zSleeve
			if a.far {
				z = zFarSleeve
			}
			p := fromSprite(s, a.x, a.y, z, "")
			if a.far {
				p = p.recolor(map[rune]rune{'T': 't'})
			}
			parts = append(parts, p)
		}
	}
	return parts
}

// ── Cabelo (camada hair) ───────────────────────────────────────────
// Desenhado num quadro 14×N com origem em (1,3): a cabeça ocupa as colunas
// 2..11 e linhas 4..13 desse quadro; os olhos ficam nas linhas 8–9.
// Materiais: H base, h sombra, L brilho.

type hairArt struct{ down, up, side, tailUp, tailSide sprite }

var hairStyles = map[string]hairArt{
	"short": {
		down: lines(`
..............
....hHHHHh....
...hHLLHHHh...
..hHLLHHHHHh..
.hHLLHHHHHHHh.
.HHLHHHHHhHHH.
.HHHHhHHHHhHH.
.HhHH.hHH.HhH.
.hH........Hh.
.h..........h.`),
		up: lines(`
..............
....hHHHHh....
...hHLLHHHh...
..hHLLHHHHHh..
.hHLHHHHHHHHh.
.HHHHHHHHHHHH.
.HHHhHHHHhHHH.
.HHhHHHHHHhHH.
.HhHHHHhHHHhH.
.hHHHHHhHHHHh.
..hHHHHhHHHh..
...hhhhhhhh...`),
		side: lines(`
..............
....hHHHHh....
...hHHLLHHh...
..hHHLLHHHHh..
.hHHLHHHHHHHh.
.HHHHHHHHHHHHh
.HHhHHHHHhHHH.
.HHHhHHHHHhH..
.HHHHHhH......
.hHHHHh.......
.hHHHh........
..hhh.........`),
	},
	"spiky": {
		down: lines(`
...h..h...h...
..hH.hH..hH.h.
..HHhHHhHHHhH.
.hHLLHHHHHHHh.
hHLLHHHHHHHHHh
.HHHHHhHHHhHH.
.HHhHHHhHHHhH.
.HhH.HhHH.hHH.
.hH........Hh.
.h..........h.`),
		up: lines(`
...h..h...h...
..hH.hH..hH.h.
..HHhHHhHHHhH.
.hHLLHHHHHHHh.
hHLHHHHHHHHHHh
.HHHHhHHHhHHH.
.HHHHHHHHHHHH.
.HhHHHhHHHHhH.
.HHHHHHHHHHHH.
.hHHhHHHHhHHh.
..hH.hHH.hH...
...h..h...h...`),
		side: lines(`
.h...h..h.....
hH..hH.hH.....
HHhhHHhHHh....
.HHLLHHHHHh...
hHLLHHHHHHHh..
.HHHHHHHHHHHh.
hHHhHHHHHhHHH.
.HHHhHHHHHhH..
hHHHHHhH......
.hHHHHh.......
hHhHHh........
.h.hh.........`),
	},
	"buzz": {
		down: lines(`
..............
..............
..............
....hhhhhh....
...hHLHHHHh...
..hHLHHHHHHh..
..hHHhHHhHHh..
..hD......Dh..`),
		up: lines(`
..............
..............
..............
....hhhhhh....
...hHLHHHHh...
..hHLHHHHHHh..
..hHHHHhHHHh..
..hHhHHHHhHh..
..hHHHHHHHHh..
..hHHhHHHHHh..
..hhHHHHHHhh..
...hhhhhhhh...`),
		side: lines(`
..............
..............
..............
....hhhhhh....
...hHLHHHHh...
..hHLHHHHHHh..
..hHHHhHHHh...
..hHHHHHHh....
..hHHhHh......
..hHHHh.......
..hHHh........
...hh.........`),
	},
	"curly": {
		down: lines(`
...hH.hHh.Hh..
..hHHhHHHhHHh.
.hHLLHHLHHHHHh
hHLLHHHHhHHHHh
hHHHHhHHHHHhHh
HHhHHHHhHHHHHH
HHHHhHHHHHhHHH
hHhH.hHHh.HhHh
HHh........hHH
hH..........Hh
HHh........hHH
hH..........Hh
.h..........h.`),
		up: lines(`
...hH.hHh.Hh..
..hHHhHHHhHHh.
.hHLLHHLHHHHHh
hHLLHHHHhHHHHh
hHHHHhHHHHHhHh
HHhHHHHhHHHHHH
HHHHhHHHHHhHHH
hHHHHHHhHHHHHh
HHhHHhHHHHhHHH
hHHHHHHHhHHHHh
HHhHHhHHHHHhHH
hHHHhHHHhHHHHh
.hHh.hHh.hHh..`),
		side: lines(`
..hH.hHh.Hh...
.hHHhHHHhHHh..
hHLLHHLHHHHHh.
HLLHHHHhHHHHHh
HHHHhHHHHHhHHh
HhHHHHhHHHHHH.
HHHHhHHHHHhHh.
hHHHHHhHHh....
HHhHHHHh......
hHHHhHHh......
HHhHHHh.......
hHHhHh........
.hh.h.........`),
	},
	"bob": {
		down: lines(`
..............
....hHHHHh....
...hHLLHHHh...
..hHLLHHHHHh..
.hHLHHHHHHHHh.
.HHHHHHHHHHHH.
hHHHHHHHHHHHHh
HHhHHHhHHHhHHH
HHh........hHH
HH..........HH
HHh........hHH
HhH........HhH
hhD........Dhh
.h..........h.`),
		up: lines(`
..............
....hHHHHh....
...hHLLHHHh...
..hHLLHHHHHh..
.hHLHHHHHHHHh.
.HHHHHHHHHHHH.
hHHHHHhHHHHHHh
HHHHhHHHHhHHHH
HHHHhHHHHhHHHH
HHHhHHHHHHhHHH
HHHhHHHHHHhHHH
HHhHHHhHHHHhHH
hhDhhDhhDhhDhh
.h..h..h..h...`),
		side: lines(`
..............
....hHHHHh....
...hHHLLHHh...
..hHHLLHHHHh..
.hHHLHHHHHHHh.
.HHHHHHHHHHHHh
hHHHHHHHHhHHH.
HHHhHHHHHHhH..
HHHHhHHh......
HHHhHHHh......
HHhHHHh.......
HHHhHHh.......
hhDhhD........`),
	},
	"long": {
		down: lines(`
..............
....hHHHHh....
...hHLLHHHh...
..hHLLHHHHHh..
.hHLHHHHHHHHh.
.HHHHHHHHhHHH.
hHHHhHHHHHhHHh
HHhH.HhHH.HhHH
HHH........HHH
HHh........hHH
HH..........HH
HHh........hHH
HLH........HLH
HHh........hHH
HH..........HH
HhH........HhH
hHh........hHh
.hD........Dh.
.h..........h.`),
		up: lines(`
..............
....hHHHHh....
...hHLLHHHh...
..hHLLHHHHHh..
.hHLHHHHHHHHh.
.HHHHHHHHHHHH.
hHHHHHhHHHHHHh
HHHHhHHHHhHHHH
HHHHhHHHHhHHHH
HHHhHHHHHHhHHH
HHHhHHHHHHhHHH
HHhHHHHhHHHhHH
HHhHHHHhHHHhHH
HhHHHHHhHHHHhH
HhHHHHhHHHHHhH
HHHHHHhHHHHHHH
hHHhHHHHHhHHHh
.hHHhHHHhHHHh.
..hh.hhh.hh...`),
		side: lines(`
..............
....hHHHHh....
...hHHLLHHh...
..hHHLLHHHHh..
.hHHLHHHHHHHh.
.HHHHHHHHHHHHh
hHHHHHHHHhHHH.
HHHhHHHHHHhH..
HHHHhHHh......
HHHhHHHh......
HHhHHHh.......
HHHhHHh.......
HHHhHH........
HHhHHH........
HhHHHh........
HHhHHh........
hHHhH.........
.hHh..........
..h...........`),
	},
	"ponytail": {
		down: lines(`
..............
....hHHHHh....
...hHLLHHHh...
..hHLLHHHHHh..
.hHLHHHHHHHHh.
.HHHHHHHHHHHH.
.HHhHHHHHHhHH.
.HhHHhHHhHHhH.
.hH........Hh.
.h..........h.`),
		up: lines(`
..............
....hHHHHh....
...hHLLHHHh...
..hHLLHHHHHh..
.hHLHHHHHHHHh.
.HHHHHhhHHHHH.
.HHHHhHHhHHHH.
.HHHHhHHhHHHH.
.HhHHHHHHHHhH.
.hHHHHHHHHHHh.
..hHHHHHHHHh..
...hhhhhhhh...`),
		tailUp: lines(`
.....hDh......
....hHHHh.....
....HLHHh.....
....HLHHh.....
....hHHHh.....
.....HHh......
.....hHh......
......h.......`),
		side: lines(`
..............
....hHHHHh....
...hHHLLHHh...
..hHHLLHHHHh..
.hHHLHHHHHHHh.
.HHHHHHHHHHHHh
.HHhHHHHHhHHH.
.HHHhHHHHHhH..
.HHHHHhH......
.hHHHHh.......
..hHHh........
...hh.........`),
		tailSide: lines(`
..............
..............
..............
..............
..............
.hD...........
hHHh..........
HLHh..........
HLHh..........
hHHh..........
.HHh..........
.hHh..........
..hh..........`),
	},
	"bun": {
		down: lines(`
.....hHHh.....
....hHLHHh....
....hDDDDh....
..hhHHHHHHhh..
.hHLLHHHHHHHh.
.HHLHHHHHHHHH.
.HHHHhHHHHhHH.
.HhHHhHHhHHhH.
.hH........Hh.
.h..........h.`),
		up: lines(`
.....hHHh.....
....hHLHHh....
....hDDDDh....
..hhHHHHHHhh..
.hHLLHHHHHHHh.
.HHLHHHHHHHHH.
.HHHHhHHhHHHH.
.HHHhHHHHhHHH.
.HHHHHHHHHHHH.
.hHHHhHHhHHHh.
..hHHHHHHHHh..
...hhhhhhhh...`),
		side: lines(`
..hHHh........
.hHLHHh.......
.hHHHDh.......
..hhHHHHHHh...
.hHLLHHHHHHh..
.HHLHHHHHHHHh.
.HHHHHHHHhHHH.
.HHHhHHHHHhH..
.HHHHHhH......
.hHHHHh.......
..hHHh........
...hh.........`),
	},
}

func hairParts(style, dir string, ps pose) []part {
	art, ok := hairStyles[style]
	if !ok {
		return nil
	}
	var parts []part
	var s, tail sprite
	switch dir {
	case "down":
		s = art.down
	case "up":
		s, tail = art.up, art.tailUp
	default:
		s, tail = art.side, art.tailSide
	}
	parts = append(parts, fromSprite(s, hairX, hairY+ps.bob, zHair, "hair"))
	if tail != nil {
		// o rabo "atrasa" no balanço: não acompanha o bob (parece pendurado)
		tx, ty := hairX, hairY+8 // nuca
		if dir != "up" {
			tx, ty = hairX-1, hairY+1
		}
		parts = append(parts, fromSprite(tail, tx, ty, zHair, "hair"))
	}
	return parts
}

// ── Acessório de cabeça (camada hat) ───────────────────────────────
// Boné, gorro e chapéu de aba por cima do cabelo — o traço mais marcante
// dos personagens de RPG de DS/GBA. Mesmo quadro do cabelo (14 de largura
// em hairX,hairY); a aba fica na linha 6, então a franja aparece por baixo.
// Materiais: T tecido, t sombra, U brilho, a detalhe (logo/pompom/faixa).
// Com chapéu, o cabelo usa a variante "@hat" (sem os pixels acima da aba).

const hatCutRow = 6 // linhas do quadro do cabelo acima disto ficam sob o chapéu

type hatArt struct{ down, up, side sprite }

var hatStyles = map[string]hatArt{
	"cap": {
		down: lines(`
..............
....tTTTTt....
...tTUUTTTt...
..tTUUTTTTTt..
..tTUTTaaTTt..
.tTTTTaaTTTTt.
.tttttttttttt.`),
		up: lines(`
..............
....tTTTTt....
...tTUUTTTt...
..tTUTTTTTTt..
..tTTTTTTTTt..
.tTTTTTTTTTTt.
.tTTTaaaaTTTt.`),
		side: lines(`
..............
....tTTTTt....
...tTUUTTTt...
..tTUTTTTTTt..
..tTTTTTTTTt..
.tTTTTTTTTTTtt
.ttttttttttttt`),
	},
	"beanie": {
		down: lines(`
......aa......
.....aaaa.....
...tTTTTTTt...
..tTUUTTTTTt..
..TUUTTTTTTT..
.tTUTTTTTTTTt.
.tTtTtTtTtTtt.`),
		up: lines(`
......aa......
.....aaaa.....
...tTTTTTTt...
..tTUUTTTTTt..
..TUTTTTTTTT..
.tTTTTTTTTTTt.
.tTtTtTtTtTtt.`),
		side: lines(`
.....aa.......
....aaaa......
...tTTTTTTt...
..tTUUTTTTTt..
..TUUTTTTTTT..
.tTUTTTTTTTTt.
.tTtTtTtTtTtt.`),
	},
	"bucket": {
		down: lines(`
..............
....tTTTTt....
...tTUUTTTt...
...TUUTTTTT...
...aaaaaaaa...
.tTTTTTTTTTTt.
tttttttttttttt`),
		up: lines(`
..............
....tTTTTt....
...tTUUTTTt...
...TUTTTTTT...
...aaaaaaaa...
.tTTTTTTTTTTt.
tttttttttttttt`),
		side: lines(`
..............
....tTTTTt....
...tTUUTTTt...
...TUUTTTTT...
...aaaaaaaa...
.tTTTTTTTTTTTt
tttttttttttttt`),
	},
}

func hatParts(style, dir string, ps pose) []part {
	art, ok := hatStyles[style]
	if !ok {
		return nil
	}
	s := art.down
	switch dir {
	case "up":
		s = art.up
	case "right":
		s = art.side
	}
	return []part{fromSprite(s, hairX, hairY+ps.bob, zHat, "")}
}

// cutUnderHat apaga do cabelo o que ficaria escondido sob o chapéu
// (inclusive volumes altos como coque e espetado, que vazariam por cima).
func cutUnderHat(c canvas, ps pose) canvas {
	limit := hairY + hatCutRow + ps.bob
	for y := 0; y < limit && y < frameH; y++ {
		for x := range c[y] {
			c[y][x] = '.'
		}
	}
	return c
}

// ── Bolsa (camada bag) ─────────────────────────────────────────────
// Mochila e bolsa transversal — outro traço marcante dos personagens de
// RPG de DS. De frente só aparecem as alças; de costas, a mochila inteira;
// de lado, ela aparece atrás das costas (o tronco recorta). Acompanha o
// balanço do passo (bob). Materiais como a roupa: T, t, U, a (zíper/fivela).

var backpackBack = lines(`
.tTTt.
tTUTTt
TUTTTt
TaaaaT
TTTTTt
tttttt`)

var backpackSide = lines(`
.tT.
tUTT
TUTT
TaaT
TTTt
ttt.`)

var satchelBag = lines(`
tTt
TaT
ttt`)

func bagParts(style, dir string, ps pose) []part {
	ty := torsoY + ps.bob
	px := func(z int, pts ...[2]int) part {
		p := newPart(z, "")
		for _, q := range pts {
			p.px[q] = 'T'
		}
		return p
	}
	switch style {
	case "backpack":
		switch dir {
		case "down":
			return []part{
				px(zStrap, [2]int{6, ty}, [2]int{6, ty + 1}, [2]int{6, ty + 2}, [2]int{6, ty + 3}),
				px(zStrap, [2]int{9, ty}, [2]int{9, ty + 1}, [2]int{9, ty + 2}, [2]int{9, ty + 3}),
			}
		case "up":
			return []part{fromSprite(backpackBack, frontTorsoX, ty, zBagFront, "")}
		default:
			return []part{fromSprite(backpackSide, sideTorsoX-3, ty, zBagBack, "")}
		}
	case "satchel":
		switch dir {
		case "down": // alça do ombro esquerdo ao quadril direito
			return []part{
				px(zStrap, [2]int{6, ty}, [2]int{7, ty + 1}, [2]int{8, ty + 2}, [2]int{9, ty + 3}),
				fromSprite(satchelBag, frontArmRX, ty+4, zBagFront, ""),
			}
		case "up":
			return []part{
				px(zStrap, [2]int{9, ty}, [2]int{8, ty + 1}, [2]int{7, ty + 2}, [2]int{6, ty + 3}),
				fromSprite(satchelBag, frontArmLX-1, ty+4, zBagFront, ""),
			}
		default:
			return []part{fromSprite(satchelBag, sideTorsoX+2, ty+4, zBagFront, "")}
		}
	}
	return nil
}

// ── Catálogo ───────────────────────────────────────────────────────

type ramp struct{ base, shade, light string }

type avColor struct {
	id, label string
	r         ramp
}

type avStyle struct{ id, label string }

var (
	skinColors = []avColor{
		{"tone1", "Tom 1", ramp{"#ffe1cc", "#eab396", "#fff0e4"}},
		{"tone2", "Tom 2", ramp{"#f6cfae", "#d9a07c", "#ffe2c8"}},
		{"tone3", "Tom 3", ramp{"#dba373", "#b47a4b", "#ecbf8f"}},
		{"tone4", "Tom 4", ramp{"#b97c4e", "#8e5631", "#cf966a"}},
		{"tone5", "Tom 5", ramp{"#8f5a3c", "#663b22", "#a8704f"}},
		{"tone6", "Tom 6", ramp{"#5f3b28", "#422517", "#77503a"}},
	}
	hairColors = []avColor{
		{"black", "Cor 1", ramp{"#3b3342", "#221d29", "#5e5469"}},
		{"brown", "Cor 2", ramp{"#7a4a2a", "#4f2e18", "#a56c40"}},
		{"auburn", "Cor 3", ramp{"#c1502c", "#83301a", "#e57a45"}},
		{"blonde", "Cor 4", ramp{"#f0cf6a", "#c39638", "#fff1a8"}},
		{"platinum", "Cor 5", ramp{"#e8e4f0", "#a9a3bd", "#ffffff"}},
		{"pink", "Cor 6", ramp{"#f28ab9", "#c2568b", "#ffc3de"}},
		{"blue", "Cor 7", ramp{"#5a86e0", "#3656a8", "#9cc0ff"}},
	}
	hairStyleList = []avStyle{
		{"short", "Estilo 1"}, {"spiky", "Estilo 2"}, {"buzz", "Estilo 3"}, {"curly", "Estilo 4"},
		{"bob", "Estilo 5"}, {"long", "Estilo 6"}, {"ponytail", "Estilo 7"}, {"bun", "Estilo 8"},
	}
	clothColors = []avColor{
		{"blue", "Cor 1", ramp{"#4f8ad6", "#2f5c9c", "#80b2f2"}},
		{"teal", "Cor 2", ramp{"#3fb3a8", "#247a78", "#76dccf"}},
		{"green", "Cor 3", ramp{"#5bb36a", "#337a45", "#8ad98f"}},
		{"yellow", "Cor 4", ramp{"#f2c84b", "#c4902a", "#ffe48a"}},
		{"red", "Cor 5", ramp{"#e05a4e", "#a13529", "#f58a7a"}},
		{"pink", "Cor 6", ramp{"#f28bb5", "#c25a86", "#ffbcd6"}},
		{"purple", "Cor 7", ramp{"#9b6ad6", "#67409a", "#c29af0"}},
		{"white", "Cor 8", ramp{"#f2f2ee", "#c2c2cc", "#ffffff"}},
		{"black", "Cor 9", ramp{"#3c3c4a", "#24242e", "#5e5e72"}},
	}
	topStyleList = []avStyle{
		{"tee", "Estilo 1"}, {"tank", "Estilo 2"}, {"hoodie", "Estilo 3"}, {"jacket", "Estilo 4"}, {"dress", "Estilo 5"},
	}
	bottomColors = []avColor{
		{"denim", "Cor 1", ramp{"#4b6ea8", "#2f4b80", "#6f92cc"}},
		{"black", "Cor 2", ramp{"#35353f", "#1f1f28", "#50505e"}},
		{"khaki", "Cor 3", ramp{"#c9a66b", "#977643", "#e2c48c"}},
		{"gray", "Cor 4", ramp{"#8b909c", "#5e6370", "#b1b6c2"}},
		{"wine", "Cor 5", ramp{"#943350", "#631d34", "#b9506c"}},
		{"pink", "Cor 6", ramp{"#ef9ac0", "#c0628c", "#ffc6dc"}},
	}
	bottomStyleList = []avStyle{{"pants", "Estilo 1"}, {"shorts", "Estilo 2"}, {"skirt", "Estilo 3"}}
	hatStyleList    = []avStyle{{"cap", "Estilo 1"}, {"beanie", "Estilo 2"}, {"bucket", "Estilo 3"}}
	bagStyleList    = []avStyle{{"backpack", "Estilo 1"}, {"satchel", "Estilo 2"}}
)

// avatarItem é um sheet: camada + estilo + cor.
type avatarItem struct {
	id, layer, style string
	color            avColor
	hatted           bool // variante de cabelo para usar sob chapéu (sheet "<id>@hat")
}

func avatarItems() []avatarItem {
	var items []avatarItem
	for _, c := range skinColors {
		items = append(items, avatarItem{c.id, "body", "", c, false})
	}
	for _, s := range bottomStyleList {
		for _, c := range bottomColors {
			items = append(items, avatarItem{s.id + "-" + c.id, "bottom", s.id, c, false})
		}
	}
	for _, s := range topStyleList {
		for _, c := range clothColors {
			items = append(items, avatarItem{s.id + "-" + c.id, "top", s.id, c, false})
		}
	}
	items = append(items, avatarItem{"none", "hair", "none", avColor{}, false}) // "Estilo 0"
	for _, s := range hairStyleList {
		for _, c := range hairColors {
			items = append(items, avatarItem{s.id + "-" + c.id, "hair", s.id, c, false})
		}
	}
	items = append(items, avatarItem{"none", "bag", "none", avColor{}, false})
	for _, s := range bagStyleList {
		for _, c := range clothColors {
			items = append(items, avatarItem{s.id + "-" + c.id, "bag", s.id, c, false})
		}
	}
	items = append(items, avatarItem{"none", "hat", "none", avColor{}, false})
	for _, s := range hatStyleList {
		for _, c := range clothColors {
			items = append(items, avatarItem{s.id + "-" + c.id, "hat", s.id, c, false})
		}
	}
	return items
}

// ── Cores ──────────────────────────────────────────────────────────

const inkColor = "#1d1426" // tinta-base do contorno (roxo quase preto)

func mix(a, b color.RGBA, t float64) color.RGBA {
	l := func(x, y uint8) uint8 { return uint8(float64(x)*(1-t) + float64(y)*t + 0.5) }
	return color.RGBA{l(a.R, b.R), l(a.G, b.G), l(a.B, b.B), 0xff}
}

func itemPalette(it avatarItem) map[rune]color.RGBA {
	r := it.color.r
	p := map[rune]color.RGBA{}
	if r.base == "" {
		return p
	}
	base, shade, light := hex(r.base), hex(r.shade), hex(r.light)
	ink := hex(inkColor)
	p['X'] = mix(shade, ink, 0.8) // contorno externo quase preto (GBA), levemente tingido
	p['x'] = mix(shade, ink, 0.3) // costura interna (contorno seletivo)
	switch it.layer {
	case "body":
		p['S'], p['s'] = base, shade
		p['e'] = hex("#2a2035")
		p['w'] = hex("#fbf8ff") // brilho do olho
		p['m'] = mix(base, hex("#ff6f7d"), 0.33)
	case "hair":
		p['H'], p['h'], p['L'] = base, shade, light
		p['D'] = mix(shade, ink, 0.35) // separação entre mechas / elástico
	case "top", "hat", "bag":
		p['T'], p['t'], p['U'] = base, shade, light
		p['a'] = hex("#f4f1ea")
		if it.color.id == "white" {
			p['a'] = hex("#8fa0b8")
		}
	case "bottom":
		p['P'], p['p'], p['Q'] = base, shade, light
		p['k'], p['K'] = hex("#3a2c38"), hex("#6a5868")
		p['o'] = hex("#ece8e0") // sola do tênis
	}
	return p
}

// ── Sheets ─────────────────────────────────────────────────────────

func layerParts(it avatarItem, dir string, ps pose) []part {
	switch it.layer {
	case "body":
		return bodyParts(dir, ps)
	case "bottom":
		return bottomParts(it.style, dir, ps)
	case "top":
		return topParts(it.style, dir, ps)
	case "hair":
		return hairParts(it.style, dir, ps)
	case "hat":
		return hatParts(it.style, dir, ps)
	case "bag":
		return bagParts(it.style, dir, ps)
	}
	return nil
}

func avatarFrame(it avatarItem, dir string, col int) canvas {
	d := dir
	if dir == "left" {
		d = "right"
	}
	ps := poses[col]
	body := shiftParts(bodyParts(d, ps), figureX)
	sil := map[[2]int]bool{}
	for _, b := range body {
		for k := range b.px {
			sil[k] = true
		}
	}
	var occ []part
	if it.layer != "body" {
		occ = body
	}
	c := compose(shiftParts(layerParts(it, d, ps), figureX), occ, sil)
	if it.hatted {
		c = cutUnderHat(c, ps)
	}
	if dir == "left" {
		c = c.mirror()
	}
	return c
}

// shiftParts desloca as partes horizontalmente (centraliza a figura no frame).
func shiftParts(parts []part, dx int) []part {
	out := make([]part, len(parts))
	for i, p := range parts {
		out[i] = p.shift(dx, 0)
	}
	return out
}

func avatarSheet(it avatarItem) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, sheetCols*frameW*2, sheetRows*frameH*2))
	pal := itemPalette(it)
	for row, dir := range sheetDirs {
		for col := 0; col < sheetCols; col++ {
			c := avatarFrame(it, dir, col)
			for y := 0; y < frameH; y++ {
				for x := 0; x < frameW; x++ {
					ch := c[y][x]
					if ch == '.' {
						continue
					}
					clr, ok := pal[ch]
					if !ok {
						panic(fmt.Sprintf("avatar %s/%s: material %q sem cor", it.layer, it.id, ch))
					}
					fillRect(img, (col*frameW+x)*2, (row*frameH+y)*2, 2, 2, clr)
				}
			}
		}
	}
	return img
}

// ── Saída: PNGs, manifesto e catálogos espelhados (Go + TS) ────────

func writeAvatars(out string) {
	items := avatarItems()
	for _, layer := range []string{"body", "bottom", "top", "bag", "hair", "hat"} {
		dir := filepath.Join(out, "avatars", layer)
		old, _ := filepath.Glob(filepath.Join(dir, "*.png"))
		for _, f := range old {
			_ = os.Remove(f)
		}
	}
	type manifestItem struct {
		ID      string `json:"id"`
		Layer   string `json:"layer"`
		Sheet   string `json:"sheet"`
		License string `json:"license"`
		Author  string `json:"author"`
	}
	var mitems []manifestItem
	for _, it := range items {
		sheet := "avatars/" + it.layer + "/" + it.id + ".png"
		writePNG(filepath.Join(out, sheet), avatarSheet(it))
		mitems = append(mitems, manifestItem{it.id, it.layer, sheet, "CC0", avatarAuth})
		if it.layer == "hair" && it.id != "none" {
			h := it
			h.hatted = true
			hs := "avatars/hair/" + it.id + "@hat.png"
			writePNG(filepath.Join(out, hs), avatarSheet(h))
			mitems = append(mitems, manifestItem{it.id + "@hat", "hair", hs, "CC0", avatarAuth})
		}
	}
	writeJSON(filepath.Join(out, "avatars", "manifest.json"), map[string]any{
		"frameSize":   map[string]int{"w": frameW * 2, "h": frameH * 2},
		"sheetLayout": "frames 32×32 de arte (64×64 no PNG, 2×); 6 colunas × 4 linhas (parado, piscando, passo A, meio A, passo B, meio B; linhas: down, up, left, right)",
		"layers":      []string{"body", "bottom", "top", "bag", "hair", "hat"},
		"items":       mitems,
	})
	repo := filepath.Dir(filepath.Clean(out))
	writeGoCatalog(filepath.Join(repo, "backend", "internal", "game", "avatar_catalog_gen.go"), items)
	writeTSCatalog(filepath.Join(repo, "frontend", "src", "game", "avatarCatalog.gen.ts"))
}

func writeGoCatalog(path string, items []avatarItem) {
	byLayer := map[string][]string{}
	for _, it := range items {
		byLayer[it.layer] = append(byLayer[it.layer], it.id)
	}
	var b strings.Builder
	b.WriteString("// Code generated by cmd/genassets. DO NOT EDIT.\n\npackage game\n\n")
	b.WriteString("// Ids de avatar válidos por camada (um sheet por id em assets/avatars).\nvar (\n")
	for _, l := range []struct{ name, layer string }{
		{"AvatarBodies", "body"}, {"AvatarBottoms", "bottom"}, {"AvatarTops", "top"}, {"AvatarHairs", "hair"},
		{"AvatarHats", "hat"}, {"AvatarBags", "bag"},
	} {
		fmt.Fprintf(&b, "\t%s = []string{", l.name)
		for i, id := range byLayer[l.layer] {
			if i > 0 {
				b.WriteString(", ")
			}
			fmt.Fprintf(&b, "%q", id)
		}
		b.WriteString("}\n")
	}
	b.WriteString(")\n")
	src, err := format.Source([]byte(b.String()))
	if err != nil {
		panic(err)
	}
	writeFile(path, string(src))
}

func writeTSCatalog(path string) {
	var b strings.Builder
	b.WriteString("// Gerado por backend/cmd/genassets — não edite à mão.\n\n")
	b.WriteString("export interface AvatarColor { id: string; label: string; base: string; shade: string; light: string }\n")
	b.WriteString("export interface AvatarStyle { id: string; label: string }\n\n")
	colors := func(name string, cs []avColor) {
		fmt.Fprintf(&b, "export const %s: AvatarColor[] = [\n", name)
		for _, c := range cs {
			fmt.Fprintf(&b, "  { id: %q, label: %q, base: %q, shade: %q, light: %q },\n", c.id, c.label, c.r.base, c.r.shade, c.r.light)
		}
		b.WriteString("];\n\n")
	}
	styles := func(name string, ss []avStyle) {
		fmt.Fprintf(&b, "export const %s: AvatarStyle[] = [\n", name)
		for _, s := range ss {
			fmt.Fprintf(&b, "  { id: %q, label: %q },\n", s.id, s.label)
		}
		b.WriteString("];\n\n")
	}
	colors("SKIN_COLORS", skinColors)
	styles("HAIR_STYLES", hairStyleList)
	colors("HAIR_COLORS", hairColors)
	styles("TOP_STYLES", topStyleList)
	colors("TOP_COLORS", clothColors)
	styles("BOTTOM_STYLES", bottomStyleList)
	colors("BOTTOM_COLORS", bottomColors)
	styles("BAG_STYLES", bagStyleList)
	colors("BAG_COLORS", clothColors)
	styles("HAT_STYLES", hatStyleList)
	colors("HAT_COLORS", clothColors)
	fmt.Fprintf(&b, "export const SHEET = { cols: %d, rows: %d, frameW: %d, frameH: %d } as const;\n", sheetCols, sheetRows, frameW*2, frameH*2)
	writeFile(path, b.String())
}

func writeFile(path, content string) {
	mustMkdir(filepath.Dir(path))
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		panic(err)
	}
}
