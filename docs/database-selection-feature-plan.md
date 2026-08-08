# Database Selection Feature - Implementation Plan

## Problem Statement

Currently, Ayo hardcodes SQLite as the only database option with a fixed path (`data/ayo.db`). Users cannot choose their database type or use their own PostgreSQL instance. Additionally, the database initialization happens globally in `main.go`, making it difficult to support per-user database configurations. This feature will allow users to select either SQLite (stored in OS app data directory) or PostgreSQL (with user-provided credentials) during registration, with credentials stored encrypted in the OS keyring.

## Requirements

1. **Database selection during registration**: Users choose SQLite or PostgreSQL as part of the registration form (tab-based UI)
2. **Per-user database credentials**: Each account has its own database configuration stored in the OS keyring, encrypted with password-derived KEK (Argon2id) and recovery-key-derived KEK (same dual-encryption pattern as master key)
3. **SQLite auto-path**: SQLite databases are stored in OS app data directory with username-based filenames (e.g., `~/Library/Application Support/ayo/alice.db`)
4. **PostgreSQL validation**: Ping the database before account creation to validate credentials
5. **Database client abstraction**: Create `internal/clients/db` package similar to `internal/clients/storage`, allowing easy addition of new database types (MySQL, etc.)
6. **Refactor database initialization**: Replace hardcoded `database.NewDatabase()` with config-based factory that accepts database type and connection details
7. **Read-only Database settings page**: New settings tab showing current database type, connection details (PostgreSQL: host/port/database/username, SQLite: nothing), and appropriate warnings
8. **Password reset support**: DB credentials are dual-encrypted (password-KEK + recovery-KEK), so password reset automatically re-encrypts them with the new password

## Background

### Current Architecture

- `internal/platform/database/database.go`: Hardcoded SQLite with fixed path
- `main.go`: Database opened once globally, shared across all features
- Settings stored in keyring encrypted with master key (circular dependency: need DB to get master key)
- Storage providers follow abstraction pattern in `internal/clients/storage/`

### Key Patterns to Follow

- Storage client abstraction: `Client` interface with dispatch functions (`OpenShardWriter`, `ResolveShard`, `Validate`)
- Settings encryption: Dual-encryption pattern (password-KEK + recovery-KEK) used for master key
- Keyring storage: Per-user entries using username as key
- Repository pattern: Each feature has its own repository calling `initializeTable`

### Technical Constraints

- PostgreSQL driver needed: `github.com/lib/pq` (pure Go, standard choice; `github.com/jackc/pgx/v5/stdlib` is a documented alternative)
- OS app data paths vary by platform (macOS: `~/Library/Application Support/ayo/`, Linux: `~/.config/ayo/`, Windows: `%APPDATA%\ayo\`)
- Wails bindings regenerate on Go method changes (`wails dev` or `wails build`)

### Critical Corrections vs the Original Plan

These findings come from reviewing the current code and must drive implementation:

1. **The existing repository SQL is SQLite-specific and will NOT run on PostgreSQL.** All three DB-backed repositories use constructs that lib/pq rejects:
   - `?` placeholders (lib/pq requires `$N`) — `internal/features/auth/repository.go`, `internal/features/upload/repository.go`, `internal/platform/queue/repository.go`
   - `INTEGER PRIMARY KEY AUTOINCREMENT` (invalid Postgres DDL; needs `GENERATED ALWAYS AS IDENTITY`/`BIGSERIAL`)
   - `result.LastInsertId()` (lib/pq returns 0 / errors; needs `INSERT ... RETURNING id`)
   - Duplicate-key detection matches `"UNIQUE constraint failed"` / `"Duplicate entry"`; Postgres reports `duplicate key value violates unique constraint`
   
   A dedicated task adds dialect support before any per-user DB wiring. Chosen approach: **rebind helper + dialect-aware queries** (see Task 3).

2. **The full DB config (including the PostgreSQL password) must NOT live in `Session`.** `Session` is returned to the frontend by the bound `GetSession()` method (auth/service.go), which would leak the DB password to the webview. The full config stays service-side (unexported); only sanitized fields are exposed via `GetDatabaseInfo`.

3. **Per-user DBs break the startup-constructed queue/upload repositories.** Repositories are built once in `main.go` and the queue processor starts in `Startup` before any login. With per-user databases, the connection is owned by the auth service, DB-backed services rebuild their repositories per session, and the processor starts on login / stops on logout.

4. **Existing accounts are out of scope.** Accounts registered before this feature live in `data/ayo.db` and have no keyring DB-creds entry; they will not log in after this change. This is a documented breaking change; no automatic migration is provided.

## Proposed Solution

### 1. Database Client Abstraction (`internal/clients/db`)

A factory-based, dialect-aware wrapper around `database/sql`:

- `Config` struct with `Type` (sqlite/postgresql), `Path` (sqlite), and `Host`, `Port`, `Database`, `Username`, `Password` (postgresql)
- `Client` struct that embeds `*sql.DB` and carries its `Dialect`, so existing repository calls continue to work
- `NewClient(config Config) (*Client, error)` factory that dispatches on type, pings the database, and returns a client
- `Validate(config Config) error` to ping a database before saving credentials
- Dialect helpers: `Rebind(query string) string`, `IsPostgres() bool`, `LastInsertID(result sql.Result) (int64, error)`
- Internal helpers for SQLite path resolution and PostgreSQL DSN building

### 2. Database Credentials Storage

Store DB credentials in OS keyring with dual encryption:

- New keyring entry: service `ayo`, user `dbcreds_{username}` containing encrypted DB credentials
- Encryption: Argon2id-derived KEK from password + recovery key (same pattern as master key)
- Structure: `{passwordSalt, passwordNonce, passwordEncrypted, recoverySalt, recoveryNonce, recoveryEncrypted}`
- Plaintext creds (before encryption): `{type, path?, host?, port?, database?, username?, password?}`

### 3. Registration Flow Changes

- Tab-based UI: "Account Details" → "Database Configuration"
- Database tab: Radio buttons for SQLite/PostgreSQL
- SQLite: No fields (auto-generates path in app data directory)
- PostgreSQL: Form fields (Host, Port, Database, Username, Password)
- Validation: Ping database before proceeding to account creation
- On success: Encrypt DB creds with password-KEK and recovery-KEK → save to keyring → connect to DB → create user account (dialect-aware)

### 4. Login Flow Changes

- Load encrypted DB creds from keyring using username
- Decrypt with password-derived KEK
- Connect to database using decrypted credentials
- Store the decrypted config and live client **on the Service** (unexported), never in `Session`
- Continue with existing auth flow (fetch user, decrypt master key, establish session)
- Map errors: missing keyring entry → `ErrUserNotFound`; creds decrypt failure → `ErrInvalidPassword`; connection failure → new `ErrDatabaseUnavailable` sentinel ("Cannot connect to database")

### 5. Password Reset Flow Changes

- Load encrypted DB creds from keyring
- Decrypt using recovery-key-derived KEK (user provides recovery key)
- Re-encrypt with new password-KEK and new recovery-KEK
- Save updated encrypted creds back to keyring
- Continue with existing password reset flow

### 6. Connection Lifecycle

- Auth service owns the connection: created on login, closed on logout
- `queue` and `upload` services rebuild their repositories per session via a repository factory
- The upload queue processor starts when a session is attached and stops when it is detached
- `main.go` no longer opens a global database

### 7. Settings Page

- New "Database" tab in Settings layout
- Read-only display showing:
  - SQLite: "Database Type: SQLite" + warning about local data loss
  - PostgreSQL: "Database Type: PostgreSQL", connection details (host, port, database, username - NOT password), warning about remote metadata security
- No edit capability (database choice is permanent)

## Task Breakdown

### Task 1: Add PostgreSQL driver dependency and OS app data path helper

**Objective**: Add necessary dependencies and create helper for OS-specific app data directory paths.

**Steps**:
- Add `github.com/lib/pq` to `go.mod`
- Create `internal/shared/paths/paths.go` with `GetAppDataDir()` function that returns OS-appropriate app data directory
- Use `os.UserConfigDir()` (returns `~/Library/Application Support` on macOS, `~/.config` on Linux, `%APPDATA%` on Windows) and append `/ayo`
- Test: Verify app data directory is created correctly on current OS

**Demo**: Helper function returns correct path for the platform

---

### Task 2: Create dialect-aware database client abstraction (`internal/clients/db`)

**Objective**: Build the abstraction layer for database clients, including dialect handling.

**Steps**:
- Create `internal/clients/db/client.go` with `Dialect`, `Config`, and factory functions
- `Dialect` is a string enum: `sqlite` / `postgresql`
- `Config` contains: `Type string` (sqlite/postgresql), `Path string` (sqlite), `Host string, Port int, Database string, Username string, Password string` (postgresql)
- `Client` embeds `*sql.DB` and carries its `Dialect`:
  - `NewClient(config Config) (*Client, error)` dispatches to SQLite or PostgreSQL connection logic and pings on open
  - `Validate(config Config) error` pings the database to verify connectivity
  - `(c *Client) Rebind(query string) string` rewrites `?` → `$1, $2, ...` when dialect is postgresql, no-op for sqlite
  - `(c *Client) IsPostgres() bool`
  - `(c *Client) LastInsertID(result sql.Result) (int64, error)` returns `result.LastInsertId()` for sqlite; returns an error on postgresql so callers are forced to use the `RETURNING id` path
- Move the SQLite DSN building (including `_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)`) here from `internal/platform/database`
- For PostgreSQL: use lib/pq driver (name `postgres`), build connection string `postgres://user:pass@host:port/db?sslmode=disable`
- Test: Unit test dispatch logic, DSN building, and Rebind for both dialects

**Demo**: Factory function correctly dispatches based on config type and returns a dialect-aware client

---

### Task 3: Add dialect support to DB-backed repositories (auth, upload, queue) — FOUNDATIONAL

**Objective**: Make existing repository SQL work on both SQLite and PostgreSQL.

**Steps**:
- Change repository constructors from `db *sql.DB` to `db *dbclient.Client` in:
  - `internal/features/auth/repository.go`
  - `internal/features/upload/repository.go`
  - `internal/platform/queue/repository.go`
- Wrap every parameterized query in `r.db.Rebind(...)`
- Make `initializeTable` DDL dialect-aware:
  - SQLite: `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - PostgreSQL: `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` (or `BIGSERIAL`)
  - `VARCHAR`, `BYTEA`, `CURRENT_TIMESTAMP` are portable as-is
- Inserts that must return the new row ID (`CreateUser`, `CreateUpload`, queue `Add`):
  - SQLite: keep `result.LastInsertId()`
  - PostgreSQL: use `INSERT ... RETURNING id` via `QueryRowContext().Scan(&id)`
- Update duplicate-key detection (auth/repository.go): add the Postgres error text `duplicate key value violates unique constraint` alongside the existing SQLite texts
- Test: Verify rebind, DDL, and insert-ID paths for both dialects (SQLite against a real file; PostgreSQL at the config/DSN level)

**Demo**: The same repository code runs against both SQLite and PostgreSQL

---

### Task 4: Create database credentials model and keyring storage (`internal/features/dbconfig`)

**Objective**: Implement dual-encryption storage for database credentials in OS keyring.

**Steps**:
- Create `internal/features/dbconfig/model.go` with `DBCredentials` struct (type, path, host, port, database, username, password)
- Create `internal/features/dbconfig/crypto.go` with dual-encryption functions:
  - `EncryptDBCredentials(password, recoveryKey string, creds DBCredentials) (passwordEncrypted, passwordNonce, recoveryEncrypted, recoveryNonce, passwordSalt, recoverySalt []byte, err error)`
  - `DecryptDBCredentials(password, passwordSalt, passwordNonce, passwordEncrypted []byte) (DBCredentials, error)`
  - `DecryptDBCredentialsWithRecovery(recoveryKey, recoverySalt, recoveryNonce, recoveryEncrypted []byte) (DBCredentials, error)`
- Create `internal/features/dbconfig/repository.go` with keyring operations:
  - `SaveDBCredentials(username string, encryptedData []byte) error`
  - `LoadDBCredentials(username string) ([]byte, error)`
- Storage format in keyring: JSON blob `{passwordSalt, passwordNonce, passwordEncrypted, recoverySalt, recoveryNonce, recoveryEncrypted}` stored under service `ayo`, user `dbcreds_{username}`
- Test: Verify encryption/decryption round-trip and keyring save/load

**Demo**: DB credentials can be encrypted, saved to keyring, loaded, and decrypted successfully

---

### Task 5: Remove `internal/platform/database`

**Objective**: Eliminate the redundant platform database package.

**Steps**:
- Absorb the SQLite DSN logic into `internal/clients/db` (done in Task 2)
- Delete `internal/platform/database` (or keep a thin deprecated wrapper for one cycle)
- Update `main.go` to open the development SQLite database via `dbclient.NewClient` for now; the global open is removed entirely in Task 8
- Test: `go build ./...`, `go vet ./...` pass; existing SQLite initialization still works

**Demo**: Database initialization works through the config-based factory

---

### Task 6: Update auth service to accept database configuration during registration

**Objective**: Modify registration flow to accept, validate, and persist database configuration.

**Steps**:
- Modify `RegisterInput` DTO to include a `DBConfig` field (validated: required; when type is postgresql, host/port/database/username/password are required)
- Update `Service.Register()` to:
  - Accept DB config in input
  - Generate SQLite path from app data directory + username if type is sqlite
  - Validate DB connection using `dbclient.Validate(config)` before creating the account
  - Encrypt DB credentials with password-KEK and recovery-KEK
  - Save encrypted DB creds to keyring via dbconfig repository
  - Connect to database using `dbclient.NewClient(config)`
  - Create user account in that database via `repo.CreateUser()` (dialect-aware per Task 3)
  - Return success with recovery key
- Test: Verify registration flow with both SQLite and PostgreSQL configs

**Demo**: User can register with SQLite (auto-path) or PostgreSQL (custom creds), and account is created in the correct database

---

### Task 7: Update auth service login flow to load DB credentials

**Objective**: Modify login to load database credentials from keyring and establish a per-user connection.

**Steps**:
- Modify `Service.Login()` to:
  - Load encrypted DB creds from keyring using username (dbconfig repository)
  - Decrypt DB creds using password-derived KEK
  - Connect to database using `dbclient.NewClient(config)`
  - Continue with existing login logic (fetch user, decrypt master key, create session)
- Store the decrypted config and live client **on the Service** (unexported fields), NOT in `Session` (which is serialized to the frontend via `GetSession`)
- Map errors:
  - Missing keyring entry → `errors.ErrUserNotFound`
  - Credential decryption failure (wrong password) → `errors.ErrInvalidPassword`
  - Connection failure → new sentinel `errors.ErrDatabaseUnavailable` (user-facing "Cannot connect to database")
- Test: Verify login works with both SQLite and PostgreSQL users, and error mapping

**Demo**: User can log in, DB credentials are loaded from keyring, and database connection is established

---

### Task 8: Connection lifecycle — start on login, stop on logout

**Objective**: Make database connections per-user and remove the global database.

**Steps**:
- Auth service owns the connection lifecycle:
  - `Login` → creates the client and stores it (via the new `SetClient`-style hook)
  - `Logout` → closes the client
- Expose read-only accessors for other services:
  - `Service.CurrentClient() (*dbclient.Client, error)` (ErrUnauthorized when signed out)
  - `Service.DatabaseConfig() (dbclient.Config, error)`
- `queue` and `upload` services: replace their fixed repository with a repository factory plus attach/detach:
  - `upload.Service` and `queue.Service` gain `AttachClient(*dbclient.Client)` (rebuilds their repository from a factory) and `DetachClient()` (closes and clears)
- The upload queue processor starts on `AttachClient` and stops on `DetachClient`; it is no longer started in `Startup`
- `main.go`: remove the global `database.NewDatabase` / `dbclient.NewClient` open; wire auth's session events to Attach/Detach on login/logout
- Update service constructors to accept repository factory functions
- Test: App starts with no database; register/login/logout exercises start/stop; all features still work while signed in

**Demo**: Application initializes without a global database; each user's database is loaded on login and closed on logout

---

### Task 9: Update password reset flow to re-encrypt DB credentials

**Objective**: Ensure password reset preserves database credentials with new encryption keys.

**Steps**:
- Modify `Service.ResetPassword()` to:
  - Load encrypted DB creds from keyring
  - Decrypt using recovery-key-derived KEK
  - Generate new recovery key (existing logic)
  - Re-encrypt DB creds with new password-KEK and new recovery-KEK
  - Save updated encrypted creds to keyring
  - Continue with existing password reset logic (update user password/recovery key in DB)
- Test: Verify password reset preserves DB credentials and allows login with new password

**Demo**: User can reset password using recovery key, and DB credentials remain accessible

---

### Task 10: Add database configuration to registration frontend (Go bindings)

**Objective**: Update Wails bindings to include database configuration in registration input.

**Steps**:
- Update `RegisterInput` DTO with DB config fields (ensure it marshals correctly for Wails bindings)
- Regenerate Wails bindings: `wails dev` or `wails build`
- Verify `frontend/wailsjs/go/auth/Service.ts` includes new DB config fields
- Test: Bindings compile and TypeScript recognizes new fields

**Demo**: Frontend can call updated `Register()` method with DB config

---

### Task 11: Build database configuration UI component for registration

**Objective**: Create React component for database type selection and configuration.

**Steps**:
- Create `frontend/src/components/items/DatabaseConfig.tsx` component
- Two tabs: "SQLite" and "PostgreSQL" (similar to StorageSettings tabs)
- SQLite tab: Simple message "Your data will be stored locally. The database file will be created automatically."
- PostgreSQL tab: Form fields (Host, Port default 5432, Database, Username, Password)
- Use react-hook-form + Zod validation
- Export `DatabaseConfigData` type for parent component
- Test: Component renders both tabs, form validation works

**Demo**: Database configuration component displays SQLite and PostgreSQL tabs with appropriate fields

---

### Task 12: Integrate database configuration into registration page

**Objective**: Add multi-step registration flow with database selection.

**Steps**:
- Update `frontend/src/pages/Register.tsx` to use multi-step flow:
  - Step 1: Account Details (username, password)
  - Step 2: Database Configuration (SQLite or PostgreSQL)
- Use state to track current step and accumulated form data
- On submit (Step 2): Combine account data + DB config, call `Register()` with full payload
- Handle validation errors from backend (e.g., "Cannot connect to database")
- Test: End-to-end registration flow with both SQLite and PostgreSQL

**Demo**: User can register account with database selection, and registration succeeds

---

### Task 13: Add GetDatabaseInfo method to settings service

**Objective**: Create backend method to retrieve current database configuration for settings display.

**Steps**:
- Define `auth.DatabaseConfigProvider` interface (mirrors the existing `SessionProvider` pattern) exposing `DatabaseConfig() (dbclient.Config, error)`, and inject it into the settings service constructor
- Create `Service.GetDatabaseInfo() (*DatabaseInfo, error)` method in settings service
- `DatabaseInfo` struct: `{Type string, Path string, Host string, Port int, Database string, Username string}`
- Retrieve DB config from the auth service's service-side state (never from `Session`)
- Return sanitized database information (exclude password)
- Regenerate Wails bindings
- Test: Method returns correct database information

**Demo**: Frontend can fetch and display database configuration

---

### Task 14: Create database settings page (read-only display) + integrate into settings layout

**Objective**: Build the settings page component and wire it into the settings navigation.

**Steps**:
- Create `frontend/src/components/items/DatabaseSettings.tsx` component
- Load current DB config from backend via `GetDatabaseInfo()`
- Display database type and connection details:
  - SQLite: "Type: SQLite" + warning about local data loss
  - PostgreSQL: "Type: PostgreSQL", connection details (host, port, database, username - NOT password), warning about remote metadata
- All fields are read-only (no edit capability)
- Update `frontend/src/pages/Settings.tsx` to add a "Database" section with an icon and route to the sections array
- Render `DatabaseSettings` component when the "database" section is active
- Test: Component displays correct information for both database types; navigation works

**Demo**: Settings page has a new "Database" tab that displays the current database configuration

---

### Task 15: Update login page to handle database connection errors

**Objective**: Improve error handling for database connection failures during login.

**Steps**:
- Catch database connection errors from login flow
- Display user-friendly error message: "Unable to connect to your database. Please check that the database is accessible."
- For PostgreSQL users: Suggest checking server status
- For SQLite users: Suggest checking file permissions
- Test: Error handling displays appropriate messages

**Demo**: Login page gracefully handles database connection failures

---

### Task 16: End-to-end testing and cleanup

**Objective**: Comprehensive testing and documentation of the complete feature.

**Test Scenarios**:
- Register with SQLite → Login → Upload file → View settings → Logout → Login again
- Register with PostgreSQL → Login → Upload file → View settings → Logout → Login again
- Register → Password reset → Login with new password → Verify DB access still works
- Register two users with different databases (one SQLite, one PostgreSQL) → Verify no conflicts

**Cleanup**:
- Verify no hanging code or unused imports
- Confirm `Session` does not carry the DB config or password (leak check)
- Confirm `internal/platform/database` references are gone
- Update README.md with the database selection feature
- Document the breaking change: accounts registered before this feature have no keyring DB-creds entry and will not log in (out of scope; no migration)

**Demo**: Complete feature works end-to-end with both database types, multiple users, and password reset

---

## Notes

- **Session Extension**: `Session` does NOT carry the DB config (it is serialized to the frontend). The full decrypted config and live client live on the auth `Service` as unexported fields, and are exposed to other services through `CurrentClient()` / `DatabaseConfig()` accessors.
- **Error Messages**: Use sentinel errors from `internal/shared/errors` for user-facing messages; add `ErrDatabaseUnavailable` for connection failures.
- **Keyring Key Format**: service `ayo`, user `dbcreds_{username}` for database credentials, separate from the existing `ayo` keyring entries for settings.
- **PostgreSQL Connection String Format**: `postgres://username:password@host:port/database?sslmode=disable` (sslmode configurable in future).
- **SQLite Filename Format**: `{username}.db` stored in OS app data directory (`~/Library/Application Support/ayo/` on macOS).
- **Dialect Handling**: queries use `?` placeholders and go through `Client.Rebind`; DDL and insert-ID retrieval branch on the dialect.
- **Breaking Change**: existing accounts in `data/ayo.db` have no keyring DB-creds entry and will not log in after this feature. Out of scope; documented in the README.
- **Dead Code**: `internal/features/queue` is dead code (not wired, MySQL-flavored SQL) and is NOT modified; only `internal/platform/queue` receives dialect support.
