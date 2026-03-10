package authx

import (
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/someblackmagic/web-application-firewall-go/internal/config"
)

type BasicAuth struct {
	Enabled  bool
	Username string
	Password string
}

func NewBasicAuth(cfg config.HttpBasicAuthConfig) *BasicAuth {
	ba := &BasicAuth{Enabled: cfg.Enabled}
	if cfg.Username != nil {
		ba.Username = *cfg.Username
	}
	if cfg.Password != nil {
		ba.Password = *cfg.Password
	}
	return ba
}

func (ba *BasicAuth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !ba.Enabled {
			next.ServeHTTP(w, r)
			return
		}

		auth := r.Header.Get("Authorization")
		if auth == "" {
			ba.unauthorized(w)
			return
		}

		if !strings.HasPrefix(auth, "Basic ") {
			ba.unauthorized(w)
			return
		}

		decoded, err := base64.StdEncoding.DecodeString(auth[6:])
		if err != nil {
			ba.unauthorized(w)
			return
		}

		parts := strings.SplitN(string(decoded), ":", 2)
		if len(parts) != 2 || parts[0] != ba.Username || parts[1] != ba.Password {
			ba.unauthorized(w)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (ba *BasicAuth) unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", `Basic realm="WAF"`)
	http.Error(w, "Unauthorized", http.StatusUnauthorized)
}
