package httpx

import "net/http"

func ExtractRequestID(r *http.Request, headerName string) string {
	if v := r.Header.Get(headerName); v != "" {
		return v
	}
	return "not-detected"
}
