package settings

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
