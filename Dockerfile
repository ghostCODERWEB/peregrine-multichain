# Single image, runs both the Next.js server and the scanner worker (via
# docker-compose's second service definition using the same image).
FROM node:23.11.0-slim AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
# better-sqlite3 needs Python + a C++ toolchain if no prebuild matches the
# container's platform; installed unconditionally since it's small next to
# the alternative of a build failing silently on an unusual host arch.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm build

FROM base AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/src ./src
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json ./tsconfig.json
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["pnpm", "start"]
