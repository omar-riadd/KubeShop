package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"time"

	"github.com/kubeshop/kubeshop-platform/services/catalog/internal"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
)

func main() {
	cfg, err := platform.LoadConfig("catalog")
	if err != nil {
		slog.Error("invalid configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger := platform.NewLogger(cfg, os.Stdout)

	shutdownTracing, err := platform.InitTracing(context.Background(), cfg)
	if err != nil {
		logger.Error("failed to initialize tracing", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = shutdownTracing(ctx)
	}()

	store, err := internal.NewStore()
	if err != nil {
		logger.Error("failed to load catalog seed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	reg := platform.NewRegistry()
	metrics := platform.NewHTTPMetrics(reg, cfg.ServiceName)
	router := platform.NewRouter(cfg, logger, metrics)

	handler := internal.NewHandler(store, cfg)
	handler.RegisterRoutes(router)

	readyCheck := func(_ context.Context) error {
		if !store.Ready() {
			return errors.New("seed catalog not loaded")
		}
		return nil
	}

	if err := platform.RunServers(cfg, logger, router, reg, readyCheck); err != nil {
		logger.Error("server exited with error", slog.String("error", err.Error()))
		os.Exit(1)
	}
}
