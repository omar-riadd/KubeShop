package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/kubeshop/kubeshop-platform/services/cart/internal"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg, err := platform.LoadConfig("cart")
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

	redisAddr := platform.EnvOrDefault("REDIS_ADDR", "localhost:6379")
	redisPassword := os.Getenv("REDIS_PASSWORD")
	catalogBaseURL := platform.EnvOrDefault("CATALOG_BASE_URL", "http://localhost:8081")

	rdb := redis.NewClient(&redis.Options{
		Addr:         redisAddr,
		Password:     redisPassword,
		DialTimeout:  2 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})
	defer func() { _ = rdb.Close() }()

	store := internal.NewStore(rdb)
	catalogClient := internal.NewHTTPCatalogClient(catalogBaseURL, nil)

	reg := platform.NewRegistry()
	metrics := platform.NewHTTPMetrics(reg, cfg.ServiceName)
	router := platform.NewRouter(cfg, logger, metrics)

	handler := internal.NewHandler(store, catalogClient, cfg, logger, reg)
	handler.RegisterRoutes(router)

	if err := platform.RunServers(cfg, logger, router, reg, store.Ping); err != nil {
		logger.Error("server exited with error", slog.String("error", err.Error()))
		os.Exit(1)
	}
}
