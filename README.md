# EndpointLab

EndpointLab is a full-stack workspace for storing endpoint definitions and firing test transmissions to them over HTTP, HTTPS, TCP, and UDP.

It gives you:
- A React UI for creating, organizing, importing, exporting, and executing endpoint definitions
- An Express API with SQLite persistence
- An optional local Python listener for receiving requests and sending back simple test responses

EndpointLab does not host the configured endpoints itself. The saved records are targets to send traffic to. If you want something local to receive that traffic, run `listener.py`.

Docker Hub image:
- https://hub.docker.com/r/oseiasrocha/endpointlab

## Features

- Create, edit, duplicate, delete, search, and filter endpoint definitions
- Group endpoints and move them between groups with drag and drop
- Execute HTTP, HTTPS, TCP, and UDP transmissions from the UI
- View HTTP status codes and connection errors inline on the result card
- Store an expected JSON response and compare it with the received response in the UI
- Import and export endpoint definitions as ZIP archives
- Persist data in SQLite
- Run locally as separate frontend and backend processes or as a single Docker container
- Create secure WSS servers with TLS credentials supplied through environment variables

## Repository Layout

- `frontend/` React 19 + Vite + MUI client
- `backend/` Express 5 + TypeScript API and SQLite access
- `shared/` Shared Zod schemas and TypeScript types
- `listener.py` Optional local HTTP, HTTPS, TCP, and UDP receiver for manual testing

## How It Works

1. The frontend calls the backend API under `/api/endpoints`.
2. The backend stores endpoint definitions in SQLite.
3. Clicking **Execute** on a card calls `POST /api/endpoints/:id/send`.
4. The backend opens an outgoing HTTP, HTTPS, TCP, or UDP connection to the saved target.
5. If the endpoint expects a response, the UI shows the received payload and, when possible, diffs it against the saved expected JSON.

## Endpoint Shape

Each saved endpoint uses this schema:

```json
{
  "externalId": "6a247376-4efd-4791-b2d5-dbc0fd4f1aab",
  "name": "Local TCP echo",
  "description": "Optional note",
  "protocol": "HTTPS",
  "host": "localhost",
  "port": 8443,
  "httpMethod": "POST",
  "path": "/echo",
  "requestBody": "{\"hello\":true}",
  "hasResponse": true,
  "responseBody": "{\"response\":2}",
  "group": "Local listeners"
}
```

Notes:
- `httpMethod` and `path` are required when `protocol` is `HTTP` or `HTTPS`.
- `responseBody` is an expected response used by the UI for comparison. It is not served by the backend.
- Exported files keep a stable hidden `externalId` so imports can update the same logical endpoint without clobbering unrelated ones.
- HTTPS transmissions rely on Node's default TLS trust store. Set `NODE_EXTRA_CA_CERTS` to a PEM file path to trust additional certificate authorities (e.g. a local self-signed CA).
- WSS servers read their private key, certificate, and optional certificate chain directly from environment variables.

## API Summary

| Route | Purpose |
| --- | --- |
| `GET /api/openapi.json` | Return the backend OpenAPI document |
| `GET /api/docs` | Open the interactive Swagger UI |
| `GET /api/endpoints` | List all saved endpoints |
| `POST /api/endpoints` | Create one endpoint |
| `PUT /api/endpoints/:id` | Update one endpoint |
| `DELETE /api/endpoints/:id` | Delete one endpoint |
| `POST /api/endpoints/bulk` | Bulk import with create-or-update behavior |
| `POST /api/endpoints/:id/send` | Execute a transmission and return the result |

Bulk import returns:

```json
{
  "created": [],
  "updated": []
}
```

Transmission results look like:

```json
{
  "success": false,
  "statusCode": 404,
  "responseBody": "{\"message\":\"not found\"}",
  "error": "ECONNREFUSED",
  "latencyMs": 12
}
```

Fields:
- `success` — `true` for HTTP 2xx/3xx; `false` for 4xx/5xx or connection failures
- `statusCode` — HTTP status code when a response was received; absent for TCP, UDP, and connection-level failures
- `responseBody` — raw response body string, present only when the endpoint has `hasResponse: true`
- `error` — human-readable error for connection failures (e.g. `ECONNREFUSED`, `EPROTO`, `Request timed out`); absent on success
- `latencyMs` — round-trip time in milliseconds

## Local Development

### Prerequisites

- Node.js 22+
- npm
- Python 3 if you want to run `listener.py`

### Install dependencies

From the repository root:

```bash
npm ci
```

The repo uses npm workspaces, so install once at the root.

Backend CA behavior:
- The backend launch scripts run Node with `--use-system-ca`
- This helps outbound HTTPS endpoint execution trust locally installed root CAs
- For clients calling the backend's HTTPS server, trust depends on the certificate chain the backend presents and the certificate hostname/SANs
- Keep local HTTPS material outside Git and mount it at runtime.

### Start the backend

```bash
npm run dev:basic -w backend
```

The backend reads `backend/config/.env.development` by default and serves the API on `http://localhost:3000`.

If you want a fresh local database instead of the checked-in example DB, point `DB_PATH` somewhere else:

```bash
DB_PATH=/tmp/endpointlab.sqlite npm run dev:basic -w backend
```

### Start the frontend

In a second terminal:

```bash
npm run dev -w frontend
```

Vite serves the UI on `http://localhost:5173` and proxies `/api` to `http://localhost:3000`.

### Optional: run the local listener

In a third terminal:

```bash
python3 listener.py
```

Defaults:
- HTTP listener disabled on `18080`
- HTTPS listener disabled on `18443`
- TCP listener enabled on `18081`
- UDP listener disabled on `18082`

Listener environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `LISTENER_HOST` | `0.0.0.0` | Bind address |
| `LISTENER_ENABLE_HTTP` | `false` | Enable plain HTTP |
| `LISTENER_ENABLE_HTTPS` | `false` | Enable HTTPS |
| `LISTENER_ENABLE_TCP` | `true` | Enable TCP |
| `LISTENER_ENABLE_UDP` | `false` | Enable UDP |
| `LISTENER_HTTP_PORT` | `18080` | HTTP port |
| `LISTENER_HTTPS_PORT` | `18443` | HTTPS port |
| `LISTENER_TCP_PORT` | `18081` | TCP port |
| `LISTENER_UDP_PORT` | `18082` | UDP port |
| `LISTENER_HTTPS_CERT` | `certs/cert.pem` | Path to TLS certificate |
| `LISTENER_HTTPS_KEY` | `certs/key.pem` | Path to TLS private key |

## Data Storage

Local development defaults to:
- `backend/src/repos/db.sqlite`

That SQLite database is checked into this repository and currently contains example rows. SQLite WAL sidecar files may also appear beside it.

Docker defaults to:
- `/app/data/db.sqlite`

The backend auto-creates the `endpoints` table and adds missing columns on startup.

## Import And Export

Export behavior:
- The UI creates `endpoints-export.zip`
- Each selected endpoint is stored as one JSON file
- The exported JSON omits `id` but keeps the stable `externalId`

Import behavior:
- The UI reads every `.json` file in the ZIP
- Each file is validated against the shared endpoint schema
- Invalid files are listed and cannot be selected
- Matching endpoints are updated by `externalId` when present
- Older imports without `externalId` fall back to a stricter legacy match that includes name, protocol, host, port, method, and path
- Non-matching endpoints are created

## Docker

The application is served at `http://localhost:8080/endpointlab/`. A request to
`http://localhost:8080/` redirects to that base path.

### Nginx reverse proxy

Preserve the `/endpointlab` prefix when proxying to the container:

```nginx
location /endpointlab/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

The `proxy_pass` value intentionally has no trailing slash, so Nginx forwards
`/endpointlab/...` unchanged.

### Pull the published image

```bash
docker pull oseiasrocha/endpointlab:latest
docker run -d --name endpointlab \
  -p 8080:8080 \
  -v endpointlab-data:/app/data \
  oseiasrocha/endpointlab:latest
```

### Enable WSS

Provide PEM content directly through environment variables when running a WSS server endpoint:

```bash
docker run -d --name endpointlab \
  -p 8080:8080 -p 8443:8443 \
  -v endpointlab-data:/app/data \
  -e TLS_PRIVATE_KEY="$TLS_PRIVATE_KEY" \
  -e TLS_CERTIFICATE="$TLS_CERTIFICATE" \
  -e TLS_CERTIFICATE_CHAIN="$TLS_CERTIFICATE_CHAIN" \
  oseiasrocha/endpointlab:latest
```

### Build locally

```bash
docker build -t endpointlab .
docker run -d --name endpointlab \
  -p 8080:8080 -p 8443:8443 \
  -v endpointlab-data:/app/data \
  -e TLS_PRIVATE_KEY="$TLS_PRIVATE_KEY" \
  -e TLS_CERTIFICATE="$TLS_CERTIFICATE" \
  -e TLS_CERTIFICATE_CHAIN="$TLS_CERTIFICATE_CHAIN" \
  endpointlab
```

### Container environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DB_PATH` | `/app/data/db.sqlite` | SQLite database path |
| `TLS_PRIVATE_KEY` | — | PEM private key content used by WSS servers |
| `TLS_CERTIFICATE` | — | PEM leaf certificate or full-chain certificate content used by WSS servers |
| `TLS_CERTIFICATE_CHAIN` | — | Optional PEM intermediate certificate chain appended to `TLS_CERTIFICATE` |
| `NODE_EXTRA_CA_CERTS` | — | Path to a PEM CA file trusted for outbound HTTPS connections |

Notes:
- `TLS_PRIVATE_KEY` and `TLS_CERTIFICATE` are required for WSS server endpoints. Values may contain real newlines or escaped `\n` sequences.
- `TLS_CERTIFICATE_CHAIN` is unnecessary when `TLS_CERTIFICATE` already contains the full chain.
- WS and WSS endpoints must use different ports.
- `NODE_EXTRA_CA_CERTS` is needed when the backend makes outbound requests to an HTTPS endpoint signed by a private CA (e.g. the backend's own HTTPS listener).
- The Docker image bundles the built frontend under `backend/dist/public`.
- `listener.py` is not included in the Docker image.
- Interactive API docs are available at `http://localhost:8080/endpointlab/api/docs`.

## Verified Commands

- `npm run lint -w frontend`
- `npm run build -w frontend`
- `npm run lint -w backend`
- `npm run test -w backend`
- `npm run type-check -w backend`
- `npm run build -w backend`
- `npm run build:docker -w backend`
- `npm run start -w backend`

## More Docs

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)
