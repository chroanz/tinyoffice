package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pixelrooms/backend/internal/api"
	"pixelrooms/backend/internal/config"
	"pixelrooms/backend/internal/game"
)

func main() {
	cfg := config.Load()

	var handler slog.Handler = slog.NewJSONHandler(os.Stdout, nil)
	if cfg.Env == config.EnvDevelopment {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
	}
	slog.SetDefault(slog.New(handler))

	rooms := game.NewManager(cfg.AssetsDir)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.NewRouter(api.Deps{AssetsDir: cfg.AssetsDir, Rooms: rooms}),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("pixelrooms server listening", "addr", cfg.Addr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	// Desligamento gracioso (RNF-10): quando houver salas ativas, drená-las aqui
	// antes de encerrar o HTTP server.
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("graceful shutdown failed", "err", err)
	}
	slog.Info("server stopped")
}
