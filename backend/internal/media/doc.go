// Package media integra o game server ao SFU (LiveKit): emissão de tokens
// de acesso à sala de mídia de cada mapa. Os grupos de quem-ouve-quem são
// calculados pelo package game e enviados ao cliente, que ajusta as
// subscriptions. Aplicar as permissões também no lado do SFU (defesa em
// profundidade, RNF-12) fica para a sequência da Fase 2.
package media
