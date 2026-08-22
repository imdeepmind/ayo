package settings

import (
	"encoding/json"
)

type StorageMode string
type Provider string
type ErasureCodingMode string

const (
	LocalStorage StorageMode = "local"
	AyoStorage   StorageMode = "ayo"

	AWS        Provider = "aws"
	MinIO      Provider = "minio"
	Backblaze  Provider = "backblaze"
	Cloudflare Provider = "cloudflare"
	Wasabi     Provider = "wasabi"
	Azure      Provider = "azure"
	GCP        Provider = "gcp"
	Local      Provider = "local"

	EC22  ErasureCodingMode = "2+2"
	EC63  ErasureCodingMode = "6+3"
	EC104 ErasureCodingMode = "10+4"
	EC173 ErasureCodingMode = "17+3"
)

type Settings struct {
	StorageMode         StorageMode
	CloudKeys           []CloudKey
	ErasureCoding       bool
	ErasureCodingConfig ErasureCodingMode
}

// UnmarshalJSON reconstructs the polymorphic CloudKeys slice from raw JSON.
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

	keys, err := decodeCloudKeys(aux.CloudKeys)
	if err != nil {
		return err
	}
	s.CloudKeys = keys
	return nil
}
