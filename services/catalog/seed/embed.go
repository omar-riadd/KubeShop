package seed

import _ "embed"

// ProductsJSON contains the embedded 12 seed products from Shared Contract §1.9.
//
//go:embed products.json
var ProductsJSON []byte
