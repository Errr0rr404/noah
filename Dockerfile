# Static-site server for Railway — no app dependencies, just Caddy.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY . /usr/share/caddy
