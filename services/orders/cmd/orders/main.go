package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
	"github.com/kubeshop/kubeshop-platform/services/orders/internal"
	"github.com/kubeshop/kubeshop-platform/services/orders/migrations"
)

const defaultDatabaseURL = "postgres://localhost:5432/kubeshop?sslmode=require"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		if err := runMigrations(); err != nil {
			slog.Error("database migration failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
		slog.Info("database migrations applied successfully")
		return
	}

	cfg, err := platform.LoadConfig("orders")
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

	databaseURL := platform.EnvOrDefault("DATABASE_URL", defaultDatabaseURL)
	cartBaseURL := platform.EnvOrDefault("CART_BASE_URL", "http://localhost:8082")

	poolCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(poolCtx, databaseURL)
	if err != nil {
		logger.Error("failed to initialize postgres pool", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer pool.Close()

	store := internal.NewStore(pool)
	cartClient := internal.NewHTTPCartClient(cartBaseURL, nil)

	reg := platform.NewRegistry()
	metrics := platform.NewHTTPMetrics(reg, cfg.ServiceName)
	router := platform.NewRouter(cfg, logger, metrics)

	handler := internal.NewHandler(store, cartClient, cfg, logger, reg)
	handler.RegisterRoutes(router)

	if err := platform.RunServers(cfg, logger, router, reg, store.Ping); err != nil {
		logger.Error("server exited with error", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func runMigrations() error {
	dsn := platform.EnvOrDefault("DATABASE_URL", defaultDatabaseURL)
	// golang-migrate pgx/v5 driver expects the pgx5:// scheme.
	migrateDSN := toPGX5Scheme(dsn)

	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("create iofs migration source: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", src, migrateDSN)
	if err != nil {
		return fmt.Errorf("init migrate: %w", err)
	}
	defer func() { _, _ = m.Close() }()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}

func toPGX5Scheme(dsn string) string {
	switch {
	case len(dsn) >= 13 && dsn[:13] == "postgresql://":
		return "pgx5://" + dsn[13:]
	case len(dsn) >= 11 && dsn[:11] == "postgres://":
		return "pgx5://" + dsn[11:]
	default:
		return dsn
	}
}
