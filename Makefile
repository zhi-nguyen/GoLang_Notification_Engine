.PHONY: dev test migrate lint clean help

dev:
	docker compose up --build

test:
	cd backend && go test ./... -v -race

lint:
	cd backend && golangci-lint run

migrate:
	docker compose exec -T postgres psql -U user -d notifications -f /docker-entrypoint-initdb.d/001_create_notifications.sql

clean:
	docker compose down -v

help:
	@echo "Available commands:"
	@echo "  make dev      - Run all services via Docker Compose"
	@echo "  make test     - Run Go unit tests"
	@echo "  make lint     - Run linter"
	@echo "  make migrate  - Run SQL migrations"
	@echo "  make clean    - Stop services and clean volumes"
