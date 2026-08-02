package queue

import (
	"context"
	"database/sql"
)

type Repository interface {
	CreateJob(ctx context.Context, job *Job) error
	GetJob(ctx context.Context, id int64) (*Job, error)
	UpdateJob(ctx context.Context, job *Job) error
	DeleteJob(ctx context.Context, id int64) error
}

type repository struct {
	db *sql.DB
}

func initializeTable(db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS queue (
			id BIGINT PRIMARY KEY AUTO_INCREMENT,
			type VARCHAR(255) NOT NULL,
			status VARCHAR(255) NOT NULL,
			data JSON NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		)
	`
	_, err := db.Exec(query)
	return err
}

func NewRepository(db *sql.DB) Repository {
	_ = initializeTable(db)
	return &repository{db: db}
}

func (r *repository) CreateJob(ctx context.Context, job *Job) error {
	query := `
		INSERT INTO queue (type, status, data)
		VALUES (?, ?, ?)
	`

	_, err := r.db.ExecContext(ctx, query, job.Type, job.Status, job.Data)

	return err
}

func (r *repository) GetJob(ctx context.Context, id int64) (*Job, error) {
	query := `
		SELECT id, type, status, data
		FROM queue
		WHERE id = ?
	`

	row := r.db.QueryRowContext(ctx, query, id)

	var job Job
	err := row.Scan(&job.ID, &job.Type, &job.Status, &job.Data)
	if err != nil {
		return nil, err
	}

	return &job, nil
}

func (r *repository) UpdateJob(ctx context.Context, job *Job) error {
	query := `
		UPDATE queue
		SET type = ?, status = ?, data = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`

	_, err := r.db.ExecContext(ctx, query, job.Type, job.Status, job.Data, job.ID)
	return err
}

func (r *repository) DeleteJob(ctx context.Context, id int64) error {
	query := `
		DELETE FROM queue
		WHERE id = ?
	`

	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
