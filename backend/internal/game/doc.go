// Package game contém o núcleo autoritativo do mundo (ESPECIFICACAO.md §6.2):
// Room (1 goroutine por mapa ativo, loop de simulação a 20 Hz), Player,
// validação de colisão e movimento, cálculo de grupos de proximidade,
// áreas privadas, portais e spotlight. O estado de uma sala só é tocado
// pela goroutine da própria sala — sem mutex no hot path.
package game
