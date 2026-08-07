package settings

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"regexp"
)

// CloudKey is a cloud provider credential stored within Settings. Each key
// carries a unique, persistent ID (e.g. "aws_ab12cd34") that identifies the
// provider. IDs are assigned by the service and never change for the lifetime
// of the provider; they are dropped together with the key when it is removed.
type CloudKey interface {
	GetProvider() Provider
	GetID() string
	SetID(id string)
}

type AWSKey struct {
	ID              string // unique provider ID, e.g. "aws_ab12cd34"
	Provider        Provider
	AccessKeyID     string
	SecretAccessKey string
	Region          string
	Bucket          string
}

func (a AWSKey) GetProvider() Provider { return a.Provider }

func (a AWSKey) GetID() string { return a.ID }

func (a *AWSKey) SetID(id string) { a.ID = id }

type AzureKey struct {
	ID            string
	Provider      Provider
	AccountName   string
	AccountKey    string
	ContainerName string
}

func (a AzureKey) GetProvider() Provider { return a.Provider }

func (a AzureKey) GetID() string { return a.ID }

func (a *AzureKey) SetID(id string) { a.ID = id }

type GCPKey struct {
	ID                 string
	Provider           Provider
	ServiceAccountJSON string
	Bucket             string
}

func (g GCPKey) GetProvider() Provider { return g.Provider }

func (g GCPKey) GetID() string { return g.ID }

func (g *GCPKey) SetID(id string) { g.ID = id }

type LocalKey struct {
	ID         string
	Provider   Provider
	FolderName string
	FolderPath string
}

func (l LocalKey) GetProvider() Provider { return l.Provider }

func (l LocalKey) GetID() string { return l.ID }

func (l *LocalKey) SetID(id string) { l.ID = id }

// decodeCloudKeys unmarshals a set of raw cloud-key JSON objects into their
// concrete provider structs, dispatching on the Provider field. Unknown
// providers are rejected.
func decodeCloudKeys(rawKeys []json.RawMessage) ([]CloudKey, error) {
	var keys []CloudKey

	for _, rawKey := range rawKeys {
		var base struct {
			Provider Provider `json:"Provider"`
		}
		if err := json.Unmarshal(rawKey, &base); err != nil {
			return nil, fmt.Errorf("failed to parse provider type: %w", err)
		}

		switch base.Provider {
		case AWS:
			var key AWSKey
			if err := json.Unmarshal(rawKey, &key); err != nil {
				return nil, err
			}
			keys = append(keys, &key)
		case Azure:
			var key AzureKey
			if err := json.Unmarshal(rawKey, &key); err != nil {
				return nil, err
			}
			keys = append(keys, &key)
		case GCP:
			var key GCPKey
			if err := json.Unmarshal(rawKey, &key); err != nil {
				return nil, err
			}
			keys = append(keys, &key)
		case Local:
			var key LocalKey
			if err := json.Unmarshal(rawKey, &key); err != nil {
				return nil, err
			}
			keys = append(keys, &key)
		default:
			return nil, fmt.Errorf("unknown provider type: %s", base.Provider)
		}
	}

	return keys, nil
}

const providerIDAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"

var providerIDPattern = regexp.MustCompile(`^(aws|azure|gcp|local)_[a-z0-9]{8}$`)

// generateProviderID returns a new unique provider ID in the form
// "<provider>_<8 random alphanumeric chars>", e.g. "aws_ab12cd34".
func generateProviderID(p Provider) (string, error) {
	raw := make([]byte, 8)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate provider id: %w", err)
	}
	random := make([]byte, len(raw))
	for i, b := range raw {
		random[i] = providerIDAlphabet[int(b)%len(providerIDAlphabet)]
	}
	return string(p) + "_" + string(random), nil
}

// validProviderID reports whether id matches the expected provider ID format.
func validProviderID(id string) bool {
	return providerIDPattern.MatchString(id)
}

// normalizeProviderIDs assigns a unique, persistent ID to every key that does
// not already carry a valid one, and guarantees the IDs in keys are unique.
// Existing valid IDs are preserved so a provider keeps its ID for as long as
// it exists; only empty, malformed or duplicate IDs are (re)generated.
func normalizeProviderIDs(keys []CloudKey) error {
	seen := make(map[string]struct{}, len(keys))
	for _, key := range keys {
		id := key.GetID()
		if id == "" || !validProviderID(id) {
			generated, err := generateProviderID(key.GetProvider())
			if err != nil {
				return err
			}
			id = generated
		}
		for {
			if _, dup := seen[id]; !dup {
				break
			}
			generated, err := generateProviderID(key.GetProvider())
			if err != nil {
				return err
			}
			id = generated
		}
		key.SetID(id)
		seen[id] = struct{}{}
	}
	return nil
}
