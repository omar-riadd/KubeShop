package platform

import (
	"context"
	"net/http"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

// InitTracing configures OpenTelemetry tracing with W3C TraceContext propagation.
// The OTLP gRPC exporter is only enabled when OTEL_EXPORTER_OTLP_ENDPOINT is set.
func InitTracing(ctx context.Context, cfg Config) (func(context.Context) error, error) {
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	if cfg.OTLPEndpoint == "" {
		return func(context.Context) error { return nil }, nil
	}

	endpoint := strings.TrimPrefix(strings.TrimPrefix(cfg.OTLPEndpoint, "http://"), "https://")
	opts := []otlptracegrpc.Option{
		otlptracegrpc.WithEndpoint(endpoint),
	}
	if !strings.HasPrefix(cfg.OTLPEndpoint, "https://") {
		opts = append(opts, otlptracegrpc.WithInsecure())
	}

	exp, err := otlptracegrpc.New(ctx, opts...)
	if err != nil {
		return nil, err
	}

	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(cfg.OTELServiceName),
			semconv.ServiceVersion(cfg.AppVersion),
			semconv.DeploymentEnvironment(cfg.AppEnv),
		),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)

	return tp.Shutdown, nil
}

// NewHTTPClient returns an http.Client instrumented with otelhttp for trace propagation.
func NewHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout:   timeout,
		Transport: otelhttp.NewTransport(http.DefaultTransport),
	}
}
