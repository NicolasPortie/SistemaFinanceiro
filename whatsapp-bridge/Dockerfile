FROM node:22-alpine

WORKDIR /app

# Instalar dependências
COPY package.json package-lock.json* yarn.lock* ./
RUN npm install --production 2>/dev/null || yarn install --frozen-lockfile --production 2>/dev/null || true

# Copiar código compilado
COPY dist/ ./dist/

# Criar diretório para auth state
RUN mkdir -p /app/auth_data

EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3100/health || exit 1

CMD ["node", "dist/index.js"]
