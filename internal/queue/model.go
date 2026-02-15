package queue

type Job struct {
	ID     int64
	Type   string
	Status string
	Data   map[string]interface{}
}
