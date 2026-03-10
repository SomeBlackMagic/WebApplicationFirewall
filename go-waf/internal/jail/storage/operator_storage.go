package storage

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

type OperatorStorage struct {
	apiHost string
	agentID string
	client  *http.Client
	logger  *logging.Logger
}

func NewOperatorStorage(apiHost, agentID string, logger *logging.Logger) *OperatorStorage {
	return &OperatorStorage{
		apiHost: apiHost,
		agentID: agentID,
		client:  &http.Client{Timeout: 30 * time.Second},
		logger:  logger,
	}
}

func (s *OperatorStorage) Load() ([]BanInfo, error) {
	url := fmt.Sprintf("%s/agent/banned/load?agentId=%s", s.apiHost, s.agentID)

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		resp, err := s.client.Get(url)
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(1<<uint(attempt)) * time.Second)
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("server error: %s", resp.Status)
			time.Sleep(time.Duration(1<<uint(attempt)) * time.Second)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		var items []BanInfo
		if err := json.Unmarshal(body, &items); err != nil {
			return nil, err
		}
		return items, nil
	}

	s.logger.Error("cannot load IPs from operator", "error", lastErr)
	return nil, lastErr
}

func (s *OperatorStorage) Save(newItems, oldItems []BanInfo) error {
	url := fmt.Sprintf("%s/agent/banned/update?agentId=%s", s.apiHost, s.agentID)

	data, err := json.Marshal(newItems)
	if err != nil {
		return err
	}

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		resp, err := s.client.Post(url, "application/json", bytes.NewReader(data))
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(1<<uint(attempt)) * time.Second)
			continue
		}
		resp.Body.Close()

		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("server error: %s", resp.Status)
			time.Sleep(time.Duration(1<<uint(attempt)) * time.Second)
			continue
		}
		return nil
	}

	s.logger.Error("cannot save banned IPs to operator", "error", lastErr)
	return lastErr
}
