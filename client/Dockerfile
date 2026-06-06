FROM node:lts-alpine AS build

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile --filter client...

COPY client ./client

RUN pnpm --filter client run build

FROM caddy:2-alpine

WORKDIR /app

COPY client/Caddyfile ./Caddyfile
RUN caddy fmt Caddyfile --overwrite

COPY --from=build /app/client/dist ./dist

CMD ["caddy", "run", "--config", "Caddyfile", "--adapter", "caddyfile"]
