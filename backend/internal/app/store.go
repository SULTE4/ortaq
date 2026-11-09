package app

import (
	"context"
	"embed"
	"encoding/json"
	"github.com/jackc/pgx/v5/pgxpool"
	"sync"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Store interface {
	View(context.Context, func(*State) error) error
	Update(context.Context, func(*State) error) error
}
type Postgres struct{ Pool *pgxpool.Pool }

func Open(ctx context.Context, url string, seed *State) (*Postgres, error) {
	p, e := pgxpool.New(ctx, url)
	if e != nil {
		return nil, e
	}
	fail := func(e error) (*Postgres, error) { p.Close(); return nil, e }
	if e = p.Ping(ctx); e != nil {
		return fail(e)
	}
	sql, e := migrations.ReadFile("migrations/001_state.sql")
	if e != nil {
		return fail(e)
	}
	if _, e = p.Exec(ctx, string(sql)); e != nil {
		return fail(e)
	}
	data, e := json.Marshal(seed)
	if e != nil {
		return fail(e)
	}
	if _, e = p.Exec(ctx, "INSERT INTO app_state(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING", data); e != nil {
		return fail(e)
	}
	return &Postgres{p}, nil
}
func (p *Postgres) View(ctx context.Context, f func(*State) error) error {
	var data []byte
	if e := p.Pool.QueryRow(ctx, "SELECT data FROM app_state WHERE id=1").Scan(&data); e != nil {
		return e
	}
	var s State
	if e := json.Unmarshal(data, &s); e != nil {
		return e
	}
	s.restoreBuildingGeometry()
	return f(&s)
}

// shortcut: the demo serializes all writes in one aggregate; split tables before scaling beyond the demo.
func (p *Postgres) Update(ctx context.Context, f func(*State) error) error {
	tx, e := p.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var data []byte
	if e = tx.QueryRow(ctx, "SELECT data FROM app_state WHERE id=1 FOR UPDATE").Scan(&data); e != nil {
		return e
	}
	var s State
	if e = json.Unmarshal(data, &s); e != nil {
		return e
	}
	s.restoreBuildingGeometry()
	if e = f(&s); e != nil {
		return e
	}
	data, e = json.Marshal(s)
	if e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "UPDATE app_state SET data=$1, revision=revision+1,updated_at=now() WHERE id=1", data); e != nil {
		return e
	}
	return tx.Commit(ctx)
}

// Memory has the same rollback and serialization semantics as Postgres, for tests.
type Memory struct {
	mu   sync.Mutex
	data []byte
}

func NewMemory(s *State) *Memory { b, _ := json.Marshal(s); return &Memory{data: b} }
func (m *Memory) View(ctx context.Context, f func(*State) error) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	var s State
	if e := json.Unmarshal(m.data, &s); e != nil {
		return e
	}
	s.restoreBuildingGeometry()
	return f(&s)
}
func (m *Memory) Update(ctx context.Context, f func(*State) error) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	var s State
	if e := json.Unmarshal(m.data, &s); e != nil {
		return e
	}
	s.restoreBuildingGeometry()
	if e := f(&s); e != nil {
		return e
	}
	b, e := json.Marshal(s)
	if e == nil {
		m.data = b
	}
	return e
}
