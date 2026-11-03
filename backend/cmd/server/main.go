package main

import (
	"context"
	"log"
	"net/http"
	"ortaq/internal/app"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	secret := os.Getenv("JWT_SECRET")
	if len(secret) < 32 {
		log.Fatal("JWT_SECRET must contain at least 32 characters")
	}
	store, e := app.Open(ctx, os.Getenv("DATABASE_URL"), app.Seed(time.Now()))
	if e != nil {
		log.Fatal(e)
	}
	defer store.Pool.Close()
	dir := os.Getenv("UPLOAD_DIR")
	if dir == "" {
		dir = "./uploads"
	}
	if e = os.MkdirAll(dir, 0755); e != nil {
		log.Fatal(e)
	}
	api := &app.API{Store: store, Secret: []byte(secret), UploadDir: dir, Now: time.Now, Demo: os.Getenv("DEMO_MODE") == "true"}
	srv := &http.Server{Addr: ":8080", Handler: api.Handler(), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		<-ctx.Done()
		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(c)
	}()
	log.Print("Ortaq API listening on :8080")
	if e = srv.ListenAndServe(); e != nil && e != http.ErrServerClosed {
		log.Fatal(e)
	}
}
