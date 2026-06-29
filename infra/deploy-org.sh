#!/usr/bin/env bash
# Deploy org.anvaya.one — the INDEPENDENT Organisation governance platform — add-only onto the same
# box as me.anvaya/ShitalEco, with its OWN Postgres + containers + vhosts (no shared DB with the
# family app). Mirrors deploy-anvaya.sh/deploy-api.sh:
#   * own Postgres container `anvaya-org-postgres` (DB anvaya_org).
#   * org-api container `anvaya-org-api` (:4100) + org-web container `anvaya-org-web` (:3100),
#     on ShitalEco's Docker network so its nginx can proxy to them by name.
#   * TWO vhosts added into Shital's conf.d (gated by `nginx -t`, rolled back on failure):
#       org.anvaya.one     -> anvaya-org-web:3100   (the admin console)
#       dedapi.org.anvaya.one -> anvaya-org-api:4100 (the dedapi channel me.anvaya consumes)
#   * Let's Encrypt certs for both via the certbot container.
# Secrets (ORG_SESSION_SECRET, ORG_PG_PASSWORD) are generated once and persisted in /opt/anvaya/org.env.
# Never edits any ShitalEco or me.anvaya config/container.
set -euo pipefail

API_DIR=/var/www/anvaya-org-api      # runner-built org-api bundle (dist + prod node_modules)
WEB_DIR=/var/www/anvaya-org          # runner-built org-web standalone tree
CONFD=/opt/shitaleco/nginx/conf.d
NGINX_CTR=shitaleco-nginx-1
CERTBOT_CTR=shitaleco-certbot-1
NODE_IMAGE=node:20-bookworm-slim
WEBROOT=/var/www/certbot
ENVFILE=/opt/anvaya/org.env
API_CTR=anvaya-org-api
WEB_CTR=anvaya-org-web
PG_CTR=anvaya-org-postgres
API_PORT=4100
WEB_PORT=3100
APP_DOMAIN=org.anvaya.one
DEDAPI_DOMAIN=dedapi.org.anvaya.one

[ -f "$API_DIR/dist/main.js" ] || { echo "ERROR: org-api bundle missing at $API_DIR/dist/main.js"; exit 1; }
[ -f "$WEB_DIR/web/server.js" ] || { echo "ERROR: org-web standalone missing at $WEB_DIR/web/server.js"; exit 1; }

echo "==> Pre-flight: ShitalEco nginx + host-mounted conf.d present"
docker ps --format '{{.Names}}' | grep -qx "$NGINX_CTR" || { echo "ERROR: $NGINX_CTR not running"; exit 1; }
[ -d "$CONFD" ] || { echo "ERROR: $CONFD not found"; exit 1; }
NET="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$NGINX_CTR" | head -n1)"
echo "    nginx network: $NET"

# --- Persisted secrets (generate once) ---
mkdir -p /opt/anvaya
gen() { head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40; }
[ -f "$ENVFILE" ] && . "$ENVFILE" || true
ORG_SESSION_SECRET="${ORG_SESSION_SECRET:-$(gen)}"
ORG_PG_PASSWORD="${ORG_PG_PASSWORD:-$(gen)}"
umask 077
cat > "$ENVFILE" <<EOF
ORG_SESSION_SECRET=$ORG_SESSION_SECRET
ORG_PG_PASSWORD=$ORG_PG_PASSWORD
EOF
echo "    secrets persisted to $ENVFILE"

# Fabric topology (mirrors me.anvaya): a Common control-plane DB + per-country cell DBs, all in the
# org Postgres cluster (logical isolation now; move a cell to its own host later = change its URL).
PG_BASE="postgres://anvaya_org:${ORG_PG_PASSWORD}@${PG_CTR}:5432"
ORG_COMMON_DATABASE_URL="${PG_BASE}/anvaya_org"
ORG_DATABASE_URL_IN="${PG_BASE}/anvaya_org_in"
ORG_DATABASE_URL_UK="${PG_BASE}/anvaya_org_uk"
ORG_DATABASE_URL_US="${PG_BASE}/anvaya_org_us"

echo "==> Postgres ($PG_CTR) — dedicated to org.anvaya.one"
if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CTR"; then
  docker rm -f "$PG_CTR" >/dev/null 2>&1 || true
  docker run -d --name "$PG_CTR" --restart unless-stopped --network "$NET" \
    -e POSTGRES_USER=anvaya_org -e POSTGRES_PASSWORD="$ORG_PG_PASSWORD" -e POSTGRES_DB=anvaya_org \
    -v anvaya-org-pgdata:/var/lib/postgresql/data "postgres:16-alpine" >/dev/null
fi
for i in $(seq 1 30); do
  if docker exec "$PG_CTR" pg_isready -U anvaya_org >/dev/null 2>&1; then echo "    Postgres ready"; break; fi
  sleep 2
done

echo "==> Provision Common + per-country cell databases"
for db in anvaya_org_in anvaya_org_uk anvaya_org_us; do
  if ! docker exec "$PG_CTR" psql -U anvaya_org -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" 2>/dev/null | grep -q 1; then
    docker exec "$PG_CTR" psql -U anvaya_org -c "CREATE DATABASE ${db}" >/dev/null && echo "    created ${db}"
  fi
done

echo "==> Migrate Common + each country cell (seeds each country's governed catalogue)"
docker run --rm --network "$NET" -v "$API_DIR":/app -w /app \
  -e ORG_COMMON_DATABASE_URL="$ORG_COMMON_DATABASE_URL" \
  -e ORG_DATABASE_URL_IN="$ORG_DATABASE_URL_IN" \
  -e ORG_DATABASE_URL_UK="$ORG_DATABASE_URL_UK" \
  -e ORG_DATABASE_URL_US="$ORG_DATABASE_URL_US" \
  "$NODE_IMAGE" node dist/db/migrate.js || { echo "ERROR: org migration failed"; exit 1; }

echo "==> org-api container ($API_CTR :$API_PORT)"
docker rm -f "$API_CTR" >/dev/null 2>&1 || true
docker run -d --name "$API_CTR" --restart unless-stopped --network "$NET" \
  -v "$API_DIR":/app -w /app \
  -e NODE_ENV=production -e ORG_PORT="$API_PORT" \
  -e ORG_COMMON_DATABASE_URL="$ORG_COMMON_DATABASE_URL" \
  -e ORG_DATABASE_URL_IN="$ORG_DATABASE_URL_IN" \
  -e ORG_DATABASE_URL_UK="$ORG_DATABASE_URL_UK" \
  -e ORG_DATABASE_URL_US="$ORG_DATABASE_URL_US" \
  -e ORG_DEFAULT_REGION=IN \
  -e ORG_SESSION_SECRET="$ORG_SESSION_SECRET" \
  -e ORG_APP_BASE="https://${APP_DOMAIN}" \
  "$NODE_IMAGE" node dist/main.js

echo "==> org-web container ($WEB_CTR :$WEB_PORT)"
docker rm -f "$WEB_CTR" >/dev/null 2>&1 || true
docker run -d --name "$WEB_CTR" --restart unless-stopped --network "$NET" \
  -v "$WEB_DIR":/app -w /app \
  -e NODE_ENV=production -e PORT="$WEB_PORT" -e HOSTNAME=0.0.0.0 \
  -e NEXT_PUBLIC_ORG_API_URL="https://${DEDAPI_DOMAIN}" \
  "$NODE_IMAGE" node web/server.js

echo "==> Wait for containers (from inside nginx, by name)"
ok=0
for i in $(seq 1 30); do
  if docker exec "$NGINX_CTR" sh -c "wget -qO- -T 5 http://${API_CTR}:${API_PORT}/health" 2>/dev/null | grep -q '"status"'; then ok=1; break; fi
  sleep 2
done
[ "$ok" = 1 ] || { echo "ERROR: $API_CTR not reachable from $NGINX_CTR — aborting before touching nginx"; exit 1; }

echo "==> Add-only vhosts (HTTP first; gated by nginx -t)"
VHOST="$CONFD/anvaya-org.conf"
VHOST_BAK="$(mktemp)"
[ -f "$VHOST" ] && cp "$VHOST" "$VHOST_BAK" || true
write_http() {
  cat > "$VHOST" <<EOF
server {
    listen 80; listen [::]:80;
    server_name ${APP_DOMAIN} ${DEDAPI_DOMAIN};
    location /.well-known/acme-challenge/ { root ${WEBROOT}; }
    location / {
        if (\$host = ${DEDAPI_DOMAIN}) { proxy_pass http://${API_CTR}:${API_PORT}; }
        proxy_pass http://${WEB_CTR}:${WEB_PORT};
        proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
}
write_http
if docker exec "$NGINX_CTR" nginx -t; then docker exec "$NGINX_CTR" nginx -s reload; else
  echo "ERROR: nginx -t failed — restoring"; [ -s "$VHOST_BAK" ] && cp "$VHOST_BAK" "$VHOST" || rm -f "$VHOST"
  docker exec "$NGINX_CTR" nginx -t && docker exec "$NGINX_CTR" nginx -s reload || true; exit 1
fi

echo "==> TLS via certbot container"
if [ -n "${CERTBOT_EMAIL:-}" ] && docker ps --format '{{.Names}}' | grep -qx "$CERTBOT_CTR"; then
  docker exec "$CERTBOT_CTR" certbot certonly --webroot -w "$WEBROOT" \
    -d "$APP_DOMAIN" -d "$DEDAPI_DOMAIN" --email "$CERTBOT_EMAIL" --agree-tos --non-interactive --keep-until-expiring || \
    echo "    WARN: certbot failed — serving HTTP until DNS points here"
else
  echo "    WARN: no CERTBOT_EMAIL/certbot container — serving HTTP only"
fi

# Promote to HTTPS only if a cert now exists (per-domain blocks; HTTP→HTTPS redirect).
CERT_DIR="/etc/letsencrypt/live/${APP_DOMAIN}"
if docker exec "$NGINX_CTR" test -d "$CERT_DIR" 2>/dev/null; then
  cat > "$VHOST" <<EOF
server { listen 80; listen [::]:80; server_name ${APP_DOMAIN} ${DEDAPI_DOMAIN};
    location /.well-known/acme-challenge/ { root ${WEBROOT}; }
    location / { return 301 https://\$host\$request_uri; } }
server { listen 443 ssl; listen [::]:443 ssl; server_name ${APP_DOMAIN};
    ssl_certificate ${CERT_DIR}/fullchain.pem; ssl_certificate_key ${CERT_DIR}/privkey.pem;
    location / { proxy_pass http://${WEB_CTR}:${WEB_PORT}; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto \$scheme; proxy_set_header X-Forwarded-For \$remote_addr; } }
server { listen 443 ssl; listen [::]:443 ssl; server_name ${DEDAPI_DOMAIN};
    ssl_certificate ${CERT_DIR}/fullchain.pem; ssl_certificate_key ${CERT_DIR}/privkey.pem;
    location / { proxy_pass http://${API_CTR}:${API_PORT}; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto \$scheme; proxy_set_header X-Forwarded-For \$remote_addr; } }
EOF
  if docker exec "$NGINX_CTR" nginx -t; then docker exec "$NGINX_CTR" nginx -s reload; else
    echo "ERROR: HTTPS nginx -t failed — restoring HTTP"; write_http; docker exec "$NGINX_CTR" nginx -t && docker exec "$NGINX_CTR" nginx -s reload || true
  fi
fi

rm -f "$VHOST_BAK" 2>/dev/null || true
echo "==> Done. org.anvaya.one (console) + dedapi.org.anvaya.one (channel) deployed."
