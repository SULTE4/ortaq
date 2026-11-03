package app

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"
)

func TestStoreRollback(t *testing.T) {
	a := testAPI(t)
	a.Store.Update(context.Background(), func(s *State) error { s.Users[0].Name = "Changed"; return bad("rollback") })
	a.Store.View(context.Background(), func(s *State) error {
		if s.Users[0].Name == "Changed" {
			t.Fatal("failed update persisted")
		}
		return nil
	})
}

// Runs in CI or against a supplied PostgreSQL; every test uses its own schema.
func TestPostgresPersistenceAndConcurrentVotes(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL for real PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	root, e := pgxpool.New(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	defer root.Close()
	schema := "test_" + ID()
	if _, e = root.Exec(ctx, "CREATE SCHEMA "+schema); e != nil {
		t.Fatal(e)
	}
	defer root.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	parsed, e := url.Parse(dsn)
	if e != nil {
		t.Fatal(e)
	}
	q := parsed.Query()
	q.Set("search_path", schema)
	parsed.RawQuery = q.Encode()
	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	store, e := Open(ctx, parsed.String(), Seed(now))
	if e != nil {
		t.Fatal(e)
	}
	defer store.Pool.Close()
	if e = store.Update(ctx, func(s *State) error {
		s.Users = append(s.Users, User{6, "+77000000099", "Second resident", "resident", 1, 45})
		return nil
	}); e != nil {
		t.Fatal(e)
	}
	second, e := Open(ctx, parsed.String(), Seed(now))
	if e != nil {
		t.Fatal(e)
	}
	defer second.Pool.Close()
	if e = second.View(ctx, func(s *State) error {
		if len(s.Users) != 6 {
			t.Fatal("restart reseeded persisted state")
		}
		return nil
	}); e != nil {
		t.Fatal(e)
	}
	api1 := testAPI(t)
	api1.Store = store
	api2 := testAPI(t)
	api2.Store = second
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for i, a := range []*API{api1, api2} {
		wg.Add(1)
		go func(a *API, user int) {
			defer wg.Done()
			c, _ := call(t, a, "POST", "/polls/poll-open/votes", `{"option":0}`, user)
			codes <- c
		}(a, []int{4, 6}[i])
	}
	wg.Wait()
	close(codes)
	sum := 0
	for c := range codes {
		sum += c
	}
	if sum != 201+409 {
		t.Fatal("concurrent PostgreSQL vote invariant failed", sum)
	}
}
