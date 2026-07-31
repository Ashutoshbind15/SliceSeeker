# syntax=docker/dockerfile:1

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

FROM caddy:2.11.4-alpine

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
  org.opencontainers.image.base.name="docker.io/library/caddy:2.11.4-alpine" \
  org.opencontainers.image.licenses=""

WORKDIR /app

COPY client/Caddyfile ./Caddyfile
RUN caddy fmt Caddyfile --overwrite

COPY --from=build /app/client/dist ./dist

COPY LICENSE /licenses/LICENSE
COPY licenses/ /licenses/
COPY --from=build /tmp/THIRD_PARTY_NOTICES /licenses/THIRD_PARTY_NOTICES

# Caddy ships as a prebuilt binary in the base image rather than an apk package,
# so it never shows up in the inventory the script reads.
COPY scripts/write-os-package-notice.sh /tmp/write-os-package-notice.sh
RUN SLICESEEKER_COMPONENT=admin-ui \
  SLICESEEKER_SOURCE_ARCHIVE_URL="${SOURCE_ARCHIVE_URL}" \
  SLICESEEKER_SOURCE_MANIFEST_URL="${SOURCE_MANIFEST_URL}" \
  SLICESEEKER_EXTRA_NOTICE="  Caddy web server (Apache-2.0) - https://github.com/caddyserver/caddy\n  Bundled by the caddy:2.11.4-alpine base image, not installed via apk.\n  License text: /licenses/Apache-2.0.txt\n\n  Inter and Outfit typefaces (OFL-1.1) are bundled in the SPA assets under\n  ./dist and are attributed in /licenses/THIRD_PARTY_NOTICES." \
  sh /tmp/write-os-package-notice.sh /licenses/OS-PACKAGES-NOTICE \
  && rm /tmp/write-os-package-notice.sh

CMD ["caddy", "run", "--config", "Caddyfile", "--adapter", "caddyfile"]
