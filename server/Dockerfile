FROM node:lts-alpine

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile --filter server...

COPY server ./server

WORKDIR /app/server

EXPOSE 3000

CMD ["pnpm", "dev"]
