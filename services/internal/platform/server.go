package platform

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// VersionResponse matches the Shared Contract §1.7 Version schema.
type VersionResponse struct {
	Service     string `json:"service"`
	Version     string `json:"version"`
	GitSHA      string `json:"gitSha"`
	BuildTime   string `json:"buildTime"`
	Environment string `json:"environment"`
	PodName     string `json:"podName"`
}

// VersionHandler returns an http.HandlerFunc serving GET /api/<svc>/version.
func VersionHandler(cfg Config) http.HandlerFunc {
	resp := VersionResponse{
		Service:     cfg.ServiceName,
		Version:     cfg.AppVersion,
		GitSHA:      cfg.AppGitSHA,
		BuildTime:   cfg.AppBuildTime,
		Environment: cfg.AppEnv,
		PodName:     cfg.PodName,
	}
	return func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, resp)
	}
}

// NewRegistry creates a Prometheus registry with Go and process collectors registered.
func NewRegistry() *prometheus.Registry {
	reg := prometheus.NewRegistry()
	reg.MustRegister(
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)
	return reg
}

// ReadyCheck checks whether a service dependency is healthy.
type ReadyCheck func(ctx context.Context) error

// NewAdminMux builds the admin HTTP mux serving /healthz, /readyz, and /metrics.
func NewAdminMux(reg prometheus.Gatherer, readyFlag *atomic.Bool, check ReadyCheck) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok\n"))
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if !readyFlag.Load() {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte("shutting down\n"))
			return
		}
		if check != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := check(ctx); err != nil {
				w.Header().Set("Content-Type", "text/plain; charset=utf-8")
				w.WriteHeader(http.StatusServiceUnavailable)
				_, _ = w.Write([]byte("not ready\n"))
				return
			}
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok\n"))
	})
	mux.Handle("GET /metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{}))
	return mux
}

// RunServers starts the API and admin HTTP servers and handles graceful shutdown on SIGTERM/SIGINT.
func RunServers(cfg Config, logger *slog.Logger, apiHandler http.Handler, reg prometheus.Gatherer, readyCheck ReadyCheck) error {
	var ready atomic.Bool
	ready.Store(true)

	apiSrv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:           apiHandler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	adminSrv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.AdminPort),
		Handler:           NewAdminMux(reg, &ready, readyCheck),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 2)
	go func() {
		logger.Info("starting api server", slog.Int("port", cfg.HTTPPort))
		if err := apiSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- fmt.Errorf("api server: %w", err)
		}
	}()
	go func() {
		logger.Info("starting admin server", slog.Int("port", cfg.AdminPort))
		if err := adminSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- fmt.Errorf("admin server: %w", err)
		}
	}()

	sigCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	select {
	case err := <-errCh:
		return err
	case <-sigCtx.Done():
		logger.Info("shutdown signal received; marking not-ready", slog.Duration("delay", cfg.ShutdownDelay))
		ready.Store(false)
		if cfg.ShutdownDelay > 0 {
			time.Sleep(cfg.ShutdownDelay)
		}
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		var errs []error
		if err := apiSrv.Shutdown(shutdownCtx); err != nil {
			errs = append(errs, fmt.Errorf("api shutdown: %w", err))
		}
		if err := adminSrv.Shutdown(shutdownCtx); err != nil {
			errs = append(errs, fmt.Errorf("admin shutdown: %w", err))
		}
		return errors.Join(errs...)
	}
}
