#!/bin/sh
# Container-Einstieg für die Fly.io-Bereitstellung.
# Prüft Pflichtvoraussetzungen und wählt die nginx-Routing-Variante,
# bevor der Node-Supervisor alle Dienste startet.
set -eu

# nginx-Laufzeitverzeichnisse (Container läuft ohne systemd).
mkdir -p /run /tmp/nginx-body /tmp/nginx-proxy /tmp/nginx-fastcgi /tmp/nginx-uwsgi /tmp/nginx-scgi

# Editor-Routen: nur eingeblendet, wenn ausdrücklich freigegeben.
if [ "${GCS_EDITOR_PUBLIC:-0}" = "1" ]; then
    cp /app/deploy/fly/editor.conf /run/gcs-editor.conf
    echo "[entrypoint] Editor-Routen aktiviert (GCS_EDITOR_PUBLIC=1)."
else
    : > /run/gcs-editor.conf
fi

# Pflichtprüfungen — kein stiller Start ohne Volume und Secret.
if [ ! -d /data ]; then
    echo "[entrypoint] FEHLER: Persistentes Volume /data ist nicht gemountet." >&2
    exit 1
fi
if [ -z "${JWT_SECRET:-}" ]; then
    echo "[entrypoint] FEHLER: JWT_SECRET fehlt (fly secrets set JWT_SECRET=…)." >&2
    exit 1
fi

exec node /app/scripts/production/start-services.mjs
