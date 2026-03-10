package types

func Ptr[T any](v T) *T {
	return &v
}

func Deref[T any](p *T, fallback T) T {
	if p != nil {
		return *p
	}
	return fallback
}
