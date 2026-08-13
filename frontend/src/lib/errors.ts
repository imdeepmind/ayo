// toErrorMessage extracts a human-friendly message from an unknown error
// (typically a rejected Wails binding call) and falls back to a default when
// nothing useful is available. Wails rejects with an Error whose message
// carries the Go error text, so err.message is preferred over String(err),
// which would add an "Error: " prefix.
export function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && err.message.trim()) {
    return err.message;
  }
  if (typeof err === 'string' && err.trim()) {
    return err;
  }
  return fallback;
}
