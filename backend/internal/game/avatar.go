package game

import (
	"slices"

	"pixelrooms/backend/internal/protocol"
)

// Opções de avatar aceitas pelo servidor (RF-AVATAR-01). As listas válidas
// (AvatarBodies, AvatarBottoms, AvatarTops, AvatarHairs, AvatarHats, AvatarBags) são geradas por
// cmd/genassets junto com os sheets, em avatar_catalog_gen.go. Valores
// desconhecidos caem no padrão — o cliente nunca decide o que é válido.

// DefaultAvatar é usado quando o cliente não manda avatar ou manda inválido.
var DefaultAvatar = protocol.Avatar{Body: "tone2", Bottom: "pants-denim", Top: "tee-blue", Hair: "short-brown", Hat: "none", Bag: "none"}

// normalizeAvatar devolve um avatar válido a partir da escolha do cliente.
func normalizeAvatar(a *protocol.Avatar) protocol.Avatar {
	out := DefaultAvatar
	if a == nil {
		return out
	}
	if slices.Contains(AvatarBodies, a.Body) {
		out.Body = a.Body
	}
	if slices.Contains(AvatarBottoms, a.Bottom) {
		out.Bottom = a.Bottom
	}
	if slices.Contains(AvatarTops, a.Top) {
		out.Top = a.Top
	}
	if slices.Contains(AvatarHairs, a.Hair) {
		out.Hair = a.Hair
	}
	if slices.Contains(AvatarHats, a.Hat) {
		out.Hat = a.Hat
	}
	if slices.Contains(AvatarBags, a.Bag) {
		out.Bag = a.Bag
	}
	return out
}
