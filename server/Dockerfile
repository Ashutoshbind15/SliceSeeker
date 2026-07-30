# syntax=docker/dockerfile:1

FROM node:lts-alpine3.24 AS base

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable \
  && npm install -g @quantco/pnpm-licenses@2.4.2

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY server/package.json ./server/
COPY scripts/generate-third-party-notices.mjs ./scripts/

RUN pnpm install --frozen-lockfile --filter server...

COPY packages/db ./packages/db
COPY packages/queue ./packages/queue
COPY server ./server

RUN pnpm --filter db run build \
  && pnpm --filter queue run build \
  && pnpm --filter server run build \
  && node scripts/generate-third-party-notices.mjs \
    --filter server... \
    --component indexer-api \
    --out /tmp/THIRD_PARTY_NOTICES

FROM node:lts-alpine3.24 AS prod

ARG VERSION=1.0.0
ARG REVISION=unknown
ARG SOURCE_ARCHIVE_URL
ARG SOURCE_MANIFEST_URL
LABEL org.opencontainers.image.title="SliceSeeker Indexer API" \
  org.opencontainers.image.description="SliceSeeker Phase 1 indexing API and admin backend" \
  org.opencontainers.image.source="https://github.com/Ashutoshbind15/demo-search-ai" \
  org.opencontainers.image.url="https://github.com/Ashutoshbind15/demo-search-ai" \
  org.opencontainers.image.documentation="https://github.com/Ashutoshbind15/demo-search-ai" \
  org.opencontainers.image.vendor="SliceSeeker" \
  org.opencontainers.image.version="${VERSION}" \
  org.opencontainers.image.revision="${REVISION}" \
  org.opencontainers.image.base.name="docker.io/library/node:lts-alpine3.24"

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

COPY LICENSE /licenses/LICENSE
COPY licenses/ /licenses/
COPY --from=base /tmp/THIRD_PARTY_NOTICES /licenses/THIRD_PARTY_NOTICES

COPY scripts/copy-node-runtime-notices.sh /tmp/copy-node-runtime-notices.sh
COPY scripts/write-os-package-notice.sh /tmp/write-os-package-notice.sh
RUN sh /tmp/copy-node-runtime-notices.sh \
  && SLICESEEKER_COMPONENT=indexer-api \
  SLICESEEKER_SOURCE_ARCHIVE_URL="${SOURCE_ARCHIVE_URL}" \
  SLICESEEKER_SOURCE_MANIFEST_URL="${SOURCE_MANIFEST_URL}" \
  sh /tmp/write-os-package-notice.sh /licenses/OS-PACKAGES-NOTICE \
  && rm /tmp/copy-node-runtime-notices.sh /tmp/write-os-package-notice.sh

WORKDIR /app/server

EXPOSE 3000

CMD ["node", "dist/index.js"]
