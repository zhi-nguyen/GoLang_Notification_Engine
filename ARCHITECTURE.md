# Architecture

This document describes the internal architecture of GONotification_Engine, a high-performance
notification platform designed for 100K+ concurrent connections. It covers system topology,
layer responsibilities, data flow, messaging semantics, and deployment strategy.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Project Structure](#project-structure)
4. [Layer Responsibilities](#layer-responsibilities)
5. [Domain Model](#domain-model)
6. [Notification Lifecycle](#notification-lifecycle)
7. [Messaging Topology](#messaging-topology)
8. [WebSocket Subsystem](#websocket-subsystem)
9. [Worker Subsystem](#worker-subsystem)
10. [Authentication and Authorization](#authentication-and-authorization)
11. [Database Schema](#database-schema)
12. [Configuration Management](#configuration-management)
13. [Graceful Shutdown](#graceful-shutdown)
14. [Deployment Architecture](#deployment-architecture)
15. [Technology Stack](#technology-stack)
16. [Design Decisions](#design-decisions)

---

## System Overview

GONotification_Engine is a server-side notification platform that accepts notification requests
via a REST API, persists them in PostgreSQL, fans them out through NATS for real-time WebSocket
delivery, and dispatches them asynchronously to external channels (Email, SMS, Push) via
dedicated background workers.

The system is organized around Clean Architecture principles. Dependencies point inward:
transport and infrastructure layers depend on the domain and usecase layers, never the reverse.

---

## High-Level Architecture

```
+-------------------+          +-------------------+
|   React Frontend  |          |   External Client |
|   (Vite + TS)     |          |   (curl / SDK)    |
+--------+----------+          +--------+----------+
         |  WebSocket                    |  REST API
         |  (wss://.../ws)               |  (POST/GET)
         v                              v
+--------+------------------------------+----------+
|                   HTTP Server                     |
|          (Go net/http, port 8080)                 |
|                                                   |
|   +-------------+   +----------------------------+|
|   | WS Upgrade  |   | REST Router (ServeMux)     ||
|   | Handler     |   | /health                    ||
|   | (JWT auth)  |   | /api/v1/auth/token         ||
|   +------+------+   | /api/v1/notifications/...  ||
|          |           +-------------+--------------+|
+----------+-------------------------+--------------+
           |                         |
           v                         v
    +------+------+         +--------+---------+
    | WebSocket   |         | Notification     |
    | Hub         |         | Usecase          |
    | (state      |         | (business logic) |
    |  machine)   |         +--------+---------+
    +------+------+                  |
           ^                   +-----+------+
           |                   |            |
           |              +----+---+  +-----+-----+
           |              | Repo   |  | Publisher  |
           |              | (PgSQL)|  | (NATS)     |
           |              +--------+  +-----+------+
           |                                |
           |         +----------------------+
           |         |
           |    +----+----+----+----+----+--------+
           |    |         |         |              |
           |    v         v         v              v
           | JetStream JetStream JetStream   NATS Core
           | Consumer  Consumer  Consumer    PubSub
           | (Email)   (SMS)     (Push)      (ws.broadcast
           |    |         |         |         ws.user.*)
           |    v         v         v              |
           | EmailSender SMSSender PushSender      |
           |                                       |
           +---------------------------------------+
                    WSDeliveryWorker
```

---

## Project Structure

```
GONotification_Engine/
|-- backend/
|   |-- cmd/server/           # Application entry point (main.go)
|   |-- internal/
|   |   |-- auth/             # JWT token generation and validation
|   |   |-- config/           # Environment-based configuration loader
|   |   |-- domain/           # Core entities, repository and publisher interfaces
|   |   |-- infrastructure/
|   |   |   |-- email/        # Email sender implementation (mock)
|   |   |   |-- nats/         # NATS Core + JetStream client and publisher
|   |   |   |-- push/         # Push notification sender implementation (mock)
|   |   |   |-- sms/          # SMS sender implementation (mock)
|   |   |-- repository/
|   |   |   |-- postgres/     # PostgreSQL notification repository
|   |   |-- transport/
|   |   |   |-- http/         # REST handler, router, middleware stack
|   |   |   |-- ws/           # WebSocket hub, client, upgrade handler
|   |   |-- usecase/          # Business logic orchestration
|   |   |-- worker/           # Background workers (Email, SMS, Push, WS delivery)
|   |-- migrations/           # SQL migration files
|   |-- pkg/logger/           # Structured logger (zerolog) initialization
|   |-- go.mod, go.sum
|-- frontend/                 # React (Vite + TypeScript) dashboard
|-- docker-compose.yml        # Service orchestration (NATS, PostgreSQL, Backend)
|-- Dockerfile.backend        # Multi-stage Docker build
|-- Makefile                  # Development commands
|-- .env.example              # Environment variable template
```

---

## Layer Responsibilities

### Domain Layer (`internal/domain/`)

The innermost layer. Contains pure Go types and interface definitions with zero external
dependencies. Defines:

- **Notification** -- the core aggregate with fields for targeting, channels, status tracking,
  and timestamps.
- **SendRequest** -- the inbound DTO for creating a new notification.
- **NotificationRepository** -- persistence contract (Create, GetByID, List, ListSince,
  UpdateStatus, GetStats).
- **MessagePublisher** -- messaging contract (PublishBroadcast, PublishToUser,
  PublishWorkerTask).
- **NotificationSender** -- delivery contract for external channels (Send).
- Typed enumerations: `NotificationType` (push, email, sms, app_alert),
  `TargetType` (all, user, segment), `NotificationStatus` (pending, sending, completed,
  failed).

### Usecase Layer (`internal/usecase/`)

Orchestrates the notification lifecycle:

1. Validates and enriches the incoming `SendRequest`.
2. Generates a UUID and constructs the `Notification` aggregate.
3. Persists to the repository (if available).
4. Publishes real-time delivery events via the message publisher (broadcast or targeted).
5. Publishes durable worker tasks for each requested channel (email, sms, push).
6. Exposes query methods: `GetByID`, `List`, `ListSince`, `GetStats`.

### Transport Layer (`internal/transport/`)

**HTTP** -- Standard library `net/http` router with `ServeMux` pattern matching.
Middleware stack applied in order: Recoverer, Logger, CORS. Protected endpoints use
`JWTAuthMiddleware`. Handlers decode requests, invoke the usecase, and encode JSON responses.

**WebSocket** -- Gorilla WebSocket upgrade handler with JWT authentication (token accepted
via query parameter or Authorization header). After upgrade, two per-connection goroutines
are launched: `ReadPump` and `WritePump`.

### Infrastructure Layer (`internal/infrastructure/`)

Implements domain interfaces for external systems:

- **NATS Client** -- Connects to NATS with auto-reconnect, initializes a JetStream stream
  (`NOTIFICATIONS`) with work-queue retention, and implements `MessagePublisher`.
  Uses NATS Core PubSub for low-latency WebSocket fanout and JetStream for durable
  worker task delivery.
- **Email/SMS/Push Senders** -- Mock implementations of `NotificationSender` with configurable
  latency. Designed for interface-driven replacement with production providers (SendGrid,
  Twilio, FCM).

### Repository Layer (`internal/repository/`)

PostgreSQL implementation of `NotificationRepository` using `pgxpool` connection pooling.
All queries use parameterized statements. Supports:

- Insert with application-generated UUID.
- Single-row lookup by ID.
- Paginated listing (descending by creation time).
- Cursor-based listing since a timestamp (ascending).
- Aggregated status statistics.

### Worker Layer (`internal/worker/`)

Background consumers that process messages from NATS:

- **EmailWorker, SMSWorker, PushWorker** -- JetStream durable consumers with explicit
  acknowledgment. Deserialize notification payloads, delegate to the corresponding
  `NotificationSender`, and update the repository with success/failure status.
- **WSDeliveryWorker** -- NATS Core PubSub subscriber. Listens on `ws.broadcast` and
  `ws.user.*` subjects and forwards payloads to the WebSocket Hub for real-time client
  delivery.

---

## Domain Model

### Notification Entity

| Field       | Type                 | Description                                      |
|-------------|----------------------|--------------------------------------------------|
| `id`        | `string` (UUID)      | Unique identifier, generated at creation time    |
| `title`     | `string`             | Notification headline                            |
| `body`      | `string`             | Notification content body                        |
| `type`      | `NotificationType`   | Semantic type: push, email, sms, app_alert       |
| `channels`  | `[]string`           | Delivery channels to dispatch to                 |
| `target`    | `TargetConfig`       | Targeting configuration (type + optional IDs)    |
| `status`    | `NotificationStatus` | Lifecycle state: pending, sending, completed, failed |
| `sent_count`| `int`                | Number of successful deliveries                  |
| `fail_count`| `int`                | Number of failed delivery attempts               |
| `created_at`| `time.Time`          | Creation timestamp (RFC 3339)                    |
| `updated_at`| `time.Time`          | Last modification timestamp (RFC 3339)           |

### TargetConfig

| Field  | Type         | Description                                       |
|--------|--------------|---------------------------------------------------|
| `type` | `TargetType` | Audience scope: all, user, segment                |
| `ids`  | `[]string`   | Target user or segment IDs (empty for broadcast)  |

---

## Notification Lifecycle

```
  Client POST /api/v1/notifications/send
                    |
                    v
          +-------------------+
          | Validate Request  |
          | Generate UUID     |
          +--------+----------+
                   |
          +--------v----------+
          | Persist to        |
          | PostgreSQL        |
          +--------+----------+
                   |
        +----------+----------+
        |                     |
        v                     v
  +-----------+     +-------------------+
  | Publish   |     | Publish Worker    |
  | WS events |     | Tasks (JetStream) |
  | (NATS     |     | per channel       |
  |  Core)    |     +--------+----------+
  +-----+-----+              |
        |              +-----+------+------+
        v              |           |       |
  WSDelivery      EmailWorker  SMSWorker  PushWorker
  Worker               |           |       |
        |              v           v       v
        v          Send via    Send via  Send via
  Hub.Broadcast    provider   provider  provider
  or Hub.SendToUser    |           |       |
        |              +-----+-----+------+
        v                    |
  WebSocket Clients    Update status
  receive payload      in PostgreSQL
```

1. The API handler decodes the JSON payload and calls `NotificationUsecase.SendNotification`.
2. The usecase validates required fields, applies defaults (type defaults to `app_alert`,
   target defaults to `all`), and generates a UUID v4 identifier.
3. The notification is persisted to PostgreSQL via the repository.
4. Based on target type, the usecase publishes either a broadcast or targeted message
   to NATS Core PubSub subjects (`ws.broadcast` or `ws.user.<id>`).
5. For each channel in the request (email, sms, push), a durable task is published
   to the JetStream stream under `notifications.<channel>`.
6. The `WSDeliveryWorker` receives the PubSub message and forwards it to the Hub.
7. Channel workers consume from JetStream, invoke the sender, and update the notification
   status in the database.

---

## Messaging Topology

### NATS Core PubSub (Real-Time Path)

Used for fire-and-forget, low-latency WebSocket delivery. Messages are not persisted.

| Subject           | Publisher         | Subscriber          | Purpose                       |
|-------------------|-------------------|---------------------|-------------------------------|
| `ws.broadcast`    | NATSClient        | WSDeliveryWorker    | Broadcast to all WS clients   |
| `ws.user.<id>`    | NATSClient        | WSDeliveryWorker    | Targeted delivery to a user   |

### NATS JetStream (Durable Path)

Used for guaranteed, at-least-once delivery to channel workers. Stream configuration:

| Property    | Value                    |
|-------------|--------------------------|
| Stream Name | `NOTIFICATIONS`          |
| Subjects    | `notifications.>`        |
| Retention   | Work Queue               |
| Storage     | File                     |

| Subject              | Consumer        | Durable Name     |
|----------------------|-----------------|------------------|
| `notifications.email`| EmailWorker     | `email-worker`   |
| `notifications.sms`  | SMSWorker       | `sms-worker`     |
| `notifications.push` | PushWorker      | `push-worker`    |

All consumers use explicit acknowledgment policy. On processing failure, messages are
negatively acknowledged (NAK) and redelivered by JetStream.

---

## WebSocket Subsystem

### Hub State Machine

The Hub is the central coordinator for all WebSocket connections. It runs a single event loop
goroutine that processes four channel types:

- **register** -- Adds a client to the global client set and indexes it by user ID in
  the `userClients` map.
- **unregister** -- Removes a client from both maps and closes its send channel.
- **broadcast** -- Iterates all registered clients and performs a non-blocking send.
  Clients with full send buffers are asynchronously unregistered to prevent head-of-line
  blocking.
- **userMessage** -- Delivers a message to all sessions belonging to a specific user ID
  using the same non-blocking send pattern.

Channel buffer sizes:

| Channel       | Buffer Size |
|---------------|-------------|
| `broadcast`   | 256         |
| `userMessage` | 256         |
| `register`    | 64          |
| `unregister`  | 64          |

### Client Pump Model

Each WebSocket connection spawns two goroutines:

**ReadPump** -- Reads messages from the client. Sets read limits (512 KB), configures
pong handler for keep-alive (60s timeout), and broadcasts received messages to the Hub.

**WritePump** -- Drains the client's buffered send channel and writes to the WebSocket
connection. Coalesces queued messages into a single WebSocket frame for efficiency.
Sends periodic ping frames (every 54s) to detect dead connections.

### Connection Lifecycle

1. Client connects to `GET /ws?token=<jwt>`.
2. Handler extracts and validates the JWT token.
3. HTTP connection is upgraded to WebSocket via Gorilla upgrader.
4. A `Client` struct is created with a 256-slot send buffer.
5. Client is registered with the Hub.
6. ReadPump and WritePump goroutines are launched.
7. On disconnect (or pong timeout), the client is unregistered and the connection is closed.

---

## Worker Subsystem

All channel workers follow an identical pattern:

1. Create or update a durable JetStream consumer filtered to their subject.
2. Start an async consume loop that processes messages in callback form.
3. On message receipt: unmarshal the notification, invoke the sender, and update the
   repository status.
4. On success: ACK the message. On failure: NAK the message for redelivery.
5. On context cancellation: stop the consumer gracefully.

The `WSDeliveryWorker` differs in that it uses NATS Core PubSub (not JetStream) for
lower latency. It subscribes to `ws.broadcast` and `ws.user.*` and delegates directly
to `Hub.Broadcast()` and `Hub.SendToUser()`.

---

## Authentication and Authorization

The system uses HMAC-SHA256 signed JSON Web Tokens (JWT).

### Token Generation

`POST /api/v1/auth/token` accepts a JSON body with `user_id` and returns a signed token
with a 24-hour expiration. This endpoint is public and intended for development and
client bootstrapping.

### Token Claims

| Claim      | Description                  |
|------------|------------------------------|
| `user_id`  | Application-level user ID    |
| `exp`      | Expiration timestamp         |
| `iat`      | Issued-at timestamp          |

### Middleware

The `JWTAuthMiddleware` extracts the token from the `Authorization: Bearer <token>` header,
validates it, and injects the `user_id` into the request context. Protected endpoints
return `401 Unauthorized` for missing, malformed, or expired tokens.

### WebSocket Authentication

The WebSocket upgrade handler accepts tokens via:
1. Query parameter: `GET /ws?token=<jwt>`
2. Authorization header: `Authorization: Bearer <jwt>`

---

## Database Schema

PostgreSQL 16 with the following table:

```sql
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    body        TEXT NOT NULL,
    type        VARCHAR(50) NOT NULL,
    channels    TEXT[] NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_ids  TEXT[],
    status      VARCHAR(50) NOT NULL DEFAULT 'pending',
    sent_count  INT NOT NULL DEFAULT 0,
    fail_count  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `idx_notifications_created_at` on `created_at DESC` -- optimizes paginated listing.
- `idx_notifications_status` on `status` -- optimizes status aggregation queries.

---

## Configuration Management

All configuration is sourced from environment variables with sensible defaults.
A `.env` file loader searches the current directory and parent directories.

| Variable              | Default                                              | Description                        |
|-----------------------|------------------------------------------------------|------------------------------------|
| `API_PORT`            | `8080`                                               | HTTP server listen port            |
| `WS_MAX_CONNECTIONS`  | `100000`                                             | Maximum WebSocket connections      |
| `DATABASE_URL`        | `postgres://user:pass@127.0.0.1:5435/notifications`  | PostgreSQL connection string       |
| `NATS_URL`            | `nats://127.0.0.1:4222`                              | NATS server URL                    |
| `JWT_SECRET`          | (required, min 16 chars)                             | HMAC signing key for JWT tokens    |
| `LOG_LEVEL`           | `info`                                               | Log verbosity (debug/info/warn/error) |
| `EMAIL_PROVIDER`      | `mock`                                               | Email provider implementation      |
| `SMS_PROVIDER`        | `mock`                                               | SMS provider implementation        |
| `PUSH_PROVIDER`       | `mock`                                               | Push provider implementation       |

Validation enforces non-empty `JWT_SECRET` (minimum 16 characters), `DATABASE_URL`,
and `NATS_URL`.

---

## Graceful Shutdown

The server implements orderly shutdown on receipt of `SIGINT` or `SIGTERM`:

1. Signal is captured via `os/signal.Notify`.
2. The root context is cancelled, propagating to all workers and the Hub event loop.
3. The HTTP server is shut down with a 5-second deadline, allowing in-flight requests
   to complete.
4. NATS connection is closed (deferred).
5. PostgreSQL connection pool is closed (deferred).
6. Worker consumers are stopped via context cancellation.
7. The WebSocket Hub cleans up all client connections and closes their send channels.

---

## Deployment Architecture

### Docker Compose (Development / Staging)

The `docker-compose.yml` orchestrates three services:

| Service    | Image                | Ports         | Health Check           |
|------------|----------------------|---------------|------------------------|
| `nats`     | `nats:2.10-alpine`   | 4222, 8222    | HTTP GET `/varz`       |
| `postgres` | `postgres:16-alpine` | 5435 -> 5432  | `pg_isready`           |
| `backend`  | Custom (multi-stage) | 8080          | Depends on NATS + PG   |

The backend service starts only after both NATS and PostgreSQL pass their health checks.
Database migrations are automatically applied via the PostgreSQL `initdb.d` mount.

### Docker Image

The `Dockerfile.backend` uses a multi-stage build:

1. **Builder stage** (`golang:1.22-alpine`): Downloads dependencies, compiles a statically
   linked binary with `-ldflags="-w -s"` for minimal size.
2. **Runtime stage** (`alpine:3.19`): Copies the binary and migration files. Adds only
   `ca-certificates` and `tzdata` for TLS and timezone support.

---

## Technology Stack

| Component        | Technology                          | Purpose                          |
|------------------|-------------------------------------|----------------------------------|
| Language         | Go 1.22                             | Server runtime                   |
| HTTP Router      | `net/http` (stdlib ServeMux)        | REST API routing                 |
| WebSocket        | gorilla/websocket                   | Bidirectional real-time comms    |
| Message Broker   | NATS 2.10 + JetStream              | PubSub and durable queues        |
| Database         | PostgreSQL 16                       | Notification persistence         |
| DB Driver        | pgx/v5 (pgxpool)                   | Connection pooling               |
| Authentication   | golang-jwt/jwt/v5                   | HMAC-SHA256 JWT                  |
| Logging          | rs/zerolog                          | Structured JSON/console logging  |
| Testing          | testing + testify                   | Unit and integration tests       |
| Frontend         | React + Vite + TypeScript           | Dashboard UI                     |
| Containerization | Docker + Docker Compose             | Service orchestration            |

---

## Design Decisions

### Why Two NATS Transport Modes

NATS Core PubSub is used for WebSocket fanout because it offers the lowest possible latency
with no persistence overhead. Message loss is acceptable since WebSocket clients can recover
missed notifications via the `ListSince` catch-up API.

NATS JetStream is used for channel workers (email, sms, push) because these operations
require at-least-once delivery guarantees. The work-queue retention policy ensures each
message is processed by exactly one consumer instance.

### Why Standard Library Router

Go 1.22 introduced pattern matching in `http.ServeMux` with method-based routing
(`GET /path`, `POST /path`), path parameters (`{id}`), and wildcard support. This
eliminates the need for third-party routers while maintaining full compatibility with
the `http.Handler` interface.

### Non-Blocking Broadcast

The Hub uses non-blocking channel sends (`select` with `default`) to prevent a single
slow client from blocking broadcasts to all other clients. Clients that cannot keep up
are asynchronously unregistered. This design trades delivery to slow clients for system-wide
throughput stability.

### Graceful Degradation

The server starts successfully even if PostgreSQL or NATS are unavailable. Components
that depend on unavailable services are disabled at startup with warning logs, allowing
the HTTP health check and other independent functionality to remain operational.
