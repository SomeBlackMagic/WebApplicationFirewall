package fingerprint

type knownResolution struct {
	Width, Height int
}

var iphoneResolutions = []knownResolution{
	{320, 480},   // iPhone 4, 4S
	{320, 568},   // iPhone 5, 5C, 5S, SE (1st gen)
	{375, 667},   // iPhone 6, 6S, 7, 8, SE (2nd/3rd gen)
	{414, 736},   // iPhone 6 Plus, 6S Plus, 7 Plus, 8 Plus
	{375, 812},   // iPhone X, XS, 11 Pro
	{414, 896},   // iPhone XR, XS Max, 11, 11 Pro Max
	{390, 844},   // iPhone 12, 12 Pro, 13, 13 Pro, 14
	{428, 926},   // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
	{393, 852},   // iPhone 14 Pro, 15, 15 Pro
	{430, 932},   // iPhone 14 Pro Max, 15 Plus, 15 Pro Max
}

var smartTVResolutions = []knownResolution{
	{1280, 720},   // HD Ready
	{1366, 768},   // HD
	{1920, 1080},  // Full HD
	{2560, 1440},  // QHD
	{3840, 2160},  // 4K UHD
	{7680, 4320},  // 8K UHD
}

func ValidateIPhoneDisplay(res *ScreenResolution) bool {
	if res == nil {
		return false
	}
	for _, r := range iphoneResolutions {
		if (res.Width == r.Width && res.Height == r.Height) ||
			(res.Width == r.Height && res.Height == r.Width) {
			return true
		}
	}
	return false
}

func ValidateSmartTVDisplay(res *ScreenResolution) bool {
	if res == nil {
		return false
	}
	for _, r := range smartTVResolutions {
		if (res.Width == r.Width && res.Height == r.Height) ||
			(res.Width == r.Height && res.Height == r.Width) {
			return true
		}
	}
	return false
}
