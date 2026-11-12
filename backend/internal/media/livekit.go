package media

import (
	"fmt"
	"time"

	"github.com/livekit/protocol/auth"
)

// LiveKit emite tokens de acesso ao SFU. O game server decide quem deve
// ouvir quem; o cliente usa o token apenas para entrar na sala de mídia
// do mapa e publicar seus tracks.
type LiveKit struct {
	url       string // URL pública do SFU para os clientes (ws://...)
	apiKey    string
	apiSecret string
}

func NewLiveKit(url, apiKey, apiSecret string) (*LiveKit, error) {
	if url == "" || apiKey == "" || apiSecret == "" {
		return nil, fmt.Errorf("configuração do LiveKit incompleta (url/key/secret)")
	}
	return &LiveKit{url: url, apiKey: apiKey, apiSecret: apiSecret}, nil
}

// MediaToken implementa game.MediaTokenMinter.
func (l *LiveKit) MediaToken(room, identity, name string) (string, string, error) {
	grant := &auth.VideoGrant{RoomJoin: true, Room: room}
	token, err := auth.NewAccessToken(l.apiKey, l.apiSecret).
		SetIdentity(identity).
		SetName(name).
		SetVideoGrant(grant).
		SetValidFor(12 * time.Hour).
		ToJWT()
	if err != nil {
		return "", "", err
	}
	return l.url, token, nil
}
