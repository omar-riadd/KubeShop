package migrations

import "embed"

// FS holds the embedded SQL migration files for the orders service.
//
//go:embed *.sql
var FS embed.FS
