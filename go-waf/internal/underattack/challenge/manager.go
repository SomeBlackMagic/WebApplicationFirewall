package challenge

import (
	"crypto/rand"
	"encoding/hex"
	"math/big"
	mrand "math/rand"
	"sync"
	"time"

	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

type Manager struct {
	mu        sync.Mutex
	solutions map[string]*ChallengeSolution
	logger    *logging.Logger
	stopCh    chan struct{}
}

func NewManager(logger *logging.Logger) *Manager {
	m := &Manager{
		solutions: make(map[string]*ChallengeSolution),
		logger:    logger.WithCategory("app.UnderAttack.ChallengeManager"),
		stopCh:    make(chan struct{}),
	}

	go m.cleanupLoop()
	return m
}

func (m *Manager) GenerateChallengeProblem(clientIP, requestID string) *ChallengeProblem {
	idBytes := make([]byte, 16)
	rand.Read(idBytes)
	challengeID := hex.EncodeToString(idBytes)

	saltBytes := make([]byte, 8)
	rand.Read(saltBytes)
	proofSalt := hex.EncodeToString(saltBytes)

	seed := mrand.Intn(1000000)
	iterations := 1000 + mrand.Intn(2000)
	multiplier := 1103515245
	addend := 12345
	modulus := 2147483647

	// Calculate expected result using LCG
	expectedResult := seed
	for i := 0; i < iterations; i++ {
		expectedResult = (expectedResult*multiplier + addend) % modulus
	}

	m.mu.Lock()
	m.solutions[challengeID] = &ChallengeSolution{
		Result:    expectedResult,
		ProofSalt: proofSalt,
		Timestamp: time.Now().UnixMilli(),
	}
	m.mu.Unlock()

	m.logger.Debug("Generated challenge", "id", challengeID, "clientIp", clientIP, "requestId", requestID)

	return &ChallengeProblem{
		ID:         challengeID,
		Seed:       seed,
		Iterations: iterations,
		Multiplier: multiplier,
		Addend:     addend,
		Modulus:    modulus,
		ProofSalt:  proofSalt,
	}
}

func (m *Manager) ValidateAndGetChallenge(solution *ChallengeClientSolution) *ChallengeSolution {
	if solution == nil || solution.ID == "" {
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	stored, ok := m.solutions[solution.ID]
	if !ok {
		m.logger.Debug("Challenge not found", "id", solution.ID)
		return nil
	}

	// Check time (5 min max)
	if time.Now().UnixMilli()-stored.Timestamp > 300000 {
		m.logger.Debug("Challenge expired", "id", solution.ID)
		delete(m.solutions, solution.ID)
		return nil
	}

	delete(m.solutions, solution.ID)

	if stored.Result != solution.Solution {
		m.logger.Debug("Invalid challenge solution", "id", solution.ID)
		return nil
	}

	return stored
}

func (m *Manager) Stop() {
	close(m.stopCh)
}

func (m *Manager) cleanupLoop() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.cleanup()
		case <-m.stopCh:
			return
		}
	}
}

func (m *Manager) cleanup() {
	fiveMinAgo := time.Now().UnixMilli() - 300000

	m.mu.Lock()
	defer m.mu.Unlock()

	for id, sol := range m.solutions {
		if sol.Timestamp < fiveMinAgo {
			delete(m.solutions, id)
		}
	}

	m.logger.Debug("Challenge cleanup completed", "remaining", len(m.solutions))
}

// Ensure big is used (for potential future use with crypto)
var _ = big.NewInt
