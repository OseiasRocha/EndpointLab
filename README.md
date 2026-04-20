# EndpointLab

EndpointLab is a full-stack app for creating and testing simulated endpoints (HTTP, TCP, UDP).

It includes:
- A React UI to create, edit, delete, and test endpoints
- An Express backend API with SQLite persistence
- Optional Python listener (`listener.py`) for local protocol testing

Docker Hub image:
- https://hub.docker.com/r/oseiasrocha/endpointlab

## Features

- Manage endpoint definitions from the UI
- Send test transmissions to configured endpoints
- Store endpoint data in SQLite
- Run as local dev stack or as a single Docker container
- HTTPS support via volume-mounted certificates (Docker)

## Project Structure

- `frontend/` React + Vite UI
- `backend/` Express + TypeScript API
- `shared/` Shared Zod schemas/types
- `listener.py` Optional protocol listener (TCP enabled by default when run)

## Run Locally (Manual)

### Prerequisites

- Node.js 22+
- npm

### 1) Install dependencies

From repo root:

```bash
npm ci
```

### 2) Run backend

In terminal 1:

```bash
npm run dev -w backend
```

Backend runs on `http://localhost:3000` in development.

### 3) Run frontend

In terminal 2:

```bash
npm run dev -w frontend
```

Frontend runs on `http://localhost:5173` (default Vite port).

The frontend proxies `/api` requests to `http://localhost:3000`.

### 4) Optional: run listener manually

In terminal 3:

```bash
python3 listener.py
```

You can configure listener behavior with env vars:
- `LISTENER_ENABLE_HTTP`
- `LISTENER_ENABLE_TCP`
- `LISTENER_ENABLE_UDP`
- `LISTENER_HTTP_PORT`
- `LISTENER_TCP_PORT`
- `LISTENER_UDP_PORT`
- `LISTENER_HOST`

## Run With Docker

### Option A: Pull prebuilt image from Docker Hub

```bash
docker pull oseiasrocha/endpointlab:latest
docker run -p 8080:8080 -p 8443:8443 \
  -v endpointlab-data:/app/data \
  -v /path/to/your/certs:/app/certs \
  oseiasrocha/endpointlab:latest
```

App will be available at `http://localhost:8080` and `https://localhost:8443`.

### Option B: Build locally

```bash
docker build -t endpointlab .
docker run -p 8080:8080 -p 8443:8443 \
  -v endpointlab-data:/app/data \
  -v /path/to/your/certs:/app/certs \
  endpointlab
```

> **Note:** The `-v endpointlab-data:/app/data` flag mounts a named Docker volume so data persists across container recreations. Without it, Docker creates an anonymous volume that is tied to the container and lost when it is removed. You can also use a bind mount (`-v ./data:/app/data`) if you prefer a local directory. The default database path is `/app/data/db.sqlite` and can be overridden with `-e DB_PATH=<path>`.

> **HTTPS:** The Docker image expects TLS certificates to be provided via a volume mounted at `/app/certs`. Place your `cert.pem` and `key.pem` files in the directory you mount there. If the certificate files are not found, HTTPS is skipped and only HTTP is served. You can override the cert directory with `-e CERT_DIR=<path>` and the HTTPS port with `-e HTTPS_PORT=<port>`. To disable HTTPS entirely, omit `HTTPS_PORT`.

> **Note:** `listener.py` is not included in the Docker image. To use the listener, run it locally alongside the container (see [Run Locally](#run-locally-manual)).

## Useful Commands

```bash
# Backend
npm run lint -w backend
npm run type-check -w backend
npm run build:docker -w backend

# Frontend
npm run lint -w frontend
npm run build -w frontend
```
