package dbconfig

import (
	"reflect"
	"testing"

	dbclient "ayo/internal/clients/db"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	creds := DBCredentials{
		Type:     dbclient.PostgreSQL,
		Host:     "localhost",
		Port:     5432,
		Database: "ayo",
		Username: "alice",
		Password: "s3cret!Pass",
	}
	const password = "Sup3r&secure"
	const recoveryKey = "recovery-key-123"

	blob, err := EncryptDBCredentials(password, recoveryKey, creds)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	got, err := DecryptDBCredentials(password, blob)
	if err != nil {
		t.Fatalf("decrypt with password: %v", err)
	}
	if !reflect.DeepEqual(got, creds) {
		t.Fatalf("password round-trip mismatch:\n got %+v\nwant %+v", got, creds)
	}

	got, err = DecryptDBCredentialsWithRecovery(recoveryKey, blob)
	if err != nil {
		t.Fatalf("decrypt with recovery key: %v", err)
	}
	if !reflect.DeepEqual(got, creds) {
		t.Fatalf("recovery round-trip mismatch:\n got %+v\nwant %+v", got, creds)
	}
}

func TestDecryptWrongSecretFails(t *testing.T) {
	creds := DBCredentials{Type: dbclient.SQLite, Path: "/tmp/alice.db"}
	blob, err := EncryptDBCredentials("Right#Pass1", "right-recovery", creds)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	if _, err := DecryptDBCredentials("Wrong#Pass1", blob); err == nil {
		t.Fatal("expected error decrypting with wrong password")
	}
	if _, err := DecryptDBCredentialsWithRecovery("wrong-recovery", blob); err == nil {
		t.Fatal("expected error decrypting with wrong recovery key")
	}
}
