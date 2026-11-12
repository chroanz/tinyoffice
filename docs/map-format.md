# Formato de mapas (Tiled)

Mapas são Tiled JSON (`.tmj`), ortogonais, tiles 32×32. Convenções de camadas e
efeitos de tile em [ESPECIFICACAO.md §5.5–5.6](../ESPECIFICACAO.md#55-efeitos-de-tile-camada-lógica).
O compilador em `backend/internal/maps` valida e converte o `.tmj` para o formato interno
de runtime; o cliente lê o mesmo arquivo para renderizar e prever colisão.

## Camadas

| Camada | Tipo | Uso |
|---|---|---|
| `Ground` | tile layer | pisos |
| `Objects` | tile layer | móveis/decoração na altura do avatar |
| `Above` | tile layer | sempre acima dos avatares |
| `Effects` | object layer | efeitos de tile (abaixo) |
| `Interactables` | object layer | objetos interativos (abaixo) |

As coordenadas dos objetos são em **pixels**; cada retângulo cobre todos os tiles que toca.

## `Effects` — propriedade `effect`

| `effect` | Propriedades extras | Semântica |
|---|---|---|
| `impassable` | — | bloqueia movimento |
| `spawn` | — | ponto de entrada (vários → sorteio) |
| `private` | `areaId` (string) | quem está dentro só ouve/vê quem está na mesma área |
| `spotlight` | — | o ocupante é ouvido por todo o mapa |
| `portal` | `targetX`, `targetY` (int) | teleporta ao pisar (o destino não pode ser outro portal) |

## `Interactables`

| Propriedade | Obrigatória | Descrição |
|---|---|---|
| `objectId` | sim | id único no mapa |
| `type` | sim | `iframe`, `video`, `image`, `note` ou `link` |
| `title` | não | nome mostrado na dica "X" e no modal (padrão: `objectId`) |
| `url` | para iframe/video/image/link | `http(s)://…` absoluta ou caminho same-origin (`/assets/…`) |
| `text` | para note | texto da nota (quebras de linha preservadas) |
| `range` | não | distância (Chebyshev, em tiles) para interagir; padrão 1 |

Objetos interativos normalmente também recebem um retângulo `impassable` em `Effects`
(o jogador interage de um tile adjacente). O mapa `assets/maps/templates/lobby.tmj`
(gerado por `backend/cmd/genassets`) é o exemplo de referência: quadro branco, TV, mural,
pôster e link.
