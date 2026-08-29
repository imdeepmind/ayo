# AGENTS.md

Wails v2 desktop app (`ayo`): Go 1.24 backend + React 18 / TypeScript / Vite 3 / Tailwind frontend. Privacy-focused storage app with E2E encryption (master key, Argon2 KEK, AES-GCM).

## Architecture

The Go backend is tiered under `internal/`, one tier per directory. A tier may
depend only on the tiers below it:

```
   features          business logic; the React app talks only to these
       ↑
   platform          platform-level infrastructure (queue, keyring); may import clients
       ↑
   clients           third-party client adapters (AWS S3, databases, ...)
       ↑
   shared            cross-cutting utilities; anyone may import
```

Concretely: `shared` is importable by every tier; `clients` may be imported by
anything above it; `platform` may call `clients`; `features` may call `platform`,
`clients`, and `shared` — but only through the feature's own `Repository` (see
Conventions below).

- `internal/clients/` — third-party client adapters for external services:
  - `db/` — dialect-aware database client (`sqlite` via `modernc.org/sqlite`, `postgresql` via `github.com/lib/pq`). `Config` + `NewClient`/`Validate`, `Client` embeds `*sql.DB` and carries its `Dialect`, `Rebind()` rewrites `?`→`$N` for PostgreSQL, and `Connection` is the shared per-session connection holder that repositories resolve per operation (tables created lazily via `initializeTable`).
  - `storage/` — storage provider clients (local filesystem, S3) and dispatch.
- `internal/platform/` — platform-level infrastructure; may call `clients`:
  - `keyring/` — thin wrapper over `zalando/go-keyring`.
  - `queue/` — job queue (one `Job` per queued file, with status + progress) backed by the signed-in user's database via `internal/clients/db`. Wired in `main.go` and consumed by the `upload` feature.
- `internal/features/` — business logic, one package per feature; the React app interacts with the backend only through these:
  - `auth/` — Register/Login/ResetPassword/Logout + in-memory session (`MasterKey`). Argon2id + AES-GCM. Layered as `dto.go` / `model.go` / `repository.go` / `service.go`. The repository owns the active per-user database connection (via `internal/clients/db`'s `Connection`) and opens/closes it on login/logout; the DB config (incl. PostgreSQL password) never surfaces in `Session` (which is serialized to the frontend). `auth` also persists database credentials (`dbcreds_{username}`, dual-encrypted via `crypto.DualEncrypt`) and encrypted master-key material (`mkey_{username}`) in the OS keyring through its `Repository`.
  - `settings/` — per-user settings stored in the OS keyring (`zalando/go-keyring`), encrypted with the session master key. Keyring persistence is in `repository.go`; cloud-key types in `cloud.go`; validated Wails-bound input in `dto.go`. `GetDatabaseInfo()` returns sanitized (no password) DB info for the read-only Database tab.
  - `recovery/` — save-file dialog for downloading the recovery key (shown after register/reset).
  - `upload/` — native file picker plus one job per uploaded file in the `platform/queue`; the processor (`processor.go`) encrypts each file, splits it into erasure-coded shards (`erasure.go`), and writes them through the storage client, all via the repository.
  - `home/` — dashboard: uploads overview and storage totals. Its repository owns the read-side queries and delegates the reads shared with the upload flow (`GetUpload`, `GetChunks`) to the upload feature's repository.
- `internal/shared/` — cross-cutting utilities; anyone may import:
  - `errors/` — sentinel errors with user-facing messages; return these (not wrapped fmt errors) so the frontend can display them. Also the `InternalServerError` type, `ErrDatabaseUnavailable` and `ErrNoStorageProvider`.
  - `crypto/` — Argon2 KEK derivation + AES-256-GCM encrypt/decrypt primitives. Includes `DualEncrypt`/`DualDecrypt` (password-KEK + recovery-KEK dual wrap) and `Wipe` for scrubbing plaintext key material; all crypto lives here, never in features.
  - `paths/` — `GetAppDataDir()` for the OS app data directory where per-user SQLite files live.
  - `dialog/` — native Wails save-file/directory dialog wrapper.
- `main.go` — entrypoint. Wires `auth`, `settings`, `recovery`, `upload`, `home` services and binds them to the frontend via `wails.Run`. No global database: a shared `dbclient.Connection` is created and passed to auth/queue/upload.
- `assets.go` — `//go:embed all:frontend/dist`; the compiled frontend is embedded into the Go binary.
- `frontend/` — React SPA. Calls Go through generated bindings (below). `@/` aliases `frontend/src`.
- `data/` — gitignored runtime data (`encrypted/`, `downloads/`). Per-user databases live in the OS app data directory, not here.
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
- **Commit messages are enforced** by a pre-commit hook and CI (`scripts/commit-msg.sh`): format `type(scope): #<N>: message`, types only `feat|chore|ci|bug`. Merge commits are skipped.
- CI runs on `main` and `develop` branches (push + PR).

## Conventions

- **Service is the feature's public surface.** Only `Service` methods are bound to the frontend via Wails; the React app interacts with the backend only through features. Within a feature, `dto.go` validates Wails-bound input, `model.go` holds the types, `repository.go` owns persistence.
- **Service calls the repository; the repository interacts with clients/platform.** A feature's service never touches `internal/clients` or `internal/platform` directly — if a service needs a client or platform package, it goes through the feature's single `Repository`. The repository is optional if a feature has no persistence; otherwise one repository per file, one service per file.
- Auth validation uses `go-playground/validator` with a custom `password_strength` rule: passwords must contain upper + lower + digit + symbol.
- Repositories write queries with `?` placeholders and run them through the client's `Rebind()` (a no-op on SQLite, `?`→`$N` on PostgreSQL). `initializeTable` and insert-ID retrieval (`LastInsertId` vs `RETURNING id`) branch on the dialect.
- Frontend: TypeScript, ESLint, Prettier; commit formatted/linted code (`format` + `lint` pass in CI).
