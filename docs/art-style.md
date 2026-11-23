# Estilo gráfico do PixelRooms — análise técnica e decisões

Este documento analisa **como** os gráficos de três referências são construídos
(Gather Town, Pokémon de GBA e Habbo Hotel) e fixa as regras do estilo próprio do
PixelRooms. O objetivo é alcançar o mesmo *apelo* com arte **original**: nenhum
sprite, tile, personagem ou paleta é copiado; as semelhanças ficam nas técnicas
(que não são protegíveis), não nos desenhos.

## 1. Como as referências fazem

### 1.1 Gather Town

| Aspecto | Técnica |
|---|---|
| Grid | 32×32 px por tile, mapa ortogonal (top-down). |
| Perspectiva | **"3/4 top-down"**: o chão é visto de cima, mas paredes e móveis mostram a face frontal. Paredes têm **duas partes**: o *topo* (faixa escura, ~1 tile) e a *face* (pintura clara com rodapé). |
| Paleta | Tons quentes e dessaturados ("aconchegante"): madeira caramelo, bege, verde-folha, azul-petróleo. Pouca saturação, contraste moderado. |
| Contornos | Finos (1 px) e **coloridos** — marrom-escuro em móveis de madeira, nunca preto puro. Pisos não têm contorno. |
| Sombreamento | 2–3 tons por material (base, sombra, brilho) com luz vindo de cima/esquerda. Móveis projetam sombra discreta de 1 px na base. |
| Avatar | Frame 32×64, ocupa 1 tile de chão e 2 de altura. **Cabeça grande** (~40% da altura), corpo curto, 4 direções, caminhada de 4 frames, paper-doll (pele, cabelo, roupa, acessórios) com todas as camadas na mesma grade. |
| Composição de mapas | Tapetes e mesas grandes são **9-slice** (cantos, bordas e centro são tiles diferentes); objetos altos têm a parte de cima na camada *Above* para o avatar passar "por trás". |

### 1.2 Pokémon (Game Boy Advance: Ruby/Sapphire/Emerald, FireRed/LeafGreen)

| Aspecto | Técnica |
|---|---|
| Grid | **16×16 px** por tile (o jogo roda em 240×160 e é visto ampliado 2–4×). Esse "pixel grosso" é parte do charme. |
| Paleta | Hardware impõe **16 cores por paleta** (15 + transparente), várias paletas por tileset. Resultado: rampas curtas e muito coesas. |
| Sombreamento | Rampas com **hue-shift**: a sombra não é só "mais escura", desloca o matiz (verde → azul-esverdeado nas sombras; amarelo → laranja nas sombras). Dá vida sem mais cores. |
| Contornos | Escuros e fortes (quase pretos, mas tingidos), 1 px, em tudo que é objeto; o chão é plano, sem contorno. |
| Perspectiva | Também 3/4: casas mostram telhado (topo) + fachada; árvores têm copa (topo) e tronco. |
| Personagens | 16×32 (1 tile de largura, 2 de altura), cabeça grande, olhos de 2×2 px, caminhada de **3 frames** (passo-parado-passo), lado esquerdo = espelho do direito. |
| Terreno | *Autotiles*: grama, água e caminhos têm variantes de borda/canto para transições suaves; animação de água/flores por troca de paleta. |

### 1.3 Habbo Hotel

| Aspecto | Técnica |
|---|---|
| Perspectiva | **Isométrica (dimétrica 2:1)**: o tile base é um losango de 64×32 px. Diferente do top-down, mas as lições de leitura visual valem. |
| Contornos | Pretos, grossos (1 px, mas sempre presentes), inclusive no piso — é o traço mais marcante do Habbo. |
| Cores | Saturadas e alegres, poucos tons por objeto (2–3), sombreamento **chapado** sem gradiente; cada face do objeto tem um tom (luz, meio, sombra), que reforça o volume isométrico. |
| Móveis ("furni") | Catálogo enorme de peças pequenas e combináveis; o valor está na **variedade** e na recoloração (o mesmo móvel em várias cores). |
| Avatar | ~64 px de altura, proporções quase realistas (cabeça menor que no Gather/Pokémon), 8 direções por ser isométrico, roupas por camadas. |

### 1.3b RPG Maker (2000/XP/MV/MZ)

| Aspecto | Técnica |
|---|---|
| Grid | 16×16 (2000), 32×32 (XP/VX) ou 48×48 (MV/MZ) por tile; personagens em frames de 24×32 (2000), 32×48 (XP) ou 48×48 (MV/MZ). |
| Personagens | Chibi de 2–2,5 cabeças; 3 frames por direção (passo, parado, passo) × 4 direções; olhos grandes com ponto de brilho. |
| Contornos | Escuros mas tingidos na silhueta; costuras internas mais suaves (cor escura do próprio material). |
| Objetos | Vista 3/4: tampo claro + frente escura, pernas visíveis; detalhes pequenos que contam história (monitor em pé com brilho, teclado, caneca, papéis); **sombra de contato** no chão sob o móvel. |
| Cadeiras | Desenhadas conforme o lado de quem senta: de costas quando a pessoa fica de frente para a mesa. |

### 1.4 O que é comum (e o que levamos)

1. **Paleta limitada e deliberada** — poucas cores, em rampas curtas.
2. **Hue-shift nas rampas** — sombras mais frias/azuladas, luzes mais quentes/amareladas.
3. **Contorno tingido** (nunca preto puro, nunca cinza): marrom-escuro para madeira/geral.
4. **Luz fixa de cima-esquerda**: topo mais claro, lado direito/baixo mais escuro.
5. **Perspectiva 3/4**: topo + face frontal em paredes e móveis altos.
6. **Objetos recoloríveis** por troca de rampa (mesmo desenho, outra cor) — barato e aumenta a variedade.
7. **9-slice** para tapetes/mesas grandes; **autotiles** para bordas.
8. **Pixels inteiros**: textura NEAREST e zoom em fator inteiro, nunca 1.5×.

## 2. Regras do estilo PixelRooms

| Regra | Valor |
|---|---|
| Resolução de desenho | **16×16 px por tile, ampliado 2× para os 32×32 do grid** (estética GBA; metade do trabalho por tile e consistência garantida). Avatar desenhado em 16×32 → 32×64. |
| Paleta | ~56 cores em rampas de 4–5 tons com hue-shift (ver `backend/cmd/genassets/art.go`). |
| Contorno | `#2b1d14` (marrom quase preto) em objetos; no avatar, a cor de cada material escurecida rumo a `#1d1426`; pisos sem contorno. |
| Luz | Cima-esquerda. Topos e bordas superiores/esquerdas recebem o tom claro; direita/baixo o escuro. |
| Paredes | Dois tiles: `wall_top` (topo escuro) e `wall_front` (face clara com rodapé de madeira). Objetos de parede (quadro, TV, mural, janela) são **sobreposições** desenhadas sobre a face. |
| Tapetes | 9-slice gerado por código a partir de uma rampa (teal, roxo, vermelho/palco). |
| Móveis | Sombra de contato semitransparente sob cada móvel; estações de trabalho com monitor em pé, teclado e cadeira de costas. |
| Objetos altos | 2 tiles: a metade de cima vai na camada *Above*. |
| Avatar | **Frame 32×32 de arte** (como os personagens de RPG de DS/B/W, tile 16×16), figura centralizada de ~16×27; PNG em 2× (64×64). Chibi: cabeça grande e arredondada (~45% da altura com o cabelo) sobre **corpo pequeno** (tronco 6 px de frente, 5 de lado; braços colados; pernas finas e juntas). Olhos 1×2 com ponto de brilho, bochechas rosadas. **Contorno seletivo**: escuro só na silhueta, costuras internas na sombra escura do material (Pokémon GBA / RPG Maker). Montado por partes (`backend/cmd/genassets/avatar.go`); caminhada de 4 frames com balanço, braços opostos às pernas e passada na vista lateral; piscada no idle. Camadas: `body`, `bottom`, `top`, `hair`, `hat` (boné, gorro, chapéu de aba — com chapéu o cabelo usa a variante `@hat`, sem os fios sob a copa). Tênis de 2 linhas com sola clara. |

## 3. Pipeline

Toda a arte é **código**: `backend/cmd/genassets` desenha tiles e frames a partir de
"ASCII art" (um caractere por pixel, legenda = paleta) e gera os PNGs. Vantagens:
diff legível no git, recoloração trivial (trocar a rampa), validação automática
(dimensão de cada tile é checada ao gerar) e licença clara (CC0, feito do zero).

Regenerar: `cd backend && go run ./cmd/genassets`.

## 4. Nota legal

- Sprites, tiles e personagens de Gather, Pokémon (Nintendo/Game Freak/Creatures) e Habbo
  (Sulake) são obras protegidas e **não** são usados nem redesenhados pixel a pixel.
- Técnicas (grid, perspectiva 3/4, hue-shift, 9-slice, paper-doll) não são protegíveis.
- Personagens, nomes e marcas dessas obras não aparecem no projeto.
- Tudo em `assets/` é produzido por este gerador e licenciado em **CC0**.
