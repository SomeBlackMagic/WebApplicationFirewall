package fingerprint

import (
	"math"
	"strings"

	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
)

type Validator struct {
	enabled  bool
	minScore float64
	logger   *logging.Logger
}

func NewValidator(enabled bool, minScore float64, logger *logging.Logger) *Validator {
	return &Validator{
		enabled:  enabled,
		minScore: minScore,
		logger:   logger.WithCategory("app.UnderAttack.FingerprintValidator"),
	}
}

func (v *Validator) Validate(fp *BrowserFingerprint, requestID, challengeID, proofSalt string) bool {
	if !v.enabled {
		return true
	}
	score := v.calculateScore(fp, requestID)
	v.logger.Debug("Fingerprint validation score", "score", score)
	return float64(score) <= v.minScore*100
}

func (v *Validator) calculateScore(fp *BrowserFingerprint, requestID string) int {
	score := 100

	if fp.UserAgent == "" || fp.Language == "" || fp.ScreenResolution == nil {
		score -= 15
	}

	var deviceInfo *DeviceInfo
	if fp.ScreenResolution != nil {
		deviceInfo = ParseDevice(fp.UserAgent, fp.ScreenResolution.Width, fp.ScreenResolution.Height)
	} else {
		deviceInfo = ParseDevice(fp.UserAgent, 0, 0)
	}

	isMobile := deviceInfo.IsMobile()

	if fp.BrowserProofs != nil {
		proofScore := v.validateBrowserProofs(fp.BrowserProofs, fp.UserAgent, isMobile)
		if proofScore < score {
			score = proofScore
		}
	} else {
		if isMobile {
			score -= 20
		} else {
			score -= 40
		}
	}

	if deviceInfo.IsSmartTV() {
		if fp.BrowserProofs == nil {
			score -= 10
		}
		if v.checkScreenAnomalies(fp, deviceInfo) {
			score -= 5
		}
		finalScore := clamp(score, 0, 100)
		return max(70, finalScore)
	}

	if v.checkInconsistencies(fp, deviceInfo) {
		score -= 20
	}

	if v.checkScreenAnomalies(fp, deviceInfo) {
		score -= 15
	}

	if fp.WebGLVendor == "" && fp.CanvasFingerprint == nil {
		score -= 15
	}

	return clamp(score, 0, 100)
}

func (v *Validator) validateBrowserProofs(proofs *BrowserProofs, userAgent string, isMobile bool) int {
	score := 100
	if proofs.Canvas == nil {
		score -= 15
	}
	if proofs.WebGL == nil {
		if isMobile {
			score -= 10
		} else {
			score -= 20
		}
	}
	if proofs.Timing == nil {
		score -= 10
	}
	return score
}

func (v *Validator) checkInconsistencies(fp *BrowserFingerprint, di *DeviceInfo) bool {
	ua := strings.ToLower(fp.UserAgent)

	if (strings.Contains(ua, "windows") && fp.Platform != "Win32") ||
		(strings.Contains(ua, "macintosh") && !strings.Contains(fp.Platform, "Mac")) ||
		(strings.Contains(ua, "linux") && !strings.Contains(fp.Platform, "Linux")) ||
		(di.IsSmartTV() && !strings.Contains(fp.Platform, "Linux")) ||
		(di.IsAndroid() && !strings.Contains(fp.Platform, "Linux")) {
		return true
	}

	if fp.ScreenResolution != nil {
		isMobileUA := di.IsMobile()
		isMobileScreen := fp.ScreenResolution.Width < 768
		isTabletUA := di.IsTablet()
		isTabletScreen := fp.ScreenResolution.Width >= 768 && fp.ScreenResolution.Width <= 1366
		if isTabletUA != isTabletScreen && isMobileUA != isMobileScreen {
			return true
		}
	}

	return false
}

func (v *Validator) checkScreenAnomalies(fp *BrowserFingerprint, di *DeviceInfo) bool {
	if fp.ScreenResolution == nil {
		return false
	}
	res := fp.ScreenResolution

	if di.IsSmartTV() {
		return !ValidateSmartTVDisplay(res)
	}
	if di.IsIPhone() {
		return !ValidateIPhoneDisplay(res)
	}

	isMobile := di.IsMobile()

	if res.Width <= 0 || res.Height <= 0 {
		return true
	}
	if !isMobile && (res.Width > 8000 || res.Height > 8000) {
		return true
	}
	if isMobile && (res.Width > 3000 || res.Height > 3000) {
		return true
	}

	if v.checkColorDepthAnomalies(res.ColorDepth, res.PixelDepth) {
		return true
	}

	if v.checkAspectRatioAnomalies(di) {
		return true
	}

	if v.checkAutomationPatterns(di, res.Width, res.Height, strings.ToLower(fp.UserAgent)) {
		return true
	}

	return false
}

func (v *Validator) checkColorDepthAnomalies(colorDepth, pixelDepth int) bool {
	if colorDepth > 0 {
		valid := map[int]bool{8: true, 16: true, 24: true, 32: true, 48: true}
		if !valid[colorDepth] {
			return true
		}
	}
	if pixelDepth > 0 && colorDepth > 0 {
		validCombos := [][2]int{{8, 8}, {16, 16}, {24, 24}, {24, 32}, {32, 32}, {48, 48}}
		found := false
		for _, c := range validCombos {
			if c[0] == colorDepth && c[1] == pixelDepth {
				found = true
				break
			}
		}
		if !found {
			return true
		}
	}
	return false
}

func (v *Validator) checkAspectRatioAnomalies(di *DeviceInfo) bool {
	r := di.AspectRatio
	switch {
	case di.IsMobile():
		return r < 1.2 || r > 2.5
	case di.IsTablet():
		return r < 1.25 || r > 1.8
	case di.IsSmartTV():
		return r < 1.3 || r > 2.4
	case di.IsDesktop():
		return r < 0.75 || r > 4.0
	}
	return false
}

func (v *Validator) checkAutomationPatterns(di *DeviceInfo, width, height int, ua string) bool {
	automationRes := [][2]int{
		{400, 400}, {800, 600}, {1024, 768}, {1280, 1024},
		{1366, 768}, {1440, 900}, {1680, 1050}, {1920, 1080},
	}

	minD := int(math.Min(float64(width), float64(height)))
	maxD := int(math.Max(float64(width), float64(height)))

	isAutoRes := false
	for _, r := range automationRes {
		rMin := int(math.Min(float64(r[0]), float64(r[1])))
		rMax := int(math.Max(float64(r[0]), float64(r[1])))
		if minD == rMin && maxD == rMax {
			isAutoRes = true
			break
		}
	}

	if isAutoRes {
		headless := []string{"headless", "phantom", "selenium", "webdriver"}
		for _, h := range headless {
			if strings.Contains(ua, h) {
				return true
			}
		}
		if di.IsMobile() {
			return true
		}
	}

	if di.IsMobile() {
		perfectRatios := []float64{1.0, 1.25, 1.33, 1.5, 1.6, 1.77, 2.0}
		r := math.Round(di.AspectRatio*100) / 100
		for _, pr := range perfectRatios {
			if r == pr {
				return true
			}
		}
	}

	return false
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
