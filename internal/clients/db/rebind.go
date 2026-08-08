package db

import (
	"strconv"
	"strings"
)

// Rebind adapts a query written with "?" placeholders to the given dialect.
// SQLite keeps "?"; PostgreSQL uses numbered "$1, $2, ..." placeholders. The
// rewrite is a simple scan, which is safe for the controlled queries in this
// codebase (none contain a literal "?" inside a string).
func Rebind(query string, dialect Dialect) string {
	if dialect != PostgreSQL {
		return query
	}

	var sb strings.Builder
	sb.Grow(len(query) + 8)
	n := 0
	for _, r := range query {
		if r == '?' {
			n++
			sb.WriteByte('$')
			sb.WriteString(strconv.Itoa(n))
		} else {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}
