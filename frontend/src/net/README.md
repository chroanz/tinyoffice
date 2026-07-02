# src/net

Cliente do protocolo em tempo real (Fase 1):

- Conexão WebSocket com reconexão automática e backoff (RNF-07).
- Codec Protobuf gerado a partir de `proto/pixelrooms/v1/messages.proto`
  (saída em `src/net/pb/`, ignorada no git e gerada via `make proto`).
- Fila de intenções com `seq` e reconciliação de predição.
