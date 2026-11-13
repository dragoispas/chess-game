# Online game API (WebSocket + SQLite). Frontend can stay on Vercel.
FROM node:22-bookworm-slim

WORKDIR /app

# better-sqlite3 needs native build tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# SQLite lives here; mount a volume in production
RUN mkdir -p /app/data
ENV DATA_DIR=/app/data
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Stable process — no file watcher
CMD ["npm", "run", "start:server"]
