# AGENTS.md

Wails v2 desktop app (`ayo`): Go 1.24 backend + React 18 / TypeScript / Vite 3 / Tailwind frontend. Privacy-focused storage app with E2E encryption (master key, Argon2 KEK, AES-GCM).

## Architecture

The Go backend is tiered under `internal/`:

- `internal/features/` — business logic, one package per feature:
  - `auth/` — Register/Login/ResetPassword/Logout + in-memory session (`MasterKey`). bcrypt + Argon2 + AES-GCM. Layered as `dto.go` / `model.go` / `repository.go` / `service.go`.
  - `settings/` — per-user settings stored in the OS keyring (`zalando/go-keyring`), encrypted with the session master key. Keyring persistence is in `repository.go`; cloud-key types in `cloud.go`; validated Wails-bound input in `dto.go`.
  - `recovery/` — save-file dialog for downloading the recovery key (shown after register/reset).
  - `queue/` — dead code: not wired into `main.go`, and its SQL is MySQL-flavored (`AUTO_INCREMENT`, `JSON` type, `ON UPDATE CURRENT_TIMESTAMP`) and will not run on SQLite. Don't build on it.
- `internal/platform/` — infrastructure (never imported by features' business logic directly beyond what the feature's own repository wraps):
  - `database/` — SQLite via `modernc.org/sqlite` (pure Go, no cgo). Tables are created idempotently with `CREATE TABLE IF NOT EXISTS` inside each repository's `initializeTable`; there is **no migration tool**.
  - `keyring/` — thin wrapper over `zalando/go-keyring`.
  - `dialog/` — native Wails save-file dialog wrapper.
  - `queue/` — persistent SQLite-backed job queue (one `Job` per queued file, with status + progress). Wired in `main.go` and consumed by the `upload` feature's business logic through a narrow interface; prefer keeping that dependency behind the feature's own repository if possible.
- `internal/shared/` — cross-cutting code:
  - `errors/` — sentinel errors with user-facing messages; return these (not wrapped fmt errors) so the frontend can display them. Also the `InternalServerError` type.
  - `crypto/` — Argon2 KEK derivation + AES-256-GCM encrypt/decrypt primitives.
- `main.go` — entrypoint. Wires `auth`, `settings`, `recovery`, `upload` services and binds them to the frontend via `wails.Run`.
- `assets.go` — `//go:embed all:frontend/dist`; the compiled frontend is embedded into the Go binary.
- `frontend/` — React SPA. Calls Go through generated bindings (below). `@/` aliases `frontend/src`.
- `data/` — gitignored runtime data (`ayo.db`, `chunks/`, `input/`, `output/`). DB is hardcoded to `data/ayo.db` in `main.go`.
- `explore/` — stray experiment dir, not part of the build.

## Commands

- Dev: `wails dev` (Vite hot reload; browser dev server on http://localhost:34115)
- Build: `wails build` (produces `build/bin/ayo.app`)
- Go: `go build ./...`, `go vet ./...`, `golangci-lint run` (no config file, defaults)
- Frontend (run from `frontend/` or with `npm --prefix frontend`): `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`, `npm run type-check`, `npm run build`
- No Go tests exist.

## Critical gotchas

- **`frontend/wailsjs/go/**` is generated.** After adding, renaming, or changing a bound Go method, regenerate with `wails dev` or `wails build`. Never hand-edit `frontend/wailsjs/` or `frontend/package.json.md5`. Frontend code imports bindings like `../../wailsjs/go/auth/Service`.
- **`go build` fails if `frontend/dist` is missing** (embedded by `assets.go`). CI builds the frontend first, uploads `frontend/dist` as an artifact, and downloads it before `go build`. When testing Go locally, run `wails build` or `npm --prefix frontend run build` first.
- **Commit messages are enforced** by a pre-commit hook and CI (`scripts/commit-msg.sh`): format `type(scope): AYO-<N>: message`, types only `feat|chore|ci|bug`. Merge commits are skipped.
- CI runs on `main` and `develop` branches (push + PR).

## Conventions

- Auth validation uses `go-playground/validator` with a custom `password_strength` rule: passwords must contain upper + lower + digit + symbol.
- SQLite queries use `?` placeholders (see `internal/features/auth/repository.go`).
- Frontend: TypeScript, ESLint, Prettier; commit formatted/linted code (`format` + `lint` pass in CI).
