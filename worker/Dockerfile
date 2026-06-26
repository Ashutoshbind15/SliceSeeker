FROM node:lts-alpine AS base

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY worker/package.json ./worker/

RUN pnpm install --frozen-lockfile --filter worker...

COPY packages/db ./packages/db
COPY packages/queue ./packages/queue
COPY worker ./worker

RUN pnpm --filter db run build \
  && pnpm --filter queue run build \
  && pnpm --filter worker run build

FROM node:lts-alpine AS prod

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg \
  && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY worker/package.json ./worker/

RUN pnpm install --frozen-lockfile --prod --filter worker...

COPY --from=base /app/packages/db/dist ./packages/db/dist
COPY --from=base /app/packages/queue/dist ./packages/queue/dist
COPY --from=base /app/worker/dist ./worker/dist

WORKDIR /app/worker

CMD ["node", "dist/index.js"]
