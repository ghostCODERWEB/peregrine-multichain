# Peregrine: Next.js app + background scanner in one container, SQLite on a persistent volume at /data.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
ENV TIDE_DB_PATH=/data/site.db PORT=3000
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
