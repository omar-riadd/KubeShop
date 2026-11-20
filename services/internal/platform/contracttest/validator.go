package contracttest

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"

	"github.com/pb33f/libopenapi"
	validator "github.com/pb33f/libopenapi-validator"
)

var (
	once          sync.Once
	specValidator validator.Validator
	loadErr       error
)

func getValidator(t *testing.T) validator.Validator {
	t.Helper()
	once.Do(func() {
		_, file, _, ok := runtime.Caller(0)
		if !ok {
			loadErr = os.ErrNotExist
			return
		}
		// services/internal/platform/contracttest/validator.go -> ../../../../api/openapi.yaml
		specPath := filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", "..", "api", "openapi.yaml"))
		data, err := os.ReadFile(specPath)
		if err != nil {
			loadErr = err
			return
		}
		doc, err := libopenapi.NewDocument(data)
		if err != nil {
			loadErr = err
			return
		}
		v, errs := validator.NewValidator(doc)
		if len(errs) > 0 {
			loadErr = errs[0]
			return
		}
		specValidator = v
	})
	if loadErr != nil {
		t.Fatalf("failed to load OpenAPI validator: %v", loadErr)
	}
	return specValidator
}

// AssertResponseValid validates an HTTP response against api/openapi.yaml for the given request.
func AssertResponseValid(t *testing.T, req *http.Request, resp *http.Response) {
	t.Helper()
	v := getValidator(t)

	// Buffer response body so caller can still read it after validation.
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read response body: %v", err)
	}
	resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	respCopy := *resp
	respCopy.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	valid, errs := v.ValidateHttpResponse(req, &respCopy)
	if !valid {
		for _, e := range errs {
			t.Errorf("OpenAPI contract violation on %s %s (status %d): %s (reason: %s) — body: %s",
				req.Method, req.URL.String(), resp.StatusCode, e.Message, e.Reason, string(bodyBytes))
			for _, se := range e.SchemaValidationErrors {
				t.Errorf("  schema error: %s", se.Error())
			}
		}
	}
}
