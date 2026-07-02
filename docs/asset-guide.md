# Guia de criação de assets

Como criar sprites e tilesets compatíveis com o PixelRooms. Especificação completa
em [ESPECIFICACAO.md §5](../ESPECIFICACAO.md#5-especificação-gráfica--pixel-art-tiles-e-sprites).

Essenciais:

- **Tiles**: 32×32 px, PNG-24 com alfa, sem margin/spacing no tileset.
- **Avatar**: frames de 32×64 px na grade 6×5 (idle 2 + walk 4; linhas down/up/left/right/sit);
  camadas paper-doll alinhadas pixel a pixel na mesma grade.
- **Objetos**: dimensões múltiplas de 32, âncora centro-inferior, footprint no manifesto.
- **Licença**: toda contribuição precisa de `license` (CC0/CC-BY) e `author` no manifesto
  da categoria em `assets/`.
