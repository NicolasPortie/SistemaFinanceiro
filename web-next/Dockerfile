# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copiar apenas arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar dependências
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar dependências do stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Garantir que a pasta public existe
RUN mkdir -p /app/public

# Build arguments
ARG API_PROXY_TARGET=http://api:5000
ENV NEXT_TELEMETRY_DISABLED=1

# Instalar todas as dependências (incluindo dev) e fazer build
RUN npm ci && npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

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
