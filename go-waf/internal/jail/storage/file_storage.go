package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

type FileStorage struct {
	filePath string
	mu       sync.Mutex
	logger   *logging.Logger
}

func NewFileStorage(filePath string, logger *logging.Logger) *FileStorage {
	if filePath == "" {
		filePath = "data/blocked_ips.json"
	}
	return &FileStorage{
		filePath: filePath,
		logger:   logger,
	}
}

func (s *FileStorage) Load() ([]BanInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		if err := os.WriteFile(s.filePath, []byte("[]"), 0644); err != nil {
			return nil, err
		}
	}

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		s.logger.Error("cannot open file with jail IP", "error", err)
		return []BanInfo{}, nil
	}

	var items []BanInfo
	if err := json.Unmarshal(data, &items); err != nil {
		s.logger.Error("cannot parse jail IP file", "error", err)
		return []BanInfo{}, nil
	}

	return items, nil
}

func (s *FileStorage) Save(newItems, oldItems []BanInfo) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	merged := mergeBanLists(oldItems, newItems)
	data, err := json.MarshalIndent(merged, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}
