# assets/

Assets gráficos embutidos do PixelRooms. **Regra inegociável (RNF-18):** nada entra
aqui sem entrada no `manifest.json` da categoria com `license` e `author` preenchidos.
Licenças aceitas: CC0 (preferida) e CC-BY. Especificação de dimensões e formatos em
[ESPECIFICACAO.md §5](../ESPECIFICACAO.md#5-especificação-gráfica--pixel-art-tiles-e-sprites).

| Pasta | Conteúdo | Formato |
|---|---|---|
| `avatars/{body,bottom,top,hair}/` | Camadas do avatar (paper-doll), geradas por `cmd/genassets` | Spritesheet 192×256 px, frames 32×64 (6 colunas × 4 direções) |
| `ui/` | Emotes em pixel art (ícones 24×24 e balões 32×36) | Sheet horizontal, ordem das teclas 1–6 |
| `tilesets/` | Tilesets de cenário | PNG, grid 32×32, margin/spacing 0 |
| `objects/` | Sprites de objetos interativos | PNG, múltiplos de 32 px |
| `maps/templates/` | Mapas template | Tiled JSON (.tmj), camadas da §5.6 |
