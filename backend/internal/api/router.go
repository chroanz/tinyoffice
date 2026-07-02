// Package api expõe o roteador HTTP do servidor: health checks (RNF-10),
// endpoints REST versionados em /api/v1, o endpoint /ws do mundo em tempo
// real e os assets estáticos (/assets).
package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"pixelrooms/backend/internal/game"
	"pixelrooms/backend/internal/ws"
)

// Version é sobrescrita no build via -ldflags.
var Version = "0.0.1-dev"

type Deps struct {
	AssetsDir string
	Rooms     *game.Manager
}

func NewRouter(d Deps) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Passa a verificar Postgres/Redis quando o pacote store existir.
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("GET /api/v1/version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"name":    "pixelrooms",
			"version": Version,
		})
	})

	mux.HandleFunc("GET /ws", ws.Handler(d.Rooms))

	mux.Handle("GET /assets/", http.StripPrefix("/assets/", assetsHandler(d.AssetsDir)))

	return mux
}

// assetsHandler serve os assets embutidos. Arquivos .tmj (Tiled JSON) ganham
// Content-Type de JSON para o loader do Phaser.
func assetsHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, ".tmj") {
			w.Header().Set("Content-Type", "application/json")
		}
		fs.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
