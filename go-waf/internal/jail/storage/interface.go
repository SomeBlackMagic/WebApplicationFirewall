package storage

type BanInfo struct {
	IP              string            `json:"ip"`
	UnbanTime       int64             `json:"unbanTime"`
	EscalationCount int               `json:"escalationCount"`
	Metadata        map[string]string `json:"metadata"`
}

type Storage interface {
	Load() ([]BanInfo, error)
	Save(newItems, oldItems []BanInfo) error
}
