# Protocolo em tempo real

A fonte de verdade do schema é [`proto/pixelrooms/v1/messages.proto`](../proto/pixelrooms/v1/messages.proto);
as regras de comportamento (servidor autoritativo, deltas por tick, heartbeat, grupos de
mídia) estão em [ESPECIFICACAO.md §7](../ESPECIFICACAO.md#7-protocolo-de-comunicação-em-tempo-real).

> **Nota da Fase 1:** o transporte atual é **JSON sobre WebSocket** com os mesmos
> formatos de mensagem do `.proto` (ver `backend/internal/protocol` e
> `frontend/src/net/messages.ts`). A migração para Protobuf binário é uma troca de
> codec no `backend/internal/ws` / `frontend/src/net`, sem mudança de semântica.

## Fluxo implementado (Fase 1)

1. Cliente abre `GET /ws` e envia `{"type":"join","name":"...","map":"lobby"}`
   (primeira mensagem obrigatória; 10 s de prazo).
2. Servidor responde `join_ack` com `playerId`, `mapId` e o estado completo da sala,
   e transmite `player_joined` aos demais.
3. Cliente envia `{"type":"move","dir":"up|down|left|right"}` — intenção de andar
   **1 tile**. O servidor valida colisão e cooldown (150 ms/passo) e agrega os
   resultados em `{"type":"movement","tick":N,"moves":[...]}` a cada tick (20 Hz).
   Passo rejeitado gera um move reafirmando a posição atual (reconciliação).
4. `{"type":"ping","t":...}` a cada 15 s; servidor ecoa em `pong`. Sem tráfego por
   60 s a conexão é encerrada.
5. Desconexão gera `player_left` para os demais.
