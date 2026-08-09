# GONotification_Engine

A high-performance notification engine built with Go, designed to support 100K+ concurrent
WebSocket connections with multi-channel delivery (Email, SMS, Push) powered by
NATS JetStream and PostgreSQL.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Manual Setup](#manual-setup)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [WebSocket Integration](#websocket-integration)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Development Commands](#development-commands)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

GONotification_Engine is a server-side platform that accepts notification requests via a
REST API, persists them in PostgreSQL, fans them out through NATS for real-time WebSocket
delivery, and dispatches them asynchronously to external channels through dedicated
background workers.

The system is built on Clean Architecture principles with strict separation between domain
logic, transport, and infrastructure concerns.

---

## Key Features

- **Real-time WebSocket delivery** with Hub state machine and non-blocking broadcast
- **Multi-channel dispatch** via email, SMS, and push notification workers
- **NATS JetStream** for durable, at-least-once message processing with work-queue semantics
- **NATS Core PubSub** for low-latency WebSocket fanout
- **PostgreSQL** persistence with connection pooling (pgx/v5)
- **JWT authentication** (HMAC-SHA256) for both REST API and WebSocket connections
- **Graceful degradation** -- server starts and operates even when database or broker is unavailable
- **Graceful shutdown** with in-flight request draining and orderly resource cleanup
- **Catch-up query** API for clients to recover missed notifications
- **Docker Compose** orchestration with health checks and automatic migration
- **Comprehensive test suite** with race detection

---

## Architecture

The system is organized into four primary tiers:

```
  REST Clients / React Frontend
            |
    +-------+--------+
    | HTTP + WS      |    Transport Layer
    | (Go net/http)  |
    +-------+--------+
            |
    +-------+--------+
    | Usecase        |    Business Logic
    +--+----------+--+
       |          |
  +----+---+ +---+------+
  | PgSQL  | | NATS     |    Infrastructure
  +--------+ +---+------+
                  |
     +------------+------------+
     |            |            |
  Email       SMS          Push       Workers
  Worker      Worker       Worker
```

For a detailed breakdown of each layer, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and
  [Docker Compose](https://docs.docker.com/compose/install/) (recommended)
- [Go 1.22+](https://go.dev/dl/) (for local development without Docker)
- [Node.js 18+](https://nodejs.org/) (for the frontend dashboard)

---

## Quick Start

The fastest way to run the full stack is with Docker Compose:

```bash
# Clone the repository
git clone https://github.com/zhi-nguyen/GoLang_Notification_Engine.git
cd GoLang_Notification_Engine

# Copy environment template
cp .env.example .env

# Start all services (NATS, PostgreSQL, Backend)
make dev
```

The backend will be available at `http://localhost:8080`. Database migrations run
automatically on first start.

### Verify the server is running

```bash
curl http://localhost:8080/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-08-09T12:00:00Z"
}
```

---

## Manual Setup

### 1. Start infrastructure services

```bash
docker compose up -d nats postgres
```

### 2. Run database migrations

```bash
make migrate
```

### 3. Start the backend

```bash
cd backend
go run ./cmd/server
```

### 4. Start the frontend (optional)

```bash
cd frontend
npm install
npm run dev
```

---

## Configuration

All configuration is sourced from environment variables. A `.env` file in the project root
is loaded automatically.

| Variable              | Default      | Description                                |
|-----------------------|--------------|--------------------------------------------|
| `API_PORT`            | `8080`       | HTTP server listen port                    |
| `WS_MAX_CONNECTIONS`  | `100000`     | Maximum WebSocket connections              |
| `DATABASE_URL`        | (see below)  | PostgreSQL connection string               |
| `NATS_URL`            | `nats://127.0.0.1:4222` | NATS server URL               |
| `JWT_SECRET`          | (required)   | HMAC signing key, minimum 16 characters    |
| `LOG_LEVEL`           | `info`       | Log level: debug, info, warn, error        |
| `EMAIL_PROVIDER`      | `mock`       | Email sender implementation                |
| `SMS_PROVIDER`        | `mock`       | SMS sender implementation                  |
| `PUSH_PROVIDER`       | `mock`       | Push sender implementation                 |

Default `DATABASE_URL`: `postgres://user:pass@127.0.0.1:5435/notifications?sslmode=disable`

See `.env.example` for a complete template.

---

## API Reference

All endpoints return JSON. Protected endpoints require an `Authorization: Bearer <token>`
header.

### Public Endpoints

| Method | Path                       | Description             |
|--------|----------------------------|-------------------------|
| GET    | `/health`                  | Server health check     |
| POST   | `/api/v1/auth/token`       | Generate a JWT token    |

### Protected Endpoints

| Method | Path                              | Description                       |
|--------|-----------------------------------|-----------------------------------|
| POST   | `/api/v1/notifications/send`      | Send a new notification           |
| GET    | `/api/v1/notifications`           | List notifications (paginated)    |
| GET    | `/api/v1/notifications/stats`     | Get notification status counts    |
| GET    | `/api/v1/notifications/{id}`      | Get a single notification by ID   |

### WebSocket Endpoint

| Method | Path   | Authentication            | Description                |
|--------|--------|---------------------------|----------------------------|
| GET    | `/ws`  | Query param or Bearer     | Upgrade to WebSocket       |

For detailed request/response schemas and examples, see [APIGUIDE.md](APIGUIDE.md).

---

## WebSocket Integration

### Connect

```javascript
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log("Received:", notification);
};
```

### Message Format

Notifications delivered via WebSocket use the same JSON structure as the REST API
`Notification` object.

---

## Testing

```bash
# Run all tests with race detection
make test

# Run tests for a specific package
cd backend && go test ./internal/usecase/... -v

# Run tests with coverage
cd backend && go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

Test coverage includes:
- JWT generation and validation
- Notification usecase (send, get, list, stats)
- HTTP handler request/response
- HTTP middleware (CORS, auth, recovery, logging)
- WebSocket Hub state machine (register, unregister, broadcast, targeted delivery)
- WebSocket upgrade handler authentication
- Worker message processing (email, SMS, push, WS delivery)

---

## Project Structure

```
GONotification_Engine/
|-- backend/
|   |-- cmd/server/main.go           Entry point, dependency wiring
|   |-- internal/
|   |   |-- auth/                     JWT manager
|   |   |-- config/                   Environment config loader
|   |   |-- domain/                   Entities and interfaces
|   |   |-- infrastructure/           NATS client, mock senders
|   |   |-- repository/postgres/      PostgreSQL data access
|   |   |-- transport/http/           REST handler + middleware
|   |   |-- transport/ws/             WebSocket hub + client
|   |   |-- usecase/                  Business logic
|   |   |-- worker/                   Background consumers
|   |-- migrations/                   SQL schema files
|   |-- pkg/logger/                   Structured logger
|-- frontend/                         React dashboard (Vite + TS)
|-- docker-compose.yml                Service orchestration
|-- Dockerfile.backend                Multi-stage Docker build
|-- Makefile                          Dev commands
|-- ARCHITECTURE.md                   Detailed architecture docs
|-- APIGUIDE.md                       Complete API reference
|-- CONTRIBUTING.md                   Contribution guidelines
```

---

## Development Commands

| Command          | Description                                    |
|------------------|------------------------------------------------|
| `make dev`       | Start all services via Docker Compose          |
| `make test`      | Run Go unit tests with race detection          |
| `make lint`      | Run golangci-lint                              |
| `make migrate`   | Execute SQL migrations against PostgreSQL      |
| `make clean`     | Stop all services and remove volumes           |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching model, commit conventions, and
development workflow.

---

## License

This project is developed for educational and portfolio purposes.
