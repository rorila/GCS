# syntax=docker/dockerfile:1
# GCS-Produktions-Image für Fly.io:
#   Vite-Editor-Build + Standalone-Runtime + Game-Server (Node 22) +
#   CMS-Skripte + nginx-Eingang + Piper (TTS) + whisper.cpp (STT).
#
# Die SQLite-Datenbank liegt NICHT im Image — sie wird per Migration auf dem
# Volume /data erzeugt (siehe deploy/fly/fly.toml und Flyio-Migrationsplan).
ARG NODE_IMAGE=node:22-bookworm-slim

# ── Stage 1: Node-Build (Editor dist, Runtime-Bundle, Game-Server dist) ──
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json vite.config.ts ./
COPY index.html player.html ./
RUN npm ci
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY game-server ./game-server
COPY docs ./docs
RUN npm run bundle:runtime \
 && npm run media:manifest \
 && npx tsc \
 && npx vite build
RUN cd game-server && npm ci && npm run build && npm prune --omit=dev
RUN npm prune --omit=dev

# ── Stage 2: whisper.cpp aus Quellen (gepinnter Tag) + Modell ───────────
FROM debian:bookworm-slim AS whisper
ARG WHISPER_CPP_TAG=v1.8.2
ARG WHISPER_MODEL=small
# Optional: SHA256 des Modells für Integritätsprüfung beim Build.
ARG WHISPER_MODEL_SHA256=
RUN apt-get update \
 && apt-get install -y --no-install-recommends git cmake build-essential ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch ${WHISPER_CPP_TAG} https://github.com/ggml-org/whisper.cpp /src
WORKDIR /src
RUN cmake -B build -DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF \
 && cmake --build build --config Release --target whisper-server -j"$(nproc)"
RUN curl -fL --retry 3 -o /opt/ggml-${WHISPER_MODEL}.bin \
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${WHISPER_MODEL}.bin" \
 && if [ -n "${WHISPER_MODEL_SHA256}" ]; then \
      echo "${WHISPER_MODEL_SHA256}  /opt/ggml-${WHISPER_MODEL}.bin" | sha256sum -c -; \
    else \
      echo "HINWEIS: WHISPER_MODEL_SHA256 nicht gesetzt — Modell ohne Prüfsumme übernommen."; \
    fi

# ── Stage 3: Laufzeit-Image ─────────────────────────────────────────────
FROM ${NODE_IMAGE} AS final
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      nginx-light python3 python3-venv libgomp1 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Piper-TTS in eigenem Venv (identische Paketversionen wie das lokale Setup)
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir "piper-tts[http]==1.4.2" "imageio-ffmpeg==0.6.0" \
 && mkdir -p /opt/models/voices \
 && /opt/venv/bin/python -m piper.download_voices --download-dir /opt/models/voices \
      de_DE-thorsten-medium de_DE-kerstin-low de_DE-ramona-low

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/game-server/package.json ./game-server/package.json
COPY --from=build /app/game-server/dist ./game-server/dist
COPY --from=build /app/game-server/public ./game-server/public
COPY --from=build /app/game-server/node_modules ./game-server/node_modules
COPY --from=whisper /src/build/bin/whisper-server /opt/whisper/whisper-server
COPY --from=whisper /opt/ggml-small.bin /opt/models/ggml-small.bin
COPY deploy/fly/nginx.conf deploy/fly/editor.conf deploy/fly/entrypoint.sh /app/deploy/fly/
RUN sed -i 's/\r$//' /app/deploy/fly/entrypoint.sh \
 && chmod +x /app/deploy/fly/entrypoint.sh /opt/whisper/whisper-server \
 && /opt/whisper/whisper-server --help \
 && node -e "require('./scripts/cms/cms-server.cjs')" \
 && mkdir -p /run /tmp/nginx-body /tmp/nginx-proxy /tmp/nginx-fastcgi /tmp/nginx-uwsgi /tmp/nginx-scgi \
 && touch /run/gcs-editor.conf \
 && nginx -t -c /app/deploy/fly/nginx.conf

# Datenpersistenz kommt aus dem Fly-Volume unter /data — nicht aus dem Image.
EXPOSE 8000
ENTRYPOINT ["/app/deploy/fly/entrypoint.sh"]
