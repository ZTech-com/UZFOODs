# ═══════════════════════════════════════════════════════════════════
# UZFOODs — Full-Stack Production Dockerfile
#
# Frontend: Next.js static export → frontend/out/
# Backend:  NestJS → backend/dist/
# Runner:   Backend serves frontend static + API at :${PORT}
# ═══════════════════════════════════════════════════════════════════

# ─── STAGE 1: Frontend Build ──────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ENV EXPORT=true NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── STAGE 2: Backend Build ───────────────────────────────────────
FROM node:22-alpine AS backend-build
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ─── STAGE 3: Production Runner ───────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    FRONTEND_PATH=/app/frontend/out

# Backend dependencies (production only)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Prisma engine + generated client
COPY --from=backend-build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-build /app/node_modules/@prisma ./node_modules/@prisma

# Backend dist
COPY --from=backend-build /app/dist ./dist

# Prisma schema (for db push at runtime)
COPY --from=backend-build /app/prisma ./prisma

# Backend scripts reference
COPY --from=backend-build /app/tsconfig.json ./tsconfig.json
COPY --from=backend-build /app/tsconfig.build.json ./tsconfig.build.json
COPY --from=backend-build /app/nest-cli.json ./nest-cli.json

# Frontend static export
COPY --from=frontend-build /app/frontend/out ./frontend/out

# Seed file
COPY --from=backend-build /app/prisma/seed.ts ./prisma/seed.ts

EXPOSE 3001

# Ishga tushirish: sxema → seed → server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
