package game

import "pixelrooms/backend/internal/protocol"

// Opções de avatar aceitas pelo servidor (RF-AVATAR-01). Os ids casam com
// os sheets gerados por cmd/genassets e listados em assets/avatars/manifest.json.
// Valores desconhecidos caem no padrão — o cliente nunca decide o que é válido.
var (
	AvatarBodies = []string{"light", "medium", "dark"}
	AvatarHairs  = []string{"brown", "black", "blonde", "red", "blue"}
	AvatarTops   = []string{"blue", "green", "red", "yellow", "purple", "white"}
)

// DefaultAvatar é usado quando o cliente não manda avatar ou manda inválido.
var DefaultAvatar = protocol.Avatar{Body: "light", Hair: "brown", Top: "blue"}

// normalizeAvatar devolve um avatar válido a partir da escolha do cliente.
func normalizeAvatar(a *protocol.Avatar) protocol.Avatar {
	out := DefaultAvatar
	if a == nil {
		return out
	}
	if contains(AvatarBodies, a.Body) {
		out.Body = a.Body
	}
	if contains(AvatarHairs, a.Hair) {
		out.Hair = a.Hair
	}
	if contains(AvatarTops, a.Top) {
		out.Top = a.Top
	}
	return out
}

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}
