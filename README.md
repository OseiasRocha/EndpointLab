# EndpointLab

EndpointLab is a full-stack app for creating and testing simulated endpoints (HTTP, TCP, UDP).

It includes:
- A React UI to create, edit, delete, and test endpoints
- An Express backend API with SQLite persistence
- Optional Python listener (`listener.py`) for local protocol testing

Docker Hub image:
- https://hub.docker.com/r/oseiasrocha/endpoint-simulator

## Features

- Manage endpoint definitions from the UI
- Send test transmissions to configured endpoints
- Store endpoint data in SQLite
- Run as local dev stack or as a single Docker container

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
docker pull oseiasrocha/endpoint-simulator:latest
docker run --rm -p 8080:8080 \
  -v ./data:/app/data \
  oseiasrocha/endpoint-simulator:latest
```

App will be available at `http://localhost:8080`.

### Option B: Build locally

```bash
docker build -t endpoint-simulator .
docker run --rm -p 8080:8080 \
  -v ./data:/app/data \
  endpoint-simulator
```

> **Note:** The `-v` flag mounts a local `./data` directory for SQLite persistence. Without it, all endpoint data is lost when the container is removed. The directory will be created automatically on first run.

## Docker + Listener

By default, the container runs only the Node app.

To also run `listener.py` inside the container:

```bash
docker run --rm \
  -e RUN_LISTENER=true \
  -p 8080:8080 \
  -p 18081:18081 \
  endpoint-simulator
```

Default listener config in container:
- TCP enabled on `18081`
- HTTP disabled (`18080`)
- UDP disabled (`18082`)

You can override with env vars, for example:

```bash
docker run --rm \
  -e RUN_LISTENER=true \
  -e LISTENER_ENABLE_HTTP=true \
  -e LISTENER_HTTP_PORT=18080 \
  -p 8080:8080 \
  -p 18080:18080 \
  -p 18081:18081 \
  endpoint-simulator
```

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
