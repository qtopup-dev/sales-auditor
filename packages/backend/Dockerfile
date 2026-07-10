# Backend image — built from the monorepo root so npm workspaces resolve correctly.
# Build context MUST be the repo root: `docker build -f packages/backend/Dockerfile .`
FROM node:20-slim

WORKDIR /app

# Copy workspace manifests first for better layer caching. All three package.json files
# are required even though this image only runs the backend — npm workspaces validates
# the full workspace set against the root package-lock.json on `npm ci`.
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN npm ci

COPY tsconfig.json ./
COPY packages/shared packages/shared
COPY packages/backend packages/backend

WORKDIR /app/packages/backend

# prisma.config.ts requires the CWD to be packages/backend for both generate and migrate.
# `generate` doesn't connect to a database, but prisma.config.ts eagerly calls env('DATABASE_URL')
# on every CLI invocation and throws if it's unresolved — so a dummy value scoped to this one
# RUN step satisfies that check. The real DATABASE_URL is injected at container runtime via
# docker-compose's env_file and overrides this build-time placeholder.
RUN DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/placeholder" npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV TZ=UTC
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
