# Static Noah Super World. worker.js only attached cache/security headers.
FROM --platform=linux/amd64 nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html 404.html styles.css script.js mascot.js sw.js manifest.json /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
