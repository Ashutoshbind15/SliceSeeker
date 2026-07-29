# syntax=docker/dockerfile:1

FROM alpine:3.24 AS ffmpeg-build

ARG FFMPEG_VERSION=8.0.1
ARG FFMPEG_SHA256=05ee0b03119b45c0bdb4df654b96802e909e0a752f72e4fe3794f487229e5a41

RUN apk add --no-cache \
  build-base \
  curl \
  lame-dev \
  linux-headers \
  nasm \
  pkgconf \
  xz \
  zlib-dev

COPY scripts/build-ffmpeg-lgpl.sh /tmp/build-ffmpeg-lgpl.sh
RUN FFMPEG_VERSION="${FFMPEG_VERSION}" \
  FFMPEG_SHA256="${FFMPEG_SHA256}" \
  sh /tmp/build-ffmpeg-lgpl.sh

FROM node:lts-alpine3.24 AS base

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable \
  && npm install -g @quantco/pnpm-licenses@2.4.2

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY worker/package.json ./worker/
COPY scripts/generate-third-party-notices.mjs ./scripts/

RUN pnpm install --frozen-lockfile --filter worker...

COPY packages/db ./packages/db
COPY packages/queue ./packages/queue
COPY worker ./worker

RUN pnpm --filter db run build \
  && pnpm --filter queue run build \
  && pnpm --filter worker run build \
  && node scripts/generate-third-party-notices.mjs \
    --filter worker... \
    --component indexer-worker \
    --out /tmp/THIRD_PARTY_NOTICES

FROM node:lts-alpine3.24 AS prod

ARG VERSION=1.0.0
ARG REVISION=unknown
ARG FFMPEG_VERSION=8.0.1
LABEL org.opencontainers.image.title="SliceSeeker Indexer Worker" \
  org.opencontainers.image.description="SliceSeeker indexing worker (segments, transcribes and embeds video)" \
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
ENV NODE_ENV=production
ENV PATH="/opt/ffmpeg/bin:${PATH}"
ENV LD_LIBRARY_PATH="/opt/ffmpeg/lib"

RUN apk add --no-cache lame-libs zlib \
  && corepack enable

COPY --from=ffmpeg-build /opt/ffmpeg /opt/ffmpeg
COPY --from=ffmpeg-build /opt/ffmpeg-source /licenses/ffmpeg
COPY scripts/build-ffmpeg-lgpl.sh /licenses/ffmpeg/build-ffmpeg-lgpl.sh

RUN ffmpeg -hide_banner -version \
  && ffprobe -hide_banner -version \
  && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q 'libmp3lame'

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY worker/package.json ./worker/

RUN pnpm install --frozen-lockfile --prod --filter worker...

COPY --from=base /app/packages/db/dist ./packages/db/dist
COPY --from=base /app/packages/queue/dist ./packages/queue/dist
COPY --from=base /app/worker/dist ./worker/dist

COPY LICENSE /licenses/LICENSE
COPY licenses/ /licenses/
COPY --from=base /tmp/THIRD_PARTY_NOTICES /licenses/THIRD_PARTY_NOTICES

# Runs after every apk operation above so the inventory matches the shipped layers.
COPY scripts/write-os-package-notice.sh /tmp/write-os-package-notice.sh
RUN SLICESEEKER_COMPONENT=indexer-worker \
  SLICESEEKER_EXTRA_NOTICE="  FFmpeg ${FFMPEG_VERSION} (LGPL-2.1-or-later) - https://ffmpeg.org/\n  Built without GPL, nonfree, version3, network, or DVD components.\n  Exact source and build configuration: /licenses/ffmpeg/" \
  sh /tmp/write-os-package-notice.sh /licenses/OS-PACKAGES-NOTICE \
  && rm /tmp/write-os-package-notice.sh

WORKDIR /app/worker

CMD ["node", "dist/index.js"]
