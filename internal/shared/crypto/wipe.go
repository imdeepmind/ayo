package crypto

// Wipe overwrites every byte of each buffer with zeros so that plaintext key
// material does not linger on the Go heap after it is no longer needed. Go's
// garbage collector reuses memory without scrubbing it, so callers that hold
// secrets must zero them explicitly. Wiping a nil or empty buffer is a no-op.
func Wipe(bufs ...[]byte) {
	for _, b := range bufs {
		for i := range b {
			b[i] = 0
		}
	}
}
