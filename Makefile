.PHONY: test up check
test:
	cd backend && GOCACHE=/tmp/ortaq-go-cache go test -race ./...
up:
	docker compose up --build
check: test
	docker compose config --quiet

.PHONY: smoke test-3d
smoke:
	python3 scripts/smoke.py
test-3d:
	cd web3d && npm test
