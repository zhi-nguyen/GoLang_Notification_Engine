# API Guide

Complete reference for the GONotification_Engine REST API and WebSocket interface.
All HTTP endpoints return `application/json`. Timestamps follow RFC 3339 format.

---

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Generate Token](#generate-token)
  - [Send Notification](#send-notification)
  - [List Notifications](#list-notifications)
  - [Get Notification by ID](#get-notification-by-id)
  - [Get Notification Statistics](#get-notification-statistics)
- [WebSocket API](#websocket-api)
- [Data Types](#data-types)
- [Status Codes](#status-codes)

---

## Base URL

```
http://localhost:8080
```

When running via Docker Compose, the backend binds to port 8080 by default.
This can be changed via the `API_PORT` environment variable.

---

## Authentication

Protected endpoints require a valid JWT token in the `Authorization` header.

```
Authorization: Bearer <token>
```

Obtain a token via the [Generate Token](#generate-token) endpoint.

### Token Lifetime

Tokens expire 24 hours after issuance. After expiration, a new token must be generated.

### Token Claims

| Field     | Type   | Description                     |
|-----------|--------|---------------------------------|
| `user_id` | string | The authenticated user identity |
| `exp`     | number | Expiration time (Unix epoch)    |
| `iat`     | number | Issued-at time (Unix epoch)     |

---

## Error Handling

All error responses follow a consistent structure:

```json
{
  "error": "Human-readable error message"
}
```

The HTTP status code indicates the error category. The `error` field provides a
specific description suitable for logging or display.

---

## Endpoints

### Health Check

Check whether the server is running and responsive.

```
GET /health
```

**Authentication:** None

**Response: `200 OK`**

```json
{
  "status": "ok",
  "timestamp": "2026-08-09T12:00:00Z"
}
```

| Field       | Type   | Description                           |
|-------------|--------|---------------------------------------|
| `status`    | string | Always `"ok"` when server is healthy  |
| `timestamp` | string | Current server time (RFC 3339)        |

---

### Generate Token

Generate a JWT token for authenticating subsequent API calls and WebSocket connections.

```
POST /api/v1/auth/token
```

**Authentication:** None

**Request Body:**

```json
{
  "user_id": "user-123"
}
```

| Field     | Type   | Required | Description                                         |
|-----------|--------|----------|-----------------------------------------------------|
| `user_id` | string | No       | User identifier to embed in the token. Defaults to `"guest-user"` if omitted. |

**Response: `200 OK`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "user-123"
}
```

| Field     | Type   | Description                        |
|-----------|--------|------------------------------------|
| `token`   | string | Signed JWT token (24h expiry)      |
| `user_id` | string | The user ID embedded in the token  |

**Error Responses:**

| Status | Condition                    |
|--------|------------------------------|
| 500    | Token signing failure        |

**Example:**

```bash
curl -X POST http://localhost:8080/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123"}'
```

---

### Send Notification

Create and dispatch a new notification. The notification is persisted, published for
real-time WebSocket delivery, and queued for asynchronous channel processing.

```
POST /api/v1/notifications/send
```

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "title": "System Maintenance",
  "body": "Scheduled maintenance window from 02:00 to 04:00 UTC.",
  "type": "app_alert",
  "channels": ["email", "push"],
  "target": {
    "type": "all",
    "ids": []
  }
}
```

| Field      | Type     | Required | Description                                                 |
|------------|----------|----------|-------------------------------------------------------------|
| `title`    | string   | Yes      | Notification headline                                       |
| `body`     | string   | Yes      | Notification content                                        |
| `type`     | string   | No       | Notification type. Defaults to `"app_alert"`. See [NotificationType](#notificationtype). |
| `channels` | string[] | No       | Delivery channels to dispatch to. Valid values: `"email"`, `"sms"`, `"push"`. |
| `target`   | object   | No       | Targeting configuration. Defaults to broadcast (`"all"`). See [TargetConfig](#targetconfig). |

**Response: `201 Created`**

```json
{
  "message": "Notification sent successfully",
  "notification": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "System Maintenance",
    "body": "Scheduled maintenance window from 02:00 to 04:00 UTC.",
    "type": "app_alert",
    "channels": ["email", "push"],
    "target": {
      "type": "all",
      "ids": []
    },
    "status": "pending",
    "sent_count": 0,
    "fail_count": 0,
    "created_at": "2026-08-09T12:00:00Z",
    "updated_at": "2026-08-09T12:00:00Z"
  }
}
```

**Error Responses:**

| Status | Condition                               |
|--------|-----------------------------------------|
| 400    | Invalid JSON payload                    |
| 400    | Missing required fields (title, body)   |
| 401    | Missing or invalid authentication token |
| 500    | Internal server error                   |

**Examples:**

Broadcast to all users:

```bash
curl -X POST http://localhost:8080/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Welcome",
    "body": "Welcome to the platform.",
    "type": "app_alert",
    "channels": ["email"]
  }'
```

Send to specific users:

```bash
curl -X POST http://localhost:8080/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Account Alert",
    "body": "Your password was changed.",
    "type": "email",
    "channels": ["email", "sms"],
    "target": {
      "type": "user",
      "ids": ["user-123", "user-456"]
    }
  }'
```

---

### List Notifications

Retrieve a paginated list of notifications. Supports two modes: offset-based pagination
and timestamp-based cursor.

```
GET /api/v1/notifications
```

**Authentication:** Required (Bearer token)

**Query Parameters:**

| Parameter | Type   | Default | Description                                           |
|-----------|--------|---------|-------------------------------------------------------|
| `limit`   | int    | 20      | Maximum number of results to return (max: 100)        |
| `offset`  | int    | 0       | Number of records to skip (offset-based pagination)   |
| `since`   | string | --      | RFC 3339 timestamp; returns notifications created after this time |

When `since` is provided, the endpoint uses timestamp-based cursor pagination and ignores
`offset`. Results are ordered ascending by `created_at`. When `since` is omitted, results
are ordered descending by `created_at` with standard offset pagination.

**Response: `200 OK`**

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "System Maintenance",
      "body": "Scheduled maintenance window.",
      "type": "app_alert",
      "channels": ["email"],
      "target": {
        "type": "all"
      },
      "status": "completed",
      "sent_count": 1,
      "fail_count": 0,
      "created_at": "2026-08-09T12:00:00Z",
      "updated_at": "2026-08-09T12:01:00Z"
    }
  ],
  "count": 1
}
```

| Field   | Type   | Description                          |
|---------|--------|--------------------------------------|
| `data`  | array  | Array of Notification objects        |
| `count` | int    | Number of items in this response     |

**Error Responses:**

| Status | Condition                               |
|--------|-----------------------------------------|
| 401    | Missing or invalid authentication token |
| 500    | Database query failure                  |

**Examples:**

Default pagination:

```bash
curl http://localhost:8080/api/v1/notifications?limit=10&offset=0 \
  -H "Authorization: Bearer <token>"
```

Catch-up since a timestamp:

```bash
curl "http://localhost:8080/api/v1/notifications?since=2026-08-09T12:00:00Z&limit=50" \
  -H "Authorization: Bearer <token>"
```

---

### Get Notification by ID

Retrieve a single notification by its UUID.

```
GET /api/v1/notifications/{id}
```

**Authentication:** Required (Bearer token)

**Path Parameters:**

| Parameter | Type   | Description            |
|-----------|--------|------------------------|
| `id`      | string | Notification UUID      |

**Response: `200 OK`**

```json
{
  "notification": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "System Maintenance",
    "body": "Scheduled maintenance window.",
    "type": "app_alert",
    "channels": ["email"],
    "target": {
      "type": "all"
    },
    "status": "completed",
    "sent_count": 1,
    "fail_count": 0,
    "created_at": "2026-08-09T12:00:00Z",
    "updated_at": "2026-08-09T12:01:00Z"
  }
}
```

**Error Responses:**

| Status | Condition                               |
|--------|-----------------------------------------|
| 400    | Missing notification ID                 |
| 401    | Missing or invalid authentication token |
| 404    | Notification not found                  |
| 500    | Database query failure                  |

**Example:**

```bash
curl http://localhost:8080/api/v1/notifications/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer <token>"
```

---

### Get Notification Statistics

Retrieve aggregate counts of notifications grouped by status.

```
GET /api/v1/notifications/stats
```

**Authentication:** Required (Bearer token)

**Response: `200 OK`**

```json
{
  "stats": {
    "pending": 12,
    "sending": 3,
    "completed": 145,
    "failed": 2
  }
}
```

| Field              | Type | Description                         |
|--------------------|------|-------------------------------------|
| `stats.pending`    | int  | Notifications awaiting processing   |
| `stats.sending`    | int  | Notifications currently in transit  |
| `stats.completed`  | int  | Successfully delivered              |
| `stats.failed`     | int  | Delivery failures                   |

**Error Responses:**

| Status | Condition                               |
|--------|-----------------------------------------|
| 401    | Missing or invalid authentication token |
| 500    | Database query failure                  |

**Example:**

```bash
curl http://localhost:8080/api/v1/notifications/stats \
  -H "Authorization: Bearer <token>"
```

---

## WebSocket API

### Connection

```
GET /ws?token=<jwt>
```

The WebSocket endpoint upgrades an HTTP connection to a persistent, bidirectional WebSocket
connection. Authentication is performed during the upgrade handshake.

### Authentication Methods

The token can be provided via either method:

1. **Query parameter** (recommended for browser clients):
   ```
   ws://localhost:8080/ws?token=eyJhbGci...
   ```

2. **Authorization header** (for non-browser clients):
   ```
   Authorization: Bearer eyJhbGci...
   ```

### Connection Errors

| Status | Condition                                  |
|--------|--------------------------------------------|
| 401    | Missing token                              |
| 401    | Invalid or expired token                   |

### Message Format

Notifications are delivered as JSON text frames:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "New Message",
  "body": "You have a new notification.",
  "type": "app_alert",
  "channels": [],
  "target": {
    "type": "all"
  },
  "status": "pending",
  "sent_count": 0,
  "fail_count": 0,
  "created_at": "2026-08-09T12:00:00Z",
  "updated_at": "2026-08-09T12:00:00Z"
}
```

### Delivery Modes

- **Broadcast**: When a notification targets `"all"`, every connected client receives it.
- **Targeted**: When a notification targets specific user IDs, only sessions authenticated
  with those IDs receive the message.

### Keep-Alive

The server sends WebSocket ping frames every 54 seconds. Clients must respond with pong
frames within 60 seconds or the connection will be closed.

### Client-to-Server Messages

Messages sent from clients to the server are broadcast to all connected clients via the Hub.
Maximum message size: 512 KB.

### Integration Example (JavaScript)

```javascript
// 1. Obtain a token
const response = await fetch("http://localhost:8080/api/v1/auth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ user_id: "user-123" })
});
const { token } = await response.json();

// 2. Connect to WebSocket
const ws = new WebSocket(`ws://localhost:8080/ws?token=${token}`);

ws.onopen = () => {
  console.log("Connected to notification stream");
};

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log(`[${notification.type}] ${notification.title}: ${notification.body}`);
};

ws.onclose = (event) => {
  console.log("Disconnected:", event.code, event.reason);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};
```

### Missed Message Recovery

If a client disconnects and reconnects, it can recover missed notifications by calling
the List Notifications endpoint with the `since` parameter set to the timestamp of
the last received notification:

```bash
GET /api/v1/notifications?since=2026-08-09T12:00:00Z&limit=100
```

---

## Data Types

### Notification

The primary entity returned by all notification endpoints.

| Field        | Type     | Description                                      |
|--------------|----------|--------------------------------------------------|
| `id`         | string   | UUID v4 identifier                               |
| `title`      | string   | Notification headline                            |
| `body`       | string   | Notification content body                        |
| `type`       | string   | Notification type (see NotificationType)         |
| `channels`   | string[] | Delivery channels dispatched to                  |
| `target`     | object   | Targeting configuration (see TargetConfig)       |
| `status`     | string   | Current lifecycle status (see NotificationStatus)|
| `sent_count` | int      | Number of successful deliveries                  |
| `fail_count` | int      | Number of failed delivery attempts               |
| `created_at` | string   | Creation timestamp (RFC 3339)                    |
| `updated_at` | string   | Last update timestamp (RFC 3339)                 |

### NotificationType

| Value       | Description                     |
|-------------|---------------------------------|
| `push`      | Mobile push notification        |
| `email`     | Email notification              |
| `sms`       | SMS text message                |
| `app_alert` | In-app alert (default)          |

### TargetConfig

| Field  | Type     | Description                                             |
|--------|----------|---------------------------------------------------------|
| `type` | string   | Audience scope: `"all"`, `"user"`, or `"segment"`       |
| `ids`  | string[] | Target user or segment IDs. Empty or omitted for `"all"`.|

### NotificationStatus

| Value       | Description                              |
|-------------|------------------------------------------|
| `pending`   | Created but not yet processed by workers |
| `sending`   | Currently being processed                |
| `completed` | Successfully delivered                   |
| `failed`    | Delivery failed                          |

---

## Status Codes

| Code | Meaning                 | Usage                                      |
|------|-------------------------|--------------------------------------------|
| 200  | OK                      | Successful GET request                     |
| 201  | Created                 | Notification successfully created          |
| 204  | No Content              | CORS preflight response                    |
| 400  | Bad Request             | Invalid input, missing required fields     |
| 401  | Unauthorized            | Missing, malformed, or expired JWT token   |
| 404  | Not Found               | Requested resource does not exist          |
| 500  | Internal Server Error   | Unexpected server-side failure             |
