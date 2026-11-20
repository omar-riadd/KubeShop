package platform

import (
	"io"
	"log/slog"
	"os"
)

// NewLogger creates a structured JSON slog.Logger with service/env/version base attributes.
func NewLogger(cfg Config, w io.Writer) *slog.Logger {
	if w == nil {
		w = os.Stdout
	}
	var level slog.Level
	switch cfg.LogLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn", "warning":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	handler := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				a.Key = "ts"
			}
			return a
		},
	})

	return slog.New(handler).With(
		slog.String("service", cfg.ServiceName),
		slog.String("env", cfg.AppEnv),
		slog.String("version", cfg.AppVersion),
	)
}
