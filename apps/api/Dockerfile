FROM node:22-slim

# Prisma 6 requiere OpenSSL y certificados raíz en contenedores Debian slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Instalar la versión exacta de pnpm del monorepo
RUN npm install -g pnpm@12.9.1

WORKDIR /app

# Copiar manifiestos del workspace para aprovechar la caché de capas de Docker
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# Instalar únicamente las dependencias del backend (incluye prisma CLI para migraciones)
RUN pnpm install --filter api --frozen-lockfile

# Copiar el código fuente, esquemas Prisma, seed de aeropuertos y SKILL.md del backend
COPY apps/api ./apps/api

WORKDIR /app/apps/api

# Generar cliente de Prisma y compilar NestJS (incluye assets SKILL.md en dist/)
RUN pnpm exec prisma generate && pnpm run build

ENV NODE_ENV=production
EXPOSE 3001

# Aplicar migraciones pendientes y arrancar NestJS con exec para propagar SIGTERM
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && exec node dist/main"]
