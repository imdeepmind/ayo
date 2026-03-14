package settings

import (
	"encoding/json"
	"fmt"
)

type StorageMode string
type Provider string
type ErasureCodingMode string

const (
	LocalStorage StorageMode = "local"
	AyoStorage   StorageMode = "ayo"

	AWS   Provider = "aws"
	Azure Provider = "azure"
	GCP   Provider = "gcp"

	EC22  ErasureCodingMode = "2+2"
	EC63  ErasureCodingMode = "6+3"
	EC104 ErasureCodingMode = "10+4"
	EC173 ErasureCodingMode = "17+3"
)

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

type Settings struct {
	StorageMode         StorageMode
	CloudKeys           []CloudKey
	ErasureCoding       bool
	ErasureCodingConfig ErasureCodingMode
}

func (s *Settings) UnmarshalJSON(data []byte) error {
	type Alias Settings
	aux := &struct {
		CloudKeys []json.RawMessage `json:"CloudKeys"`
		*Alias
	}{
		Alias: (*Alias)(s),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	s.CloudKeys = nil // Clear existing

	for _, rawKey := range aux.CloudKeys {
		var base struct {
			Provider Provider `json:"Provider"`
		}
		if err := json.Unmarshal(rawKey, &base); err != nil {
			return fmt.Errorf("failed to parse provider type: %w", err)
		}

		switch base.Provider {
		case AWS:
			var key AWSKey
			if err := json.Unmarshal(rawKey, &key); err != nil {
				return err
			}
			s.CloudKeys = append(s.CloudKeys, key)
		case Azure:
			var key AzureKey
			if err := json.Unmarshal(rawKey, &key); err != nil {
				return err
			}
			s.CloudKeys = append(s.CloudKeys, key)
		case GCP:
			var key GCPKey
			if err := json.Unmarshal(rawKey, &key); err != nil {
				return err
			}
			s.CloudKeys = append(s.CloudKeys, key)
		default:
			return fmt.Errorf("unknown provider type: %s", base.Provider)
		}
	}

	return nil
}
