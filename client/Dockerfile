# syntax=docker/dockerfile:1

# Shared by the Go-license collector and runtime base image.
ARG CADDY_VERSION=2.11.4

FROM node:lts-alpine3.24 AS build

ARG VITE_APP_ENV=production
ENV VITE_APP_ENV=$VITE_APP_ENV

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

RUN corepack enable \
  && npm install -g @quantco/pnpm-licenses@2.4.2

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY scripts/generate-third-party-notices.mjs ./scripts/

RUN pnpm install --frozen-lockfile --filter client...

COPY client ./client

RUN pnpm --filter client run build \
  && node scripts/generate-third-party-notices.mjs \
    --filter client... \
    --component admin-ui \
    --out /tmp/THIRD_PARTY_NOTICES

# This toolchain only resolves the matching Caddy module graph; the runtime
# binary still comes from the official Caddy image below.
FROM golang:1.25-bookworm AS caddy-licenses
ARG CADDY_VERSION

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY scripts/collect-caddy-go-licenses.sh /tmp/collect-caddy-go-licenses.sh
RUN sh /tmp/collect-caddy-go-licenses.sh --version "v${CADDY_VERSION}" --out /out

FROM caddy:${CADDY_VERSION}-alpine
ARG CADDY_VERSION

ARG VERSION=1.0.0
ARG REVISION=unknown
ARG SOURCE_ARCHIVE_URL
ARG SOURCE_MANIFEST_URL
# Override Caddy's inherited Apache-2.0 label: the assembled image contains
# components under multiple licenses documented in /licenses and its SBOM.
LABEL org.opencontainers.image.title="SliceSeeker Admin UI" \
  org.opencontainers.image.description="SliceSeeker operator console (static SPA served by Caddy)" \
  org.opencontainers.image.source="https://github.com/Ashutoshbind15/SliceSeeker" \
  org.opencontainers.image.url="https://github.com/Ashutoshbind15/SliceSeeker" \
  org.opencontainers.image.documentation="https://github.com/Ashutoshbind15/SliceSeeker" \
  org.opencontainers.image.vendor="SliceSeeker" \
  org.opencontainers.image.version="${VERSION}" \
  org.opencontainers.image.revision="${REVISION}" \
  org.opencontainers.image.base.name="docker.io/library/caddy:${CADDY_VERSION}-alpine" \
  org.opencontainers.image.licenses=""

WORKDIR /app

COPY client/Caddyfile ./Caddyfile
RUN caddy fmt Caddyfile --overwrite

COPY --from=build /app/client/dist ./dist

COPY LICENSE /licenses/LICENSE
COPY licenses/ /licenses/
COPY --from=build /tmp/THIRD_PARTY_NOTICES /licenses/THIRD_PARTY_NOTICES
COPY --from=caddy-licenses /out/ /licenses/caddy/

# Caddy ships as a prebuilt binary in the base image rather than an apk package,
# so it never shows up in the inventory the script reads.
COPY scripts/write-os-package-notice.sh /tmp/write-os-package-notice.sh
RUN test -f /licenses/caddy/LICENSE \
  && test -f /licenses/caddy/NOTICE \
  && test -f /licenses/caddy/MODULES.csv \
  && test -d /licenses/caddy/modules \
  && test -f /licenses/caddy/mpl-source/MANIFEST.tsv \
  && SLICESEEKER_COMPONENT=admin-ui \
  SLICESEEKER_SOURCE_ARCHIVE_URL="${SOURCE_ARCHIVE_URL}" \
  SLICESEEKER_SOURCE_MANIFEST_URL="${SOURCE_MANIFEST_URL}" \
  SLICESEEKER_EXTRA_NOTICE="  Caddy web server ${CADDY_VERSION} (Apache-2.0)\n  Source: https://github.com/caddyserver/caddy/tree/v${CADDY_VERSION}\n  Bundled by the caddy:${CADDY_VERSION}-alpine base image, not installed via apk.\n  Upstream LICENSE: /licenses/caddy/LICENSE\n  Canonical Apache-2.0 text: /licenses/Apache-2.0.txt\n  Linked Go module licenses: /licenses/caddy/NOTICE, MODULES.csv, modules/\n  MPL Covered Software source: /licenses/caddy/mpl-source/\n\n  Inter and Outfit typefaces (OFL-1.1) are bundled in the SPA assets under\n  ./dist and are attributed in /licenses/THIRD_PARTY_NOTICES." \
  sh /tmp/write-os-package-notice.sh /licenses/OS-PACKAGES-NOTICE \
  && rm /tmp/write-os-package-notice.sh

CMD ["caddy", "run", "--config", "Caddyfile", "--adapter", "caddyfile"]
