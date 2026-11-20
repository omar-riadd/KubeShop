package platform

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds shared service configuration loaded strictly from environment variables.
type Config struct {
	ServiceName     string
	AppEnv          string
	AppVersion      string
	AppGitSHA       string
	AppBuildTime    string
	PodName         string
	HTTPPort        int
	AdminPort       int
	LogLevel        string
	OTLPEndpoint    string
	OTELServiceName string
	FaultErrorRate  float64
	FaultLatencyMs  int
	ShutdownDelay   time.Duration
}

// LoadConfig reads and validates common environment variables for a service.
func LoadConfig(serviceName string) (Config, error) {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = serviceName + "-local"
	}

	cfg := Config{
		ServiceName:     serviceName,
		AppEnv:          envOrDefault("APP_ENV", "local"),
		AppVersion:      envOrDefault("APP_VERSION", "dev"),
		AppGitSHA:       envOrDefault("APP_GIT_SHA", "local"),
		AppBuildTime:    os.Getenv("APP_BUILD_TIME"),
		PodName:         envOrDefault("POD_NAME", hostname),
		LogLevel:        strings.ToLower(envOrDefault("LOG_LEVEL", "info")),
		OTLPEndpoint:    strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")),
		OTELServiceName: envOrDefault("OTEL_SERVICE_NAME", serviceName),
	}

	switch cfg.AppEnv {
	case "local", "dev", "staging", "prod":
	default:
		return Config{}, fmt.Errorf("invalid APP_ENV %q: must be one of local, dev, staging, prod", cfg.AppEnv)
	}

	httpPort, err := parsePort("HTTP_PORT", 8080)
	if err != nil {
		return Config{}, err
	}
	cfg.HTTPPort = httpPort

	adminPort, err := parsePort("ADMIN_PORT", 9090)
	if err != nil {
		return Config{}, err
	}
	cfg.AdminPort = adminPort

	if v := os.Getenv("FAULT_ERROR_RATE"); v != "" {
		rate, err := strconv.ParseFloat(v, 64)
		if err != nil || rate < 0 || rate > 1 {
			return Config{}, fmt.Errorf("invalid FAULT_ERROR_RATE %q: must be in [0, 1]", v)
		}
		cfg.FaultErrorRate = rate
	}

	if v := os.Getenv("FAULT_LATENCY_MS"); v != "" {
		ms, err := strconv.Atoi(v)
		if err != nil || ms < 0 {
			return Config{}, fmt.Errorf("invalid FAULT_LATENCY_MS %q: must be >= 0", v)
		}
		cfg.FaultLatencyMs = ms
	}

	delayStr := envOrDefault("SHUTDOWN_DELAY", "5s")
	delay, err := time.ParseDuration(delayStr)
	if err != nil || delay < 0 {
		return Config{}, fmt.Errorf("invalid SHUTDOWN_DELAY %q", delayStr)
	}
	cfg.ShutdownDelay = delay

	return cfg, nil
}

// EnvOrDefault returns the environment variable value or fallback if unset/empty.
func EnvOrDefault(key, fallback string) string {
	return envOrDefault(key, fallback)
}

func envOrDefault(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func parsePort(key string, fallback int) (int, error) {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback, nil
	}
	p, err := strconv.Atoi(v)
	if err != nil || p < 1 || p > 65535 {
		return 0, fmt.Errorf("invalid %s %q: must be 1-65535", key, v)
	}
	return p, nil
}
