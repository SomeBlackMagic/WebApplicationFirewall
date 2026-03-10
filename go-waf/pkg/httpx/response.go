package httpx

import (
	"encoding/json"
	"net/http"
	"strings"
)

func JSONResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func HTMLResponse(w http.ResponseWriter, code int, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(code)
	w.Write([]byte(body))
}

func NegotiateRejectResponse(w http.ResponseWriter, r *http.Request, code int, jsonBody string, htmlBody string) {
	accept := r.Header.Get("Accept")
	if strings.Contains(accept, "application/json") {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(code)
		w.Write([]byte(jsonBody))
		return
	}
	HTMLResponse(w, code, htmlBody)
}
