# Protocolo em tempo real

A fonte de verdade do schema é [`proto/pixelrooms/v1/messages.proto`](../proto/pixelrooms/v1/messages.proto);
as regras de comportamento (servidor autoritativo, deltas por tick, heartbeat, grupos de
mídia) estão em [ESPECIFICACAO.md §7](../ESPECIFICACAO.md#7-protocolo-de-comunicação-em-tempo-real).

> **Nota da Fase 1:** o transporte atual é **JSON sobre WebSocket** com os mesmos
> formatos de mensagem do `.proto` (ver `backend/internal/protocol` e
> `frontend/src/net/messages.ts`). A migração para Protobuf binário é uma troca de
> codec no `backend/internal/ws` / `frontend/src/net`, sem mudança de semântica.

## Fluxo implementado

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

## Mídia (Fase 2)

6. No `join_ack` e a cada mudança de grupo, o servidor envia `media` com as credenciais do
   SFU (`url`, `token`), `hear` (ids que este cliente deve assinar), `areaId` (área privada
   atual), `spotlights` (quem está em tile spotlight — ouvido por todos, a volume cheio) e
   `spotlight` (se o próprio cliente está no palco). O cliente **só assina** quem está em
   `hear`; o servidor é a única fonte de verdade dos grupos.

## Social (Fase 3)

7. `join` aceita `avatar: {body, hair, top}`; o servidor valida contra o catálogo
   (`backend/internal/game/avatar.go`) e devolve o avatar normalizado em `PlayerState.avatar`.
8. `{"type":"chat","scope":"nearby|map","text":"..."}` — o servidor sanitiza (texto plano,
   ≤ 500 caracteres), aplica cooldown de 400 ms por jogador e entrega
   `{"type":"chat","playerId","name","scope","text","at"}`:
   - `map`: a todos na sala (inclusive o autor);
   - `nearby`: ao autor + quem está no mesmo grupo de mídia (`hear`), ou seja, quem o
     ouviria falar.
9. `{"type":"emote","emote":"wave|heart|party|thumbsup|question|laugh|clear"}` — validado e
   retransmitido a todos como `{"type":"emote","playerId","emote"}` (cooldown 250 ms).
