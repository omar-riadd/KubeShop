package internal

import (
	"net/mail"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/kubeshop/kubeshop-platform/services/internal/platform"
)

var countryCodeRegex = regexp.MustCompile(`^[A-Z]{2}$`)

// Customer matches Shared Contract §1.7 Customer schema.
type Customer struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

// ShippingAddress matches Shared Contract §1.7 ShippingAddress schema.
type ShippingAddress struct {
	Line1      string `json:"line1"`
	Line2      string `json:"line2"`
	City       string `json:"city"`
	PostalCode string `json:"postalCode"`
	Country    string `json:"country"`
}

// OrderRequest matches Shared Contract §1.7 OrderRequest schema.
type OrderRequest struct {
	Customer        Customer        `json:"customer"`
	ShippingAddress ShippingAddress `json:"shippingAddress"`
}

// ValidateOrderRequest enforces the exact Shared Contract §1.7 validation rules.
func ValidateOrderRequest(req *OrderRequest) []platform.ErrorDetail {
	var details []platform.ErrorDetail

	req.Customer.Name = strings.TrimSpace(req.Customer.Name)
	if n := utf8.RuneCountInString(req.Customer.Name); n < 1 || n > 100 {
		details = append(details, platform.ErrorDetail{
			Field:   "customer.name",
			Message: "must be between 1 and 100 characters",
		})
	}

	req.Customer.Email = strings.TrimSpace(req.Customer.Email)
	if !isValidEmail(req.Customer.Email) {
		details = append(details, platform.ErrorDetail{
			Field:   "customer.email",
			Message: "must be a valid email address",
		})
	}

	req.ShippingAddress.Line1 = strings.TrimSpace(req.ShippingAddress.Line1)
	if n := utf8.RuneCountInString(req.ShippingAddress.Line1); n < 1 || n > 200 {
		details = append(details, platform.ErrorDetail{
			Field:   "shippingAddress.line1",
			Message: "must be between 1 and 200 characters",
		})
	}

	req.ShippingAddress.Line2 = strings.TrimSpace(req.ShippingAddress.Line2)
	if utf8.RuneCountInString(req.ShippingAddress.Line2) > 200 {
		details = append(details, platform.ErrorDetail{
			Field:   "shippingAddress.line2",
			Message: "must be at most 200 characters",
		})
	}

	req.ShippingAddress.City = strings.TrimSpace(req.ShippingAddress.City)
	if n := utf8.RuneCountInString(req.ShippingAddress.City); n < 1 || n > 100 {
		details = append(details, platform.ErrorDetail{
			Field:   "shippingAddress.city",
			Message: "must be between 1 and 100 characters",
		})
	}

	req.ShippingAddress.PostalCode = strings.TrimSpace(req.ShippingAddress.PostalCode)
	if n := utf8.RuneCountInString(req.ShippingAddress.PostalCode); n < 1 || n > 20 {
		details = append(details, platform.ErrorDetail{
			Field:   "shippingAddress.postalCode",
			Message: "must be between 1 and 20 characters",
		})
	}

	req.ShippingAddress.Country = strings.TrimSpace(req.ShippingAddress.Country)
	if !countryCodeRegex.MatchString(req.ShippingAddress.Country) {
		details = append(details, platform.ErrorDetail{
			Field:   "shippingAddress.country",
			Message: "must be a 2-letter uppercase ISO 3166-1 alpha-2 country code",
		})
	}

	return details
}

func isValidEmail(email string) bool {
	if email == "" || len(email) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email {
		return false
	}
	parts := strings.Split(email, "@")
	if len(parts) != 2 || parts[0] == "" || !strings.Contains(parts[1], ".") {
		return false
	}
	if strings.HasPrefix(parts[1], ".") || strings.HasSuffix(parts[1], ".") {
		return false
	}
	return true
}
