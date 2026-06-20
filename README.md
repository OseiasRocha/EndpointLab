# EndpointLab

EndpointLab is a full-stack endpoint workspace for defining, organizing, importing,
exporting, and exercising HTTP, HTTPS, TCP, UDP, WS, and WSS endpoints.

Most endpoint types are outbound targets: EndpointLab connects to the configured
host and port when you execute them. WS and WSS endpoints also support **Server**
mode, where EndpointLab opens a listener and broadcasts the configured request body
to connected WebSocket clients.

Docker Hub: [oseiasrocha/endpointlab](https://hub.docker.com/r/oseiasrocha/endpointlab)

## Features

- Create, edit, duplicate, delete, search, and filter endpoint definitions
- Organize endpoints into ordered groups with drag and drop
- Execute one endpoint or play an entire group sequentially with per-endpoint delays
- Send HTTP, HTTPS, TCP, UDP, WS, and WSS traffic
- Run WS/WSS endpoints as reconnecting clients or hosted servers
- Display latency, HTTP status, response bodies, and connection errors
- Compare expected and received JSON, including `*` and `$regex:PATTERN` wildcards
- Import and export selected endpoints as ZIP archives
- Persist definitions in SQLite
- Serve the production UI under the `/endpointlab/` base path
- Run directly with Node, in Docker, or behind the included Nginx Compose service

## Repository Layout

- `frontend/` - React 19, Vite 8, Material UI, and JSZip
- `backend/` - Express 5, SQLite/Drizzle, protocol transmitters, and WS/WSS management
- `shared/` - shared Zod schemas, TypeScript types, and import identity helpers
- `listener.py` - optional HTTP/HTTPS/TCP/UDP/WS/WSS test peer
- `compose.yaml` - EndpointLab and Nginx using host networking
- `docker/` - Nginx configuration and local WSS certificate generator

## Quick Start With Compose

Compose requires the generated WSS environment file and certificate:

```bash
./docker/generate-wss-env.sh
docker compose up --build -d
```

Open:

- Application: `http://localhost/endpointlab/`
- Swagger UI: `http://localhost/endpointlab/api/docs`
- OpenAPI JSON: `http://localhost/endpointlab/api/openapi.json`

Both services use `network_mode: host`. Nginx listens on host port `80` and
proxies `/endpointlab/` to EndpointLab on `127.0.0.1:8080`. WS/WSS Server-mode
endpoints bind their configured ports directly on the host.

Host networking is primarily a Linux setup. Docker Desktop must have host
networking support enabled. Port `80` and every endpoint listener port must be
available on the host.

Stop the stack with:

```bash
docker compose down
```

Add `-v` to remove the SQLite volume as well.

## Base Path And Nginx

The production UI is built for `/endpointlab/`, and the API is mounted at
`/endpointlab/api`. Nginx must preserve that prefix:

```nginx
location /endpointlab/ {
    proxy_pass http://127.0.0.1:8080;
}
```

The `proxy_pass` URL intentionally has no trailing slash. A request such as
`/endpointlab/api/endpoints` therefore reaches EndpointLab unchanged.

The included `docker/nginx.conf` also redirects `/` to `/endpointlab/` and
returns `404` for unrelated paths.

## Endpoint Model

Example:

```json
{
  "externalId": "6a247376-4efd-4791-b2d5-dbc0fd4f1aab",
  "name": "Secure socket",
  "description": "Optional note",
  "protocol": "WSS",
  "host": "localhost",
  "port": 8443,
  "path": "/socket",
  "requestBody": "{\"hello\":true}",
  "hasResponse": false,
  "group": "Local tests",
  "order": 0,
  "delayMs": 250,
  "websocketType": "Server"
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Display name |
| `protocol` | yes | `HTTP`, `HTTPS`, `TCP`, `UDP`, `WS`, or `WSS` |
| `host` | yes | Remote host; retained but not used to bind WS/WSS Server mode |
| `port` | yes | Port from `1` to `65535` |
| `httpMethod` | HTTP/HTTPS | `GET`, `POST`, `PUT`, `DELETE`, or `PATCH` |
| `path` | HTTP/HTTPS/WS/WSS | Request or WebSocket path |
| `websocketType` | WS/WSS | `Client` or `Server` |
| `requestBody` | no | Payload sent when the endpoint is executed |
| `hasResponse` | yes | Whether outbound transports wait for/capture a response |
| `responseBody` | no | Expected response used by the frontend comparison only |
| `group` | no | UI group name |
| `order` | no | Position within a group |
| `delayMs` | no | Delay before this endpoint runs during group playback |
| `externalId` | no | Stable UUID used to match imported endpoints |

`id` is assigned by SQLite and returned by the API.

## Protocol Behavior

| Protocol | Behavior |
| --- | --- |
| HTTP/HTTPS | Sends the configured method and body, follows up to 10 redirects, and treats only 2xx as success |
| TCP | Opens a connection, writes the body, and optionally waits for data/end |
| UDP | Sends one datagram and optionally waits for one response datagram |
| WS/WSS Client | Maintains a connection, reconnects after disconnects, sends the body, and optionally waits for one message |
| WS/WSS Server | Opens a listener, supports multiple paths on one same-protocol port, and broadcasts the body to all open clients |

Outbound operations use a 5 second timeout. A Server-mode execution returns an
error when no WebSocket clients are connected.

WS and WSS cannot share the same listening port. Multiple WS paths can share a
WS port, and multiple WSS paths can share a WSS port.

## API

All routes are under `/endpointlab/api`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/endpointlab/api/openapi.json` | OpenAPI document |
| `GET` | `/endpointlab/api/docs` | Swagger UI |
| `GET` | `/endpointlab/api/endpoints` | List endpoints |
| `POST` | `/endpointlab/api/endpoints` | Create an endpoint |
| `POST` | `/endpointlab/api/endpoints/bulk` | Bulk create/update imported endpoints |
| `POST` | `/endpointlab/api/endpoints/reorder` | Persist an ordered array of endpoint IDs |
| `PUT` | `/endpointlab/api/endpoints/:id` | Update an endpoint |
| `DELETE` | `/endpointlab/api/endpoints/:id` | Delete an endpoint |
| `POST` | `/endpointlab/api/endpoints/:id/send` | Execute an endpoint |

Transmission result:

```json
{
  "success": false,
  "statusCode": 404,
  "responseBody": "{\"message\":\"not found\"}",
  "error": "Connection refused",
  "latencyMs": 12
}
```

`statusCode`, `responseBody`, and `error` are omitted when they do not apply.

## Local Development

### Prerequisites

- A Node.js release supported by Vite 8
- npm
- Python 3 and the `websockets` package only when using `listener.py`
- OpenSSL only when generating local WSS credentials

Install workspace dependencies once from the repository root:

```bash
npm ci
```

Start the backend:

```bash
npm run dev:basic -w backend
```

The development API listens on `http://localhost:3000/endpointlab/api` and uses
`backend/config/.env.development`. Override `DB_PATH` for a disposable database:

```bash
DB_PATH=/tmp/endpointlab.sqlite npm run dev:basic -w backend
```

Start the frontend in a second terminal:

```bash
npm run dev -w frontend
```

Open `http://localhost:5173/endpointlab/`. Vite proxies
`/endpointlab/api` to the backend on port `3000`.

## TLS And WSS

WSS Server mode reads PEM content directly from environment variables:

| Variable | Purpose |
| --- | --- |
| `TLS_PRIVATE_KEY` | PEM private key; required for WSS Server mode |
| `TLS_CERTIFICATE` | PEM leaf or full-chain certificate; required for WSS Server mode |
| `TLS_CERTIFICATE_CHAIN` | Optional intermediate chain appended to the certificate |

Values may contain real newlines or escaped `\n` sequences.

Outbound HTTPS and WSS clients use Node's trust store. Local backend scripts and
the Docker image set `NODE_OPTIONS=--use-system-ca`. For a private/self-signed CA,
set `NODE_EXTRA_CA_CERTS` to a PEM CA file visible inside the Node process.

The generator creates a 30-day certificate valid for `localhost` and
`127.0.0.1`, plus an ignored Compose environment file:

```bash
./docker/generate-wss-env.sh
```

Generated local files:

- `docker/certs/wss.key.pem`
- `docker/certs/wss.cert.pem`
- `docker/wss.env`

Compose injects the key/certificate as environment values and mounts the public
certificate as `NODE_EXTRA_CA_CERTS` for outbound test connections.

## Local Test Listener

Install optional WebSocket support:

```bash
python3 -m pip install websockets
```

With no overrides, `listener.py` starts only TCP on port `18081`.

| Target | Enable variable | Default endpoint |
| --- | --- | --- |
| HTTP server | `LISTENER_ENABLE_HTTP` | `0.0.0.0:18080` |
| HTTPS server | `LISTENER_ENABLE_HTTPS` | `0.0.0.0:18443` |
| TCP server | `LISTENER_ENABLE_TCP` | `0.0.0.0:18081` |
| UDP server | `LISTENER_ENABLE_UDP` | `0.0.0.0:18082` |
| WS server (tests EndpointLab Client mode) | `LISTENER_ENABLE_WS` | `0.0.0.0:18083` |
| WSS server (tests EndpointLab Client mode) | `LISTENER_ENABLE_WSS` | `0.0.0.0:18084` |
| WS client (tests EndpointLab Server mode) | `LISTENER_ENABLE_WS_SERVER_TEST` | `ws://localhost:18083/socket` |
| WSS client (tests EndpointLab Server mode) | `LISTENER_ENABLE_WSS_SERVER_TEST` | `wss://localhost:8443/socket` |

Listener configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LISTENER_HOST` | `0.0.0.0` | Bind address for listener servers |
| `LISTENER_HTTP_PORT` | `18080` | HTTP server port |
| `LISTENER_HTTPS_PORT` | `18443` | HTTPS server port |
| `LISTENER_TCP_PORT` | `18081` | TCP server port |
| `LISTENER_UDP_PORT` | `18082` | UDP server port |
| `LISTENER_WS_PORT` | `18083` | WS server port |
| `LISTENER_WSS_PORT` | `18084` | WSS server port |
| `LISTENER_HTTPS_CERT` | `docker/certs/wss.cert.pem` | Certificate file used by HTTPS and WSS servers |
| `LISTENER_HTTPS_KEY` | `docker/certs/wss.key.pem` | Private-key file used by HTTPS and WSS servers |
| `LISTENER_WS_SERVER_URL` | `ws://localhost:18083/socket` | EndpointLab WS Server-mode URL to connect to |
| `LISTENER_WS_SERVER_MESSAGE` | connection probe JSON | Message sent after the WS client connects; empty disables it |
| `LISTENER_WS_SERVER_RECONNECT_SECONDS` | `3` | WS client reconnect delay |
| `LISTENER_WSS_SERVER_URL` | `wss://localhost:8443/socket` | EndpointLab WSS Server-mode URL to connect to |
| `LISTENER_WSS_SERVER_CA` | `docker/certs/wss.cert.pem` | CA/certificate used to verify the WSS server |
| `LISTENER_WSS_SERVER_INSECURE` | `false` | Disable WSS certificate verification for local testing only |
| `LISTENER_WSS_SERVER_MESSAGE` | connection probe JSON | Message sent after the WSS client connects; empty disables it |
| `LISTENER_WSS_SERVER_RECONNECT_SECONDS` | `3` | WSS client reconnect delay |

HTTPS and WSS listener servers default to the generated files under
`docker/certs/`. The WSS Server-mode test client verifies
`docker/certs/wss.cert.pem`; set `LISTENER_WSS_SERVER_INSECURE=true` only for a
local certificate that cannot be verified.

Run all listener targets together:

```bash
LISTENER_ENABLE_HTTP=true \
LISTENER_ENABLE_HTTPS=true \
LISTENER_ENABLE_TCP=true \
LISTENER_ENABLE_UDP=true \
LISTENER_ENABLE_WS=true \
LISTENER_ENABLE_WSS=true \
LISTENER_ENABLE_WS_SERVER_TEST=true \
LISTENER_WS_SERVER_URL=ws://localhost:18085/socket \
LISTENER_ENABLE_WSS_SERVER_TEST=true \
LISTENER_WSS_SERVER_URL=wss://localhost:8443/socket \
python3 listener.py
```

The WS client uses port `18085` in this example because the listener's own WS
server already occupies `18083`. Configure the corresponding EndpointLab WS
Server endpoint on port `18085` and path `/socket`.

## Import And Export

The frontend exports `endpoints-export.zip` with one JSON file per selected
endpoint. Database `id` values are removed; stable `externalId` values remain.

During import:

1. Every `.json` file in the ZIP is parsed and validated with the shared schema.
2. Invalid files remain visible but cannot be selected.
3. Rows with `externalId` match that UUID.
4. Legacy rows without it match name, protocol, host, port, plus method/path where applicable.
5. Non-matches are inserted.

## Storage

- Local default: `backend/src/repos/db.sqlite`
- Docker/Compose: `/app/data/db.sqlite` in the `endpointlab-data` volume
- SQLite WAL mode is enabled
- Startup creates the table, backfills columns, and assigns missing external UUIDs

The repository includes an example SQLite database, so a local checkout may
already contain endpoint rows.

## Docker Without Compose

Build locally:

```bash
docker build -t endpointlab .
docker run --rm \
  -p 8080:8080 \
  -v endpointlab-data:/app/data \
  endpointlab
```

Open `http://localhost:8080/endpointlab/`. Publish additional ports for every
WS/WSS Server endpoint you create. Supply the TLS PEM environment variables when
using WSS Server mode.

## Commands

Run from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run build -w shared` | Compile shared TypeScript |
| `npm run dev -w frontend` | Start Vite |
| `npm run build -w frontend` | Type-check and build the frontend |
| `npm run lint -w frontend` | Lint the frontend |
| `npm run dev -w backend` | Start watched backend development |
| `npm run test -w backend` | Run backend/Vitest tests |
| `npm run type-check -w backend` | Type-check backend and tests |
| `npm run lint -w backend` | Lint the backend |
| `npm run build -w backend` | Lint and compile the backend |
| `npm run build:docker -w backend` | Compile production backend artifacts only |

More detail:

- [Backend documentation](backend/README.md)
- [Frontend documentation](frontend/README.md)
