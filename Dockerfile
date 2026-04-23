FROM dhi.io/node:25-alpine3.23-dev AS builder

WORKDIR /app

# Workspace manifests for better layer caching
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci

# Copy sources
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build backend and frontend artifacts
RUN npm run build:docker -w backend
RUN npm run build -w frontend

RUN cp -r frontend/dist/. backend/dist/public/ \
  && mkdir -p backend/dist/backend/src/repos \
  && mkdir -p data

RUN npm ci --omit=dev

FROM dhi.io/node:25-alpine3.23 AS runner

WORKDIR /app

# Runtime dependencies and compiled artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/backend/package.json ./backend/
COPY --chown=1000:1000 --from=builder /app/data ./data

VOLUME ["/app/data"]
VOLUME ["/app/certs"]

EXPOSE 8080
EXPOSE 8443

ENV NODE_ENV=production \
  PORT=8080 \
  HTTPS_PORT=8443 \
  CERT_DIR=/app/certs \
  DB_PATH=/app/data/db.sqlite

WORKDIR /app/backend

CMD ["node", "dist/backend/src/main.js"]
