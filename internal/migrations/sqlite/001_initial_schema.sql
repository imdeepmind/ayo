CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    recovery_key        VARCHAR(255) NOT NULL,
    password_salt       BLOB NOT NULL,
    password_nonce      BLOB NOT NULL,
    password_master_key BLOB NOT NULL,
    recovery_salt       BLOB NOT NULL,
    recovery_nonce      BLOB NOT NULL,
    recovery_master_key BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL DEFAULT 'upload'
                        CHECK (type IN ('upload', 'download', 'delete')),
    file_id     BIGINT  NOT NULL DEFAULT 0,
    file        TEXT    NOT NULL,
    custom_name TEXT    NOT NULL DEFAULT '',
    path        TEXT    NOT NULL,
    size        BIGINT  NOT NULL,
    status      TEXT    NOT NULL,
    progress    INTEGER NOT NULL DEFAULT 0,
    tags        TEXT    NOT NULL DEFAULT '[]',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON queue (status);

CREATE TABLE IF NOT EXISTS uploads (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id             INTEGER NOT NULL UNIQUE,
    file               TEXT    NOT NULL,
    custom_name        TEXT    NOT NULL DEFAULT '',
    size               INTEGER NOT NULL,
    tags               TEXT    NOT NULL DEFAULT '[]',
    encrypted_size     INTEGER NOT NULL,
    data_shards        INTEGER NOT NULL,
    parity_shards      INTEGER NOT NULL,
    shard_size         INTEGER NOT NULL,
    block_count        INTEGER NOT NULL,
    file_nonce         BLOB    NOT NULL,
    encrypted_file_key BLOB    NOT NULL,
    key_nonce          BLOB    NOT NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chunks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id     INTEGER NOT NULL,
    shard_index INTEGER NOT NULL,
    chunk_id    TEXT    NOT NULL UNIQUE,
    storage_id  TEXT    NOT NULL DEFAULT '',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES uploads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks (file_id)
