package storage

import (
	"sync"
)

type MemoryStorage struct {
	mu   sync.RWMutex
	data []BanInfo
}

func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{}
}

func (s *MemoryStorage) Load() ([]BanInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]BanInfo, len(s.data))
	copy(result, s.data)
	return result, nil
}

func (s *MemoryStorage) Save(newItems, oldItems []BanInfo) error {
	merged := mergeBanLists(oldItems, newItems)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = merged
	return nil
}

func mergeBanLists(oldItems, newItems []BanInfo) []BanInfo {
	merged := make(map[string]BanInfo)
	for _, item := range oldItems {
		merged[item.IP] = item
	}
	for _, item := range newItems {
		merged[item.IP] = item
	}
	result := make([]BanInfo, 0, len(merged))
	for _, item := range merged {
		result = append(result, item)
	}
	return result
}
