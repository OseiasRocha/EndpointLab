# Frontend

The frontend is a React 19 and Vite 8 application for managing endpoint
definitions and executing them through the backend API.

## Stack

- React 19
- React Router
- Material UI and Emotion
- Vite with the React compiler
- Zod schemas imported from `shared/`
- JSZip for import/export

## Base Path

Vite builds the application with:

```text
/endpointlab/
```

`BrowserRouter` derives its basename from `import.meta.env.BASE_URL`, and API URLs
are built from the same value. The frontend therefore calls:

```text
/endpointlab/api/endpoints
```

In development, Vite proxies `/endpointlab/api` to `http://localhost:3000`
without stripping the prefix.

## Development

Install dependencies from the repository root:

```bash
npm ci
```

Start Vite:

```bash
npm run dev -w frontend
```

Open `http://localhost:5173/endpointlab/`. Run the backend separately on port
`3000`.

## API Client

`src/api/endpoints.ts` validates successful JSON responses with shared Zod
schemas and surfaces backend error messages.

| Method | Endpoint path | Use |
| --- | --- | --- |
| `GET` | `/endpointlab/api/endpoints` | Load all endpoints |
| `POST` | `/endpointlab/api/endpoints` | Create |
| `PUT` | `/endpointlab/api/endpoints/:id` | Update |
| `DELETE` | `/endpointlab/api/endpoints/:id` | Delete |
| `POST` | `/endpointlab/api/endpoints/:id/send` | Execute |
| `POST` | `/endpointlab/api/endpoints/reorder` | Save order |
| `POST` | `/endpointlab/api/endpoints/bulk` | Import selected rows |

## Endpoint Editor

The add/edit dialog supports all shared protocols:

- HTTP, HTTPS
- TCP, UDP
- WS, WSS in Client or Server mode

UI validation:

- name and host must be non-empty
- port must be from `1` through `65535`
- HTTP, HTTPS, WS, and WSS require a path
- HTTP, HTTPS, WS, and WSS bodies must contain valid JSON when non-empty
- TCP and UDP bodies may be plain text
- fields irrelevant to the selected protocol are removed before submission
- `responseBody` is removed when `hasResponse` is disabled

The host input and response-wait switch are hidden for WS/WSS Server mode because
the backend binds locally and broadcasts instead of making an outbound request.
The shared schema still retains a host value on every endpoint.

## Organization And Group Playback

- endpoints may be assigned to typed or existing group names
- named groups and an Ungrouped section can be collapsed
- cards can move between groups and be reordered with drag and drop
- group playback executes endpoints sequentially by stored `order`
- each endpoint's `delayMs` is applied before it runs during group playback
- per-card and group execution results share the same result UI
- entire groups can be deleted

Search checks name, host, port, path, description, and group. Protocol filters
cover HTTP, HTTPS, TCP, UDP, WS, and WSS.

## Results And Expected Responses

Endpoint cards display:

- success/failure state
- latency
- HTTP status code when supplied by the backend
- connection or timeout errors
- received response content
- the stored expected response

When an expected and received body are available, `diffJson` first attempts JSON
comparison. If either side is not JSON, exact text equality is used.

Expected JSON supports:

- `"*"` to match any value at that path
- `"$regex:PATTERN"` to match the received value with a JavaScript regular expression

The diff display annotates only affected branches and separately marks wildcard
matches.

## Import And Export

### Export

- opens a selectable endpoint list
- creates `endpoints-export.zip`
- writes one formatted JSON file per selected endpoint
- removes the database `id`
- retains `externalId` for stable future updates
- builds safe filenames from name, optional HTTP method, and ID/index

### Import

- accepts a ZIP archive
- scans every non-directory `.json` entry
- parses JSON and validates it with the shared endpoint schema
- displays invalid rows but selects only valid rows
- previews whether a row will update or create
- matches `externalId` first and uses the shared fallback identity for legacy files
- sends selected records to the bulk endpoint

## Application State

- color mode defaults to dark
- the selected mode is stored in `localStorage` as `colorMode`
- endpoints and transmission results are kept in page state
- API failures appear in Material UI snackbars or endpoint result panels
- successful create/update/delete/import actions update local state without a full reload

## Scripts

Run from `frontend/`, or append `-w frontend` at the repository root.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm run build` | Type-check and produce `dist/` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |

The Docker build copies `frontend/dist/` into `backend/dist/public/`, where
Express serves it under `/endpointlab/`.
