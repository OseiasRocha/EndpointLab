# Backend

The backend is an Express 5 service that validates and persists endpoint
definitions, executes protocol transmissions, manages WS/WSS connections and
listeners, and serves the built frontend in production.

## Stack

- TypeScript
- Express 5
- SQLite through `better-sqlite3` and Drizzle ORM
- Zod schemas re-exported from `shared/`
- `ws` for WebSocket clients and servers
- Vitest and ESLint

## Runtime Scripts

Run these from `backend/`, or append `-w backend` when running from the repository
root.

| Script | Purpose |
| --- | --- |
| `npm run dev:basic` | Start `src/main.ts` with development environment settings |
| `npm run dev:watch` | Restart `dev:basic` when backend TypeScript changes |
| `npm run dev` | Alias for `dev:watch` |
| `npm run test` | Run Vitest once |
| `npm run type-check` | Run TypeScript without emitting files |
| `npm run lint` | Run ESLint |
| `npm run build:docker` | Compile production JavaScript into `dist/` |
| `npm run build` | Lint, then run `build:docker` |
| `npm run start` | Run the compiled production entry point |

`dev:basic` and `start` set `NODE_OPTIONS=--use-system-ca` and load
`config/.env.development` or `config/.env.production` through `dotenv`.

## Environment

| Variable | Required | Default/behavior |
| --- | --- | --- |
| `NODE_ENV` | yes | `development`, `test`, or `production`; provided by checked-in env files and Docker |
| `PORT` | yes | `3000` in development, `4000` in tests, `8080` in Docker |
| `DB_PATH` | no | Source/compiled `repos/db.sqlite` beside the backend code |
| `TLS_PRIVATE_KEY` | WSS Server mode | PEM private-key content |
| `TLS_CERTIFICATE` | WSS Server mode | PEM certificate or full-chain content |
| `TLS_CERTIFICATE_CHAIN` | no | PEM intermediates appended to `TLS_CERTIFICATE` |
| `NODE_OPTIONS` | no | Launch scripts and Docker use `--use-system-ca` |
| `NODE_EXTRA_CA_CERTS` | no | Path to an additional PEM CA bundle for outbound HTTPS/WSS |

TLS environment values may contain literal newlines or escaped `\n` sequences.
Missing or invalid WSS Server credentials produce a `503` API response. A failed
single-endpoint create is removed from the database before that error is returned.

The checked-in env files also define `HOST`, but the current server does not read
it. The main API listens through Node's default host binding.

## Paths And Production Serving

The API base is:

```text
/endpointlab/api
```

In production, Express also:

- enables Helmet
- redirects `/` to `/endpointlab/`
- serves built frontend files at `/endpointlab/`
- falls back to `index.html` for routes under `/endpointlab/*`

The backend's main HTTP server is not itself an HTTPS server. TLS credentials are
used by dynamically created WSS Server endpoints.

## API Routes

| Method | Route | Result |
| --- | --- | --- |
| `GET` | `/endpointlab/api/openapi.json` | OpenAPI JSON |
| `GET` | `/endpointlab/api/docs` | Swagger UI |
| `GET` | `/endpointlab/api/endpoints` | All stored endpoints |
| `POST` | `/endpointlab/api/endpoints` | Validate, persist, and track one endpoint |
| `POST` | `/endpointlab/api/endpoints/bulk` | Validate an array and bulk create/update |
| `POST` | `/endpointlab/api/endpoints/reorder` | Persist order from an ID array |
| `PUT` | `/endpointlab/api/endpoints/:id` | Replace one endpoint definition and runtime tracking |
| `DELETE` | `/endpointlab/api/endpoints/:id` | Delete and untrack one endpoint |
| `POST` | `/endpointlab/api/endpoints/:id/send` | Execute one stored endpoint |

Create returns `201`; normal reads, updates, imports, deletes, and transmissions
return `200`. Validation errors return `400`, missing endpoint IDs return `404`,
and WSS TLS configuration errors return `503`.

## Shared Endpoint Schema

The backend re-exports the schema from `shared/src/index.ts`.

Validation rules:

- `name` and `host` are non-empty strings
- `port` is an integer from `1` through `65535`
- `protocol` is `HTTP`, `HTTPS`, `TCP`, `UDP`, `WS`, or `WSS`
- HTTP/HTTPS require `httpMethod` and `path`
- WS/WSS require `path` and `websocketType`
- `websocketType` is `Client` or `Server`
- `delayMs`, when present, is a non-negative integer
- `externalId`, when present, is a UUID

`responseBody` is stored for frontend comparison. The transmitter never serves it
as a configured response.

## Persistence And Import Identity

SQLite startup logic:

- creates the `endpoints` table when absent
- adds missing columns for older databases
- assigns UUIDs to rows missing `external_id`
- creates a unique index on `external_id`
- enables WAL mode

Bulk upsert matches `externalId` first. Legacy imports without one use a fallback
identity composed of trimmed name, protocol, trimmed host, and port, plus:

- HTTP/HTTPS: method and path
- WS/WSS: path
- TCP/UDP: no additional fields

Non-matches are inserted. Ordering is stored as an integer and is updated by the
reorder route.

## Transmission Behavior

All outbound protocols use a 5 second timeout where applicable.

### HTTP And HTTPS

- use Node's `http` or `https` module
- send `Content-Type: application/json`
- send the configured body unchanged
- follow up to 10 redirects
- choose the redirect transport from the redirected URL scheme
- return success only for status codes from 200 through 299
- include the response body only when `hasResponse` is true

HTTPS uses Node's trust store. Use `--use-system-ca` for installed system roots and
`NODE_EXTRA_CA_CERTS` for a private CA file visible to the process/container.

### TCP

- opens a TCP connection to host/port
- writes `requestBody` when present
- resolves immediately after ending the socket when `hasResponse` is false
- otherwise collects data until end or timeout

### UDP

- sends one UDP4 datagram
- resolves after send when `hasResponse` is false
- otherwise waits for one response datagram or timeout

### WS/WSS Client Mode

- constructs `ws://` or `wss://` from host, port, and path
- connects when endpoints are loaded, created, or updated
- shares one socket among endpoint rows with the same URL
- reconnects 3 seconds after an unexpected close while an endpoint still uses it
- sends `requestBody` on execution
- waits for one message only when `hasResponse` is true

### WS/WSS Server Mode

- opens an HTTP or HTTPS upgrade listener on the configured port
- binds independently of the endpoint's `host` field
- routes upgrades by port plus request path
- permits multiple same-protocol paths on one port
- rejects mixing WS and WSS paths on one port
- broadcasts `requestBody` to every open client on execution
- returns `No WebSocket clients connected` when there are no recipients
- terminates clients and awaits HTTP listener closure during update/delete

WSS listeners use `TLS_PRIVATE_KEY`, `TLS_CERTIFICATE`, and the optional chain.

## Transmission Result

```json
{
  "success": true,
  "statusCode": 200,
  "responseBody": "{\"status\":\"ok\"}",
  "latencyMs": 14
}
```

`success` and `latencyMs` are always present. `statusCode`, `responseBody`, and
`error` are optional.

## Tests

The current tests cover:

- repository import identity and WebSocket field persistence
- WS server client disconnect, port release, recreation, and broadcast
- missing WSS credential cleanup
- TLS PEM parsing and chain handling
- API error propagation/rollback for WSS creation
- frontend JSON-diff behavior used by result cards

Run:

```bash
npm test
```

WebSocket/API integration tests bind loopback ports.
