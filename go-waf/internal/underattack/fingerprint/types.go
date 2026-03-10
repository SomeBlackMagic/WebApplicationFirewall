package fingerprint

type BrowserFingerprint struct {
	UserAgent        string            `json:"userAgent"`
	Language         string            `json:"language"`
	Languages        []string          `json:"languages"`
	Platform         string            `json:"platform"`
	CookiesEnabled   bool              `json:"cookiesEnabled"`
	ScreenResolution *ScreenResolution `json:"screenResolution"`
	Timezone         *int              `json:"timezone"`
	CanvasFingerprint *CanvasFingerprint `json:"canvasFingerprint"`
	WebGLVendor      string            `json:"webglVendor"`
	Plugins          []Plugin          `json:"plugins"`
	Fonts            []string          `json:"fonts"`
	Webdriver        bool              `json:"webdriver"`
	Extensions       []interface{}     `json:"extensions"`
	BrowserProofs    *BrowserProofs    `json:"browserProofs"`
}

type ScreenResolution struct {
	Width      int `json:"width"`
	Height     int `json:"height"`
	ColorDepth int `json:"colorDepth"`
	PixelDepth int `json:"pixelDepth"`
}

type CanvasFingerprint struct {
	Winding bool `json:"winding"`
}

type Plugin struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	MimeTypes   []MimeType `json:"mimeTypes"`
}

type MimeType struct {
	Type     string `json:"type"`
	Suffixes string `json:"suffixes"`
}

type BrowserProofs struct {
	Canvas      *CanvasProof      `json:"canvas"`
	WebGL       *WebGLProof       `json:"webgl"`
	Timing      *TimingProof      `json:"timing"`
	Performance *PerformanceProof `json:"performance"`
	CSS         *CSSProof         `json:"css"`
}

type CanvasProof struct {
	Hash       string `json:"hash"`
	DataURL    string `json:"dataUrl"`
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
	Name     string  `json:"name"`
	Duration float64 `json:"duration"`
	Result   interface{} `json:"result"`
}

type CSSProof struct {
	Features map[string]bool `json:"features"`
}

type DeviceInfo struct {
	Type         string
	IsMobileFlag bool
	IsTabletFlag bool
	IsSmartTVFlag bool
	IsAndroidFlag bool
	IsIPhoneFlag bool
	IsDesktopFlag bool
	MinDimension int
	MaxDimension int
	AspectRatio  float64
}

func (d *DeviceInfo) IsMobile() bool  { return d.IsMobileFlag }
func (d *DeviceInfo) IsTablet() bool  { return d.IsTabletFlag }
func (d *DeviceInfo) IsSmartTV() bool { return d.IsSmartTVFlag }
func (d *DeviceInfo) IsAndroid() bool { return d.IsAndroidFlag }
func (d *DeviceInfo) IsIPhone() bool  { return d.IsIPhoneFlag }
func (d *DeviceInfo) IsDesktop() bool { return d.IsDesktopFlag }
func (d *DeviceInfo) IsTouchDevice() bool { return d.IsMobileFlag || d.IsTabletFlag }
