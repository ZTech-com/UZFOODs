# ─────────────────────────────────────────────
# Backend (NestJS) — multi-stage Docker build
# ─────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app

# 1) Bog'liqliklarni alohida yuklash (cache uchun)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2) Prisma client yaratish va TypeScript build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# 3) Yakuniy image — faqat kerakli fayllar
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.build.json ./tsconfig.build.json
EXPOSE 3001

# Ishga tushirish: sxemani DB'ga qo'llash → namunaviy menyuni yuklash → serverni boshlash
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run prisma:seed && node dist/main"]
