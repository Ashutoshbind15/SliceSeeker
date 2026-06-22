FROM node:lts-alpine

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY search/package.json ./search/

RUN pnpm install --frozen-lockfile --filter search...

COPY search ./search

WORKDIR /app/search

EXPOSE 3001

CMD ["pnpm", "dev"]
