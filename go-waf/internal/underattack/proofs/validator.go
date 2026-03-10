package proofs

type Validator struct{}

func NewValidator() *Validator {
	return &Validator{}
}

func (v *Validator) ValidateBrowserProofs(proofs *BrowserProofs, requestID, userAgent, challengeID, proofSalt string) int {
	score := 100

	if proofs == nil {
		return 60
	}

	if proofs.Canvas == nil {
		score -= 15
	}
	if proofs.WebGL == nil {
		score -= 20
	}
	if proofs.Timing == nil {
		score -= 10
	}
	if proofs.Performance == nil {
		score -= 5
	}
	if proofs.CSS == nil {
		score -= 5
	}

	if score < 0 {
		score = 0
	}
	return score
}
