FROM node:lts-alpine

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile --filter db...

COPY packages/db ./packages/db

WORKDIR /app/packages/db

CMD ["pnpm", "db:push"]
