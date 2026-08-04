# GONotification_Engine

High-performance Notification Engine supporting 100K+ concurrent users built with **Go**, **WebSocket**, **NATS JetStream**, **PostgreSQL**, and **React**.

## Architecture Overview

- **WebSocket Tier**: Multi-node stateless WebSocket Hubs for low latency real-time broadcasts.
- **Message Broker Layer**: NATS Core PubSub for WebSocket broadcast fanout; NATS JetStream for durable async delivery workers (Email, SMS, Push).
- **API Layer**: Go Chi REST API for broadcast requests and catch-up queries.
- **Storage Layer**: PostgreSQL for notification history and state tracking.

## Quick Start

```bash
# Start all services with Docker Compose
make dev
```

## Testing

```bash
# Run unit tests with race detection
make test
```
