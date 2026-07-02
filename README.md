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
| [`docs/`](./docs) | Documentação: self-hosting, protocolo, formato de mapas, guia de assets. |
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

🚧 **Fase 1 do roadmap — mundo andável (funcional).** Já é possível entrar no lobby
com um nome, andar com WASD/setas entre outros jogadores em tempo real, com colisão
validada no servidor (autoritativo, tick 20 Hz), predição no cliente e lista de
presença. Próximo marco: Fase 2 (vídeo/áudio por proximidade). Veja o
[roadmap na especificação](./ESPECIFICACAO.md#10-roadmap-de-implementação).

Os assets placeholder (tileset, avatar, mapa lobby) são gerados por código:
`cd backend && go run ./cmd/genassets` (já commitados; CC0).

## Licença

Código sob [MIT](./LICENSE). Assets gráficos próprios sob CC0 (ver manifestos em `assets/`).
