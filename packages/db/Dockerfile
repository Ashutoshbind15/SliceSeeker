# syntax=docker/dockerfile:1

FROM node:lts-alpine3.24

ARG VERSION=1.0.0
ARG REVISION=unknown
LABEL org.opencontainers.image.title="SliceSeeker DB Migrate" \
  org.opencontainers.image.description="SliceSeeker one-shot schema push for Postgres/pgvector" \
  org.opencontainers.image.licenses="MIT" \
  org.opencontainers.image.source="https://github.com/Ashutoshbind15/demo-search-ai" \
  org.opencontainers.image.url="https://github.com/Ashutoshbind15/demo-search-ai" \
  org.opencontainers.image.documentation="https://github.com/Ashutoshbind15/demo-search-ai" \
  org.opencontainers.image.vendor="SliceSeeker" \
  org.opencontainers.image.version="${VERSION}" \
  org.opencontainers.image.revision="${REVISION}" \
  org.opencontainers.image.base.name="docker.io/library/node:lts-alpine3.24"

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable \
  && npm install -g @quantco/pnpm-licenses@2.4.2

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY scripts/generate-third-party-notices.mjs ./scripts/

RUN pnpm install --frozen-lockfile --filter db...

COPY packages/db ./packages/db

RUN node scripts/generate-third-party-notices.mjs \
  --filter db... \
  --component db-migrate \
  --out /licenses/THIRD_PARTY_NOTICES

COPY LICENSE /licenses/LICENSE
COPY licenses/ /licenses/

COPY scripts/write-os-package-notice.sh /tmp/write-os-package-notice.sh
RUN SLICESEEKER_COMPONENT=db-migrate \
  sh /tmp/write-os-package-notice.sh /licenses/OS-PACKAGES-NOTICE \
  && rm /tmp/write-os-package-notice.sh

WORKDIR /app/packages/db

CMD ["pnpm", "db:push"]
