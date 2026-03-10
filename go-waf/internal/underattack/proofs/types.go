package proofs

type BrowserProofs struct {
	Canvas      *CanvasProof      `json:"canvas"`
	WebGL       *WebGLProof       `json:"webgl"`
	Timing      *TimingProof      `json:"timing"`
	Performance *PerformanceProof `json:"performance"`
	CSS         *CSSProof         `json:"css"`
}

type CanvasProof struct {
	Hash       string      `json:"hash"`
	DataURL    string      `json:"dataUrl"`
	TextMetric interface{} `json:"textMetric"`
}

type WebGLProof struct {
	Vendor     string `json:"vendor"`
	Renderer   string `json:"renderer"`
	Extensions int    `json:"extensions"`
}

type TimingProof struct {
	Measurements []TimingMeasurement `json:"measurements"`
}

type TimingMeasurement struct {
	Operation string  `json:"operation"`
	Duration  float64 `json:"duration"`
}

type PerformanceProof struct {
	Tests []PerformanceTestResult `json:"tests"`
}

type PerformanceTestResult struct {
	Name     string      `json:"name"`
	Duration float64     `json:"duration"`
	Result   interface{} `json:"result"`
}

type CSSProof struct {
	Features map[string]bool `json:"features"`
}
