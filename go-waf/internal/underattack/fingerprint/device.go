package fingerprint

import (
	"math"
	"regexp"
	"strings"
)

var (
	mobilePattern  = regexp.MustCompile(`(?i)(android|iphone|ipod|windows phone|blackberry|opera mini|mobile)`)
	tabletPattern  = regexp.MustCompile(`(?i)(ipad|android(?!.*mobile)|tablet|kindle|silk)`)
	botPattern     = regexp.MustCompile(`(?i)(bot|crawler|spider|crawling|googlebot|bingbot|yandex)`)
	smartTVPattern = regexp.MustCompile(`(?i)(smart-?tv|tizen|webos|hbbtv|tv safari|netcast|viera|bravia|roku|firetv|appletv|crkey|chromecast)`)
	consolePattern = regexp.MustCompile(`(?i)(playstation|xbox|nintendo)`)
	iphonePattern  = regexp.MustCompile(`(?i)iphone`)
	androidPattern = regexp.MustCompile(`(?i)android`)
)

func ParseDevice(userAgent string, width, height int) *DeviceInfo {
	ua := strings.ToLower(userAgent)
	info := &DeviceInfo{}

	switch {
	case botPattern.MatchString(ua):
		info.Type = "bot"
	case consolePattern.MatchString(ua):
		info.Type = "console"
	case smartTVPattern.MatchString(ua):
		info.Type = "tv"
		info.IsSmartTVFlag = true
	case tabletPattern.MatchString(ua):
		info.Type = "tablet"
		info.IsTabletFlag = true
	case mobilePattern.MatchString(ua):
		info.Type = "mobile"
		info.IsMobileFlag = true
	default:
		info.Type = "desktop"
		info.IsDesktopFlag = true
	}

	info.IsAndroidFlag = androidPattern.MatchString(ua)
	info.IsIPhoneFlag = iphonePattern.MatchString(ua)

	if info.IsIPhoneFlag {
		info.IsMobileFlag = true
	}

	info.MinDimension = int(math.Min(float64(width), float64(height)))
	info.MaxDimension = int(math.Max(float64(width), float64(height)))

	if info.MinDimension > 0 {
		info.AspectRatio = float64(info.MaxDimension) / float64(info.MinDimension)
	}

	return info
}
