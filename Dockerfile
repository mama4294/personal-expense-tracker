FROM node:22-alpine AS base

# Full tree, including dev tooling, because `next build` needs TypeScript and
# Tailwind. --ignore-scripts skips the `postinstall: prisma generate` hook, which
# would fail here: this stage has the manifests but not prisma/schema.prisma. The
# builder stage runs `prisma generate` explicitly once the source is present.
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Runtime-only tree for the migrator. Keeps `embedded-postgres` — a 140 MB local
# development convenience — out of the published image.
FROM base AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# One-shot image that applies migrations and seeds the database. It needs the
# Prisma CLI and tsx, neither of which ships in the standalone server output.
FROM base AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps-prod /app/node_modules ./node_modules
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY --from=builder /app/src/generated ./src/generated
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
