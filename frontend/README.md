# Frontend

The frontend is a React 19 + Vite app for managing endpoint definitions and executing transmissions through the backend API.

## Responsibilities

- List saved endpoints from the backend
- Create, edit, duplicate, and delete endpoint definitions
- Group endpoints and move them between groups with drag and drop
- Filter by protocol and free-text search
- Import and export endpoint ZIP archives
- Execute saved endpoints and show success, latency, errors, and received payloads
- Diff received JSON against the saved expected JSON when possible

## Development

Install dependencies from the repository root:

```bash
npm ci
```

Start the frontend:

```bash
npm run dev
```

By default Vite serves the app on `http://localhost:5173`.

## Backend Integration

In development, Vite proxies API calls to:

```text
http://localhost:3000
```

The frontend talks to the backend through:

```text
/api/endpoints
```

Implemented client calls:
- `GET /api/endpoints`
- `POST /api/endpoints`
- `PUT /api/endpoints/:id`
- `DELETE /api/endpoints/:id`
- `POST /api/endpoints/:id/send`
- `POST /api/endpoints/bulk`

## Endpoint Editing Rules

The add/edit dialog enforces a few UI-side rules before submission:

- `name`, `host`, and `port` are required
- HTTP endpoints must include a path
- `requestBody` must be valid JSON when present
- `responseBody` must be valid JSON when `hasResponse` is enabled
- Non-HTTP endpoints do not send `httpMethod` or `path`
- When `hasResponse` is disabled, `responseBody` is omitted from the payload

## Import And Export

Export:
- Generates `endpoints-export.zip`
- Writes one JSON file per selected endpoint
- Removes `id` before exporting
- Builds filenames from endpoint name, optional HTTP method, and id/index

Import:
- Accepts ZIP files containing `.json` endpoint definitions
- Validates each file with the shared schema
- Shows invalid entries in the preview
- Marks matching `name + host + port` rows as updates
- Sends selected records to the backend bulk upsert endpoint

## Execute Flow

Clicking **Execute** on a card:

1. Calls `POST /api/endpoints/:id/send`
2. Shows success or failure state
3. Shows latency in milliseconds
4. Displays any returned payload
5. When both expected and received bodies are valid JSON, highlights mismatched fields inline

## UI Notes

- Color mode is stored in `localStorage` under `colorMode`
- Group names come from existing endpoints and can also be typed manually
- The endpoint list is grouped by named folders plus an `Ungrouped` section
- Protocol badges show HTTP methods for HTTP rows and protocol names for TCP/UDP rows

## Build And Lint

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and create a production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |

Current repo note:
- `npm run build` works
- `npm run lint` currently fails on existing repo violations, including `react-refresh/only-export-components` in `src/App.tsx`
