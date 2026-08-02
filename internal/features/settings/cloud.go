package settings

import (
	"encoding/json"
	"fmt"
)

// CloudKey is a cloud provider credential stored within Settings.
type CloudKey interface {
	GetProvider() Provider
}

type AWSKey struct {
	Provider        Provider
	AccessKeyID     string
	SecretAccessKey string
	Region          string
	Bucket          string
}

func (a AWSKey) GetProvider() Provider { return a.Provider }

type AzureKey struct {
	Provider      Provider
	AccountName   string
	AccountKey    string
	ContainerName string
}

func (a AzureKey) GetProvider() Provider { return a.Provider }

type GCPKey struct {
	Provider           Provider
	ServiceAccountJSON string
	Bucket             string
}

func (g GCPKey) GetProvider() Provider { return g.Provider }

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
			keys = append(keys, key)
		case Azure:
			var key AzureKey
			if err := json.Unmarshal(rawKey, &key); err != nil {
				return nil, err
			}
			keys = append(keys, key)
		case GCP:
			var key GCPKey
			if err := json.Unmarshal(rawKey, &key); err != nil {
				return nil, err
			}
			keys = append(keys, key)
		default:
			return nil, fmt.Errorf("unknown provider type: %s", base.Provider)
		}
	}

	return keys, nil
}
