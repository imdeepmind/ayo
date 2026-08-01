package settings

import (
	"encoding/json"
)

// UpdateSettingsInput is the Wails-bound payload for persisting settings. It
// mirrors the Settings domain model so the wire format stays decoupled from the
// stored entity, and its fields are validated by the service before use.
type UpdateSettingsInput struct {
	StorageMode         StorageMode `validate:"required,oneof=local ayo"`
	CloudKeys           []CloudKey
	ErasureCoding       bool
	ErasureCodingConfig ErasureCodingMode `validate:"omitempty,oneof=2+2 6+3 10+4 17+3"`
}

// UnmarshalJSON decodes CloudKeys into the concrete provider structs (AWSKey,
// AzureKey, GCPKey) based on the Provider field, mirroring Settings.
func (i *UpdateSettingsInput) UnmarshalJSON(data []byte) error {
	type Alias UpdateSettingsInput
	aux := &struct {
		CloudKeys []json.RawMessage `json:"CloudKeys"`
		*Alias
	}{
		Alias: (*Alias)(i),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	keys, err := decodeCloudKeys(aux.CloudKeys)
	if err != nil {
		return err
	}
	i.CloudKeys = keys
	return nil
}
