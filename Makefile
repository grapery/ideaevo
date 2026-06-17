.PHONY: dev api mcp web build test

DB_HOST ?= localhost
DB_PORT ?= 3306
DB_USER ?= root
DB_PASSWORD ?= 12345678
DB_NAME ?= wanye

dev: ## Start MySQL container
	docker compose up -d mysql
	@echo "MySQL started on $(DB_HOST):$(DB_PORT)"
	@echo "Run 'make api' and 'make web' in separate terminals"

api: ## Start the REST API server
	cd backend && DB_HOST=$(DB_HOST) DB_PORT=$(DB_PORT) DB_USER=$(DB_USER) DB_PASSWORD=$(DB_PASSWORD) DB_NAME=$(DB_NAME) go run cmd/api/main.go

mcp: ## Start the MCP server (stdio)
	cd backend && DB_HOST=$(DB_HOST) DB_PORT=$(DB_PORT) DB_USER=$(DB_USER) DB_PASSWORD=$(DB_PASSWORD) DB_NAME=$(DB_NAME) MCP_TRANSPORT=stdio go run cmd/mcp/main.go

mcp-sse: ## Start the MCP server (SSE)
	cd backend && DB_HOST=$(DB_HOST) DB_PORT=$(DB_PORT) DB_USER=$(DB_USER) DB_PASSWORD=$(DB_PASSWORD) DB_NAME=$(DB_NAME) MCP_TRANSPORT=sse MCP_PORT=9090 go run cmd/mcp/main.go

web: ## Start the Next.js frontend
	cd frontend && npm run dev

build: ## Build all
	cd backend && go build -o bin/api cmd/api/main.go && go build -o bin/mcp cmd/mcp/main.go
	cd frontend && npm run build

test: ## Run tests
	cd backend && go test ./...

docker-up: ## Start all Docker services
	docker compose up -d

docker-down: ## Stop all Docker services
	docker compose down

docker-logs: ## View Docker logs
	docker compose logs -f

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
