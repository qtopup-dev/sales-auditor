# Frontend image — multi-stage: build with Node, serve with nginx.
# Build context MUST be the repo root: `docker build -f packages/frontend/Dockerfile .`
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN npm ci

COPY tsconfig.json ./
COPY packages/shared packages/shared
COPY packages/frontend packages/frontend

WORKDIR /app/packages/frontend
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
