// Package config carrega a configuração do servidor a partir de variáveis de
// ambiente com prefixo PIXELROOMS_ (RNF-20), com defaults de desenvolvimento.
package config

import "os"

const (
	EnvDevelopment = "development"
	EnvProduction  = "production"
)

type Config struct {
	Addr        string // endereço HTTP, ex.: ":8080"
	Env         string // development | production
	AssetsDir   string // raiz dos assets embutidos (tilesets, avatares, mapas)
	DatabaseURL string
	RedisURL    string
	JWTSecret   string

	// LiveKit (Fase 2 — MVP de mídia)
	LiveKitURL       string
	LiveKitAPIKey    string
	LiveKitAPISecret string
}

func Load() Config {
	return Config{
		Addr:        getenv("PIXELROOMS_ADDR", ":8080"),
		Env:         getenv("PIXELROOMS_ENV", EnvDevelopment),
		AssetsDir:   getenv("PIXELROOMS_ASSETS_DIR", "../assets"),
		DatabaseURL: getenv("PIXELROOMS_DATABASE_URL", "postgres://pixelrooms:pixelrooms@localhost:5432/pixelrooms?sslmode=disable"),
		RedisURL:    getenv("PIXELROOMS_REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:   getenv("PIXELROOMS_JWT_SECRET", "dev-secret-nao-usar-em-producao"),

		// Defaults do modo dev do LiveKit (livekit-server --dev).
		// Em produção estes valores DEVEM ser sobrescritos.
		LiveKitURL:       getenv("PIXELROOMS_LIVEKIT_URL", "ws://localhost:7880"),
		LiveKitAPIKey:    getenv("PIXELROOMS_LIVEKIT_API_KEY", "devkey"),
		LiveKitAPISecret: getenv("PIXELROOMS_LIVEKIT_API_SECRET", "secret"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
