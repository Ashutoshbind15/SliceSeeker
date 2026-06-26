FROM node:lts-alpine AS base

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile --filter server...

COPY packages/db ./packages/db
COPY packages/queue ./packages/queue
COPY server ./server

RUN pnpm --filter db run build \
  && pnpm --filter queue run build \
  && pnpm --filter server run build

FROM node:lts-alpine AS prod

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NODE_ENV=production

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile --prod --filter server...

COPY --from=base /app/packages/db/dist ./packages/db/dist
COPY --from=base /app/packages/queue/dist ./packages/queue/dist
COPY --from=base /app/server/dist ./server/dist

WORKDIR /app/server

EXPOSE 3000

CMD ["node", "dist/index.js"]
