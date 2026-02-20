# Stage 1: Builder
# Separar COPY do package.json do COPY do código fonte para maximizar cache:
# se só o código mudar (sem mexer em package.json), o 'npm ci' é reutilizado do cache.
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar apenas manifests primeiro — camada cacheada enquanto não mudar package.json
COPY package.json package-lock.json* ./

# Instalar todas as dependências (dev + prod) para o build do Next.js
# Usamos cache do BuildKit para não baixar a internet inteira a cada deploy
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copiar o restante do código fonte
COPY . .

# Garantir que a pasta public existe
RUN mkdir -p /app/public

# Build arguments
ARG API_PROXY_TARGET=http://api:5000
ENV NEXT_TELEMETRY_DISABLED=1

# Build da aplicação
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app

# Instalar curl para healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar arquivos necessários
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json

# Mudar para usuário não-root
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
