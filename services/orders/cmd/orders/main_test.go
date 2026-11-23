package main

import (
	"strings"
	"testing"
)

func TestDefaultDatabaseURLRequiresSSL(t *testing.T) {
	if !strings.Contains(defaultDatabaseURL, "sslmode=require") {
		t.Fatalf("expected defaultDatabaseURL to require SSL, got %q", defaultDatabaseURL)
	}
	if strings.Contains(defaultDatabaseURL, "sslmode=disable") {
		t.Fatalf("defaultDatabaseURL must not disable SSL: %q", defaultDatabaseURL)
	}
}

func TestToPGX5Scheme(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"postgres://localhost:5432/kubeshop?sslmode=require", "pgx5://localhost:5432/kubeshop?sslmode=require"},
		{"postgresql://localhost:5432/kubeshop?sslmode=require", "pgx5://localhost:5432/kubeshop?sslmode=require"},
		{"pgx5://localhost:5432/kubeshop?sslmode=require", "pgx5://localhost:5432/kubeshop?sslmode=require"},
	}
	for _, tc := range cases {
		if got := toPGX5Scheme(tc.in); got != tc.want {
			t.Errorf("toPGX5Scheme(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
