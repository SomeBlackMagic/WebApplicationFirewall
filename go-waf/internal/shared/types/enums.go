package types

type WAFMode string

const (
	WAFModeAudit  WAFMode = "audit"
	WAFModeNormal WAFMode = "normal"
)

type DeviceType string

const (
	DeviceDesktop DeviceType = "desktop"
	DeviceMobile  DeviceType = "mobile"
	DeviceTablet  DeviceType = "tablet"
	DeviceBot     DeviceType = "bot"
	DeviceTV      DeviceType = "tv"
	DeviceConsole DeviceType = "console"
	DeviceUnknown DeviceType = "unknown"
)

type StorageDriver string

const (
	StorageDriverMemory   StorageDriver = "memory"
	StorageDriverFile     StorageDriver = "file"
	StorageDriverOperator StorageDriver = "operator"
)
