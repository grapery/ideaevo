FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
API_BASE="${API_URL:-http://localhost:8080}"
case "$API_BASE" in
  */api) ;;
  *) API_BASE="${API_BASE%/}/api" ;;
esac
export API_URL="$API_BASE"
sed -i "s|__API_URL__|${API_BASE}|g" /app/public/runtime-env.js
exec node server.js
EOF
RUN chmod +x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]
