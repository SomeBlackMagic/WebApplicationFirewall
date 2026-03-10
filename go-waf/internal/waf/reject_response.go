package waf

import (
	"net/http"

	"github.com/someblackmagic/web-application-firewall-go/internal/shared/types"
	"github.com/someblackmagic/web-application-firewall-go/pkg/httpx"
)

func CreateRejectResponse(w http.ResponseWriter, r *http.Request, mode string, httpCode *int, jsonBody, htmlBody string) {
	code := types.Deref(httpCode, 429)
	httpx.NegotiateRejectResponse(w, r, code, jsonBody, htmlBody)
}
