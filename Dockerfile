# Static-site server for Railway — no app dependencies, just Caddy.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
# Copy only the site assets into the web root (keeps infra files out of it).
COPY index.html styles.css script.js mascot.js /usr/share/caddy/
