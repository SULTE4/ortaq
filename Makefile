.PHONY: test up check
test:
	cd backend && GOCACHE=/tmp/ortaq-go-cache go test -race ./...
up:
	docker compose up --build
check: test
	docker compose config --quiet
