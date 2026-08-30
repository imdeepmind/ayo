CREATE TABLE IF NOT EXISTS users (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username            VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    recovery_key        VARCHAR(255) NOT NULL,
    password_salt       BYTEA NOT NULL,
    password_nonce      BYTEA NOT NULL,
    password_master_key BYTEA NOT NULL,
    recovery_salt       BYTEA NOT NULL,
    recovery_nonce      BYTEA NOT NULL,
    recovery_master_key BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS queue (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON queue (status);

CREATE TABLE IF NOT EXISTS uploads (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id             BIGINT  NOT NULL UNIQUE,
    file               TEXT    NOT NULL,
    custom_name        TEXT    NOT NULL DEFAULT '',
    size               BIGINT  NOT NULL,
    tags               TEXT    NOT NULL DEFAULT '[]',
    encrypted_size     BIGINT  NOT NULL,
    data_shards        INTEGER NOT NULL,
    parity_shards      INTEGER NOT NULL,
    shard_size         BIGINT  NOT NULL,
    block_count        INTEGER NOT NULL,
    file_nonce         BYTEA   NOT NULL,
    encrypted_file_key BYTEA   NOT NULL,
    key_nonce          BYTEA   NOT NULL,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chunks (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    file_id     BIGINT  NOT NULL,
    shard_index INTEGER NOT NULL,
    chunk_id    TEXT    NOT NULL UNIQUE,
    storage_id  TEXT    NOT NULL DEFAULT '',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES uploads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks (file_id)
