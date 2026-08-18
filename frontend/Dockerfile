# ─────────────────────────────────────────────
# Frontend (Next.js) — multi-stage Docker build
# ─────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app

# 1) Bog'liqliklarni alohida yuklash (cache uchun)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2) Production build (standalone output)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3) Yakuniy image — standalone server
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
