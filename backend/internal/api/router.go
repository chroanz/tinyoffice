// Package api expõe o roteador HTTP do servidor: health checks (RNF-10)
// e os endpoints REST versionados em /api/v1 (auth, spaces, maps, assets).
package api

import (
	"encoding/json"
	"net/http"
)

// Version é sobrescrita no build via -ldflags.
var Version = "0.0.1-dev"

func NewRouter() http.Handler {
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

	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
