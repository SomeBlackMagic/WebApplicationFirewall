package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/someblackmagic/web-application-firewall-go/internal/jail"
)

type JailHandler struct {
	manager *jail.Manager
}

func NewJailHandler(manager *jail.Manager) *JailHandler {
	return &JailHandler{manager: manager}
}

type bannedUserResponse struct {
	IP              string            `json:"ip"`
	UnbanTime       int64             `json:"unbanTime"`
	UnbanTimeISO    string            `json:"unbanTimeISO"`
	EscalationCount int               `json:"escalationCount"`
	Metadata        map[string]string `json:"metadata"`
	IsBlocked       bool              `json:"isBlocked"`
}

func (h *JailHandler) GetBannedUsers(w http.ResponseWriter, r *http.Request) {
	items := h.manager.GetAllBlockedIPs()
	now := time.Now().UnixMilli()

	result := make([]bannedUserResponse, 0, len(items))
	for _, item := range items {
		result = append(result, bannedUserResponse{
			IP:              item.IP,
			UnbanTime:       item.UnbanTime,
			UnbanTimeISO:    time.UnixMilli(item.UnbanTime).UTC().Format(time.RFC3339),
			EscalationCount: item.EscalationCount,
			Metadata:        item.Metadata,
			IsBlocked:       now < item.UnbanTime,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *JailHandler) DeleteBannedUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IP string `json:"ip"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.IP == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"msg": "ip is required"})
		return
	}

	result := h.manager.DeleteBlockedIP(body.IP)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"status": result})
}
