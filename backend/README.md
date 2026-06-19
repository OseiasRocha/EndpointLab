# Backend

The backend is an Express 5 API that stores endpoint definitions in SQLite and executes outbound HTTP, HTTPS, TCP, and UDP transmissions on demand.

## Responsibilities

- Validate payloads with the shared Zod schema
- Persist endpoint definitions in SQLite through Drizzle and `better-sqlite3`
- Serve the built frontend in production
- Create WSS endpoint servers with PEM credentials supplied through environment variables
- Execute outgoing transmissions with a 5 second timeout

## Runtime

Default development entry point:

```bash
npm run dev:basic
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev:basic` | Starts the API with `config/.env.development` |
| `npm run dev:watch` | Runs `dev:basic` through `nodemon` |
| `npm run dev` | Alias for `dev:watch` |
| `npm run build` | Lints and builds the backend |
| `npm run build:docker` | Builds the backend artifacts used by the Docker image |
| `npm run start` | Starts the compiled production build |
| `npm run type-check` | Runs TypeScript in no-emit mode |
| `npm run lint` | Runs ESLint |
| `npm run test` | Runs Vitest |

Verified in this repo:
- `npm run build`
- `npm run build:docker`
- `npm run start`
- `npm run test`

Runtime CA behavior:
- `npm run dev:basic`, `npm run dev`, and `npm run start` launch Node with `--use-system-ca`
- This lets the backend process trust locally installed root CAs in addition to Node's bundled roots
- This affects outbound HTTPS calls and Node-based clients, not the certificate chain served by the backend's own HTTPS listener
- In Docker, if the backend needs to call an HTTPS endpoint signed by a local CA, mount that CA file into `/app/certs` and pass `NODE_EXTRA_CA_CERTS=/app/certs/<your-ca>.pem`

## Environment Variables

The code currently consumes these runtime variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | Express environment | from `config/.env.*` |
| `PORT` | HTTP port | `3000` in development |
| `DB_PATH` | SQLite file path | `src/repos/db.sqlite` relative to compiled backend |
| `TLS_PRIVATE_KEY` | PEM private key content for WSS servers | unset unless provided |
| `TLS_CERTIFICATE` | PEM leaf or full-chain certificate content for WSS servers | unset unless provided |
| `TLS_CERTIFICATE_CHAIN` | Optional PEM intermediate certificate chain for WSS servers | unset unless provided |
| `NODE_EXTRA_CA_CERTS` | Extra CA bundle used by Node HTTPS clients | unset unless provided |

Notes:
- The `.env` files also contain `HOST`, but the current backend code does not read it.
- WSS requires `TLS_PRIVATE_KEY` and `TLS_CERTIFICATE`; `TLS_CERTIFICATE_CHAIN` is optional.
- PEM values may contain actual newlines or escaped `\n` sequences.
- A port may contain multiple WSS paths, but WS and WSS endpoints cannot share one port.

## API Routes

Documentation routes:

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/openapi.json` | Return the OpenAPI document |
| `GET` | `/api/docs` | Serve the Swagger UI |

Endpoint base path:

```text
/api/endpoints
```

Endpoint routes:

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/` | Return all endpoints |
| `POST` | `/` | Create one endpoint |
| `POST` | `/bulk` | Validate an array and bulk upsert |
| `PUT` | `/:id` | Update one endpoint |
| `DELETE` | `/:id` | Delete one endpoint |
| `POST` | `/:id/send` | Execute one saved endpoint |

## Schema

The backend re-exports the shared schema from `shared/src/index.ts`.

Important validation rules:
- `name` and `host` are required
- `port` must be an integer from `1` to `65535`
- `protocol` must be `HTTP`, `HTTPS`, `TCP`, or `UDP`
- `httpMethod` and `path` are required for HTTP and HTTPS endpoints

Bulk upsert behavior:
- Imported rows with `externalId` are matched and updated in place
- Older rows without `externalId` fall back to a stricter legacy identity of name, protocol, host, port, method, and path
- Non-matches are inserted

## Transmission Behavior

`POST /api/endpoints/:id/send` loads the saved row and dispatches by protocol:

- HTTP uses Node's `http` module
- HTTPS uses Node's `https` module
- TCP uses `net.createConnection`
- UDP uses `dgram.createSocket('udp4')`

Transmission details:
- Timeout is `5000ms`
- `requestBody` is sent as-is
- For HTTP and HTTPS requests, `Content-Type` is always `application/json`
- HTTPS requests use Node's default TLS trust store; set `NODE_EXTRA_CA_CERTS` to a PEM file to add custom certificate authorities (e.g. a local self-signed CA)
- `hasResponse=false` returns success as soon as the request is sent or the socket is closed
- `hasResponse=true` waits for a response body and includes it in the result

The configured `responseBody` on an endpoint is not used by the backend transmitter. That field is for frontend-side expected-response comparison.

Transmission result shape:

```json
{
  "success": false,
  "statusCode": 404,
  "responseBody": "{\"message\":\"not found\"}",
  "error": "ECONNREFUSED",
  "latencyMs": 12
}
```

- `statusCode` is present only for HTTP/HTTPS responses; absent for TCP, UDP, and connection-level failures
- `error` carries the Node error message or code (e.g. `ECONNREFUSED`, `EPROTO`, `Request timed out`) when a connection-level failure occurs; absent on success

## Storage

Database details:
- SQLite via `better-sqlite3`
- Default file in this repo: `src/repos/db.sqlite`
- WAL mode enabled on startup
- Table creation and column backfill happen automatically in `src/db/index.ts`

The checked-in database currently contains example rows, so a fresh clone may already show endpoints in the UI.

## Production Serving

In production mode the backend:
- Enables `helmet`
- Serves static assets from `dist/public`
- Falls back to `index.html` for client-side routing

This is how the Docker image serves the full app from one process.
