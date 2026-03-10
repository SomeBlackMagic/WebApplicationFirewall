package challenge

type ChallengeProblem struct {
	ID         string `json:"id"`
	Seed       int    `json:"seed"`
	Iterations int    `json:"iterations"`
	Multiplier int    `json:"multiplier"`
	Addend     int    `json:"addend"`
	Modulus    int    `json:"modulus"`
	ProofSalt  string `json:"proofSalt"`
}

type ChallengeSolution struct {
	Result    int    `json:"result"`
	ProofSalt string `json:"proofSalt"`
	Timestamp int64  `json:"timestamp"`
}

type ChallengeClientSolution struct {
	ID       string `json:"id"`
	Solution int    `json:"solution"`
}
