.PHONY: dev-infra backend frontend test lint proto

# Sobe Postgres e Redis para desenvolvimento
dev-infra:
	docker compose up -d postgres redis

# Roda o servidor Go em modo dev
backend:
	cd backend && go run ./cmd/pixelrooms

# Roda o frontend em modo dev (Vite)
frontend:
	cd frontend && npm run dev

test:
	cd backend && go test ./...
	cd frontend && npm test --if-present

lint:
	cd backend && go vet ./...
	cd frontend && npm run typecheck

# Gera código Go e TS a partir de proto/ (requer buf: https://buf.build)
proto:
	buf generate
