# EndpointLab

EndpointLab is a full-stack workspace for storing endpoint definitions and firing test transmissions to them over HTTP, TCP, and UDP.

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
- Execute HTTP, TCP, and UDP transmissions from the UI
- Store an expected JSON response and compare it with the received response in the UI
- Import and export endpoint definitions as ZIP archives
- Persist data in SQLite
- Run locally as separate frontend and backend processes or as a single Docker container
- Optionally serve HTTPS when `cert.pem` and `key.pem` are available

## Repository Layout

- `frontend/` React 19 + Vite + MUI client
- `backend/` Express 5 + TypeScript API and SQLite access
- `shared/` Shared Zod schemas and TypeScript types
- `listener.py` Optional local HTTP/TCP/UDP receiver for manual testing
- `certs/` PEM files for local HTTPS experiments

## How It Works

1. The frontend calls the backend API under `/api/endpoints`.
2. The backend stores endpoint definitions in SQLite.
3. Clicking **Execute** on a card calls `POST /api/endpoints/:id/send`.
4. The backend opens an outgoing HTTP, TCP, or UDP connection to the saved target.
5. If the endpoint expects a response, the UI shows the received payload and, when possible, diffs it against the saved expected JSON.

## Endpoint Shape

Each saved endpoint uses this schema:

```json
{
  "name": "Local TCP echo",
  "description": "Optional note",
  "protocol": "TCP",
  "host": "localhost",
  "port": 18081,
  "httpMethod": null,
  "path": null,
  "requestBody": "{\"hello\":true}",
  "hasResponse": true,
  "responseBody": "{\"response\":2}",
  "group": "Local listeners"
}
```

Notes:
- `httpMethod` and `path` are required when `protocol` is `HTTP`.
- `responseBody` is an expected response used by the UI for comparison. It is not served by the backend.
- Import and bulk upsert match existing rows by `name + host + port`.

## API Summary

| Route | Purpose |
| --- | --- |
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
  "success": true,
  "responseBody": "{\"status\":\"ok\"}",
  "latencyMs": 12
}
```

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

### Start the backend

Use the backend's direct dev entry point:

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
- TCP listener enabled on `18081`
- UDP listener disabled on `18082`

Listener environment variables:
- `LISTENER_HOST`
- `LISTENER_ENABLE_HTTP`
- `LISTENER_ENABLE_TCP`
- `LISTENER_ENABLE_UDP`
- `LISTENER_HTTP_PORT`
- `LISTENER_TCP_PORT`
- `LISTENER_UDP_PORT`

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
- The exported JSON omits `id`

Import behavior:
- The UI reads every `.json` file in the ZIP
- Each file is validated against the shared endpoint schema
- Invalid files are listed and cannot be selected
- Matching endpoints are updated when `name`, `host`, and `port` already exist
- Non-matching endpoints are created

## Docker

### Pull the published image

```bash
docker pull oseiasrocha/endpointlab:latest
docker run -p 8080:8080 -p 8443:8443 \
  -v endpointlab-data:/app/data \
  -v "$(pwd)/certs:/app/certs" \
  oseiasrocha/endpointlab:latest
```

### Build locally

```bash
docker build -t endpointlab .
docker run -p 8080:8080 -p 8443:8443 \
  -v endpointlab-data:/app/data \
  -v "$(pwd)/certs:/app/certs" \
  endpointlab
```

Container defaults:
- HTTP on `http://localhost:8080`
- HTTPS on `https://localhost:8443`
- `PORT=8080`
- `HTTPS_PORT=8443`
- `CERT_DIR=/app/certs`
- `DB_PATH=/app/data/db.sqlite`

Notes:
- The Docker image bundles the built frontend into `backend/dist/public`.
- If `cert.pem` and `key.pem` are missing from `CERT_DIR`, HTTPS is skipped.
- `listener.py` is not included in the Docker image.

## Working Script Notes

These details reflect the current repository state:

- `npm run build -w frontend` works
- `npm run build:docker -w backend` works
- `npm run type-check -w backend` works
- `npm run dev -w backend` is stale and fails because `bs-config.js` is missing
- `npm run lint -w frontend` currently fails on existing lint violations
- `npm run lint -w backend` currently fails on an existing lint violation in `TransmitService.ts`
- `npm run test -w backend` currently exits with "No test files found"

## More Docs

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)
