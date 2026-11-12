# PixelRooms

Escritório virtual open source com gráficos 2D pixelados, inspirado no Gather Town.
Avatares pixelados, conversa por vídeo/áudio por proximidade, áreas privadas, portais
e objetos interativos — tudo self-hosted.

> 📋 A especificação completa do projeto (requisitos, gráficos, protocolo, roadmap)
> está em [ESPECIFICACAO.md](./ESPECIFICACAO.md). Ela é a fonte de verdade.

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| [`backend/`](./backend) | Servidor em **Go**: API REST, game server (WebSocket, tick 20 Hz), integração com o SFU. |
| [`frontend/`](./frontend) | Cliente web em **TypeScript**: Phaser 3 (mundo) + React (UI), Vite. |
| [`proto/`](./proto) | Schema **Protobuf** do protocolo em tempo real, compartilhado entre backend e frontend. |
| [`assets/`](./assets) | Assets embutidos (tilesets, camadas de avatar, objetos, mapas template) — todos com licença registrada em manifesto. |
| [`docs/`](./docs) | Documentação: self-hosting, protocolo, formato de mapas, guia de assets, estilo gráfico. |
| [`.github/`](./.github) | CI (lint, testes, build). |

## Desenvolvimento

Pré-requisitos: Go 1.24+, Node 20+, Docker.

```bash
# infra de desenvolvimento (Postgres + Redis)
docker compose up -d postgres redis

# backend (porta 8080)
cd backend && go run ./cmd/pixelrooms

# frontend (porta 5173, com proxy para o backend)
cd frontend && npm install && npm run dev
```

Ou use o Makefile: `make dev-infra`, `make backend`, `make frontend`.

## Status

🚧 **Fase 3 do roadmap — MVP social (em andamento).** O que já funciona, tomando o
Gather Town como referência:

- **Mundo andável** (Fase 1): lobby Tiled, WASD/setas, servidor autoritativo a 20 Hz,
  predição no cliente, y-sorting, portais.
- **Clique-para-andar**: clique no chão e o avatar traça o caminho (BFS) até lá.
- **Vídeo/áudio por proximidade** (Fase 2, LiveKit): conecta a ≤ 5 tiles com fade por
  distância, **áreas privadas** (tapete roxo) e **spotlight** (palco vermelho: quem sobe é
  ouvido pelo mapa inteiro). Indicador de quem está falando e de microfone mudo.
- **Avatar por camadas** (pele, roupa, cabelo) com seletor no onboarding; o servidor valida
  as escolhas. Nome e avatar ficam salvos no navegador.
- **Chat de texto** com escopos *Perto* (mesmo grupo de conversa) e *Mapa*, links
  clicáveis, contador de não lidas e rate limit no servidor.
- **Emotes** (teclas 1–6 ou barra inferior) sobre a cabeça do avatar; o ❓ persiste até
  limpar (0).
- **Objetos interativos** (camada `Interactables` do Tiled): quadro branco (Excalidraw),
  TV (vídeo embutido), mural (nota), pôster (imagem) e link externo. O objeto ao alcance
  ganha realce e abre com **X**; iframes rodam em `sandbox`.
- **Painéis**: participantes online (com status "na conversa"/"no palco"), atalhos (**?**).

Próximos passos da Fase 3: moderação básica (kick/ban/papéis), contas e persistência de
espaços. Veja o [roadmap na especificação](./ESPECIFICACAO.md#10-roadmap-de-implementação).

Para testar a mídia localmente suba o SFU junto: `docker compose up -d livekit`.

Toda a arte (tileset, camadas de avatar, pôster, mapa lobby) é **original e gerada por
código** a partir de ASCII art: `cd backend && go run ./cmd/genassets` (já commitada; CC0).
O estilo — análise técnica de Gather, Pokémon GBA e Habbo e as regras adotadas (16 px
ampliado 2×, paleta com hue-shift, contorno tingido, perspectiva 3/4, 9-slice) — está em
[docs/art-style.md](./docs/art-style.md).

### Atalhos

| Tecla | Ação |
|---|---|
| WASD / setas, clique | andar |
| X | interagir com o objeto realçado |
| 1–6 / 0 | emotes / limpar emote |
| Enter, C | abrir chat / alternar chat |
| P | participantes |
| M / V | microfone / câmera |
| ? | ajuda com todos os atalhos |

## Licença

Código sob [MIT](./LICENSE). Assets gráficos próprios sob CC0 (ver manifestos em `assets/`).
