# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Native build tools required by better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace manifests for layer caching
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci

# Copy sources
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build backend → backend/dist/ (shared is compiled inline by tsc via path alias)
RUN npm run build:docker -w backend

# Build frontend → frontend/dist/
RUN npm run build -w frontend

# Copy frontend build into backend's public dir so Express can serve it
RUN cp -r frontend/dist/. backend/dist/public/

# Prune dev dependencies before copying to runner
RUN npm prune --omit=dev

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Copy pruned node_modules (includes compiled better-sqlite3 binary)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# Copy compiled artifacts (shared is compiled into backend/dist/shared/src/)
COPY --from=builder /app/backend/dist ./backend/dist

# Copy package files needed by module-alias to resolve _moduleAliases
COPY --from=builder /app/package.json ./
COPY --from=builder /app/backend/package.json ./backend/

# Persistent volume for the SQLite database
RUN mkdir -p /app/backend/dist/backend/src/repos
VOLUME ["/app/backend/dist/backend/src/repos"]

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app/backend

CMD ["node", "-r", "module-alias/register", "dist/backend/src/main.js"]
