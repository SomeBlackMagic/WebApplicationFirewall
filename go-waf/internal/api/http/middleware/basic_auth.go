package middleware

import (
	"net/http"

	"github.com/someblackmagic/web-application-firewall-go/pkg/authx"
)

func BasicAuthMiddleware(auth *authx.BasicAuth) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return auth.Middleware(next)
	}
}

func WrapHandlerFunc(auth *authx.BasicAuth, hf http.HandlerFunc) http.Handler {
	return auth.Middleware(http.HandlerFunc(hf))
}
