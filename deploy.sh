#!/bin/bash
set -e

echo "==================================="
echo "Deploy ControlFinance - Produção"
echo "==================================="

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo -e "${YELLOW}📝 Copie o .env.prod.example e configure:${NC}"
    echo "   cp .env.prod.example .env"
    echo "   nano .env"
    exit 1
fi

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não está instalado${NC}"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose não está instalado${NC}"
    exit 1
fi

# Parar containers antigos
echo -e "${YELLOW}⏸️  Parando containers antigos...${NC}"
docker compose -f docker-compose.prod.yml down

# Limpar imagens antigas
echo -e "${YELLOW}🧹 Limpando imagens antigas...${NC}"
docker image prune -f

# Build das novas imagens
echo -e "${YELLOW}🔨 Construindo novas imagens...${NC}"

# Detectar versão a partir da tag Git (tag exata do commit atual, ou describe como fallback)
APP_VERSION=$(git describe --tags --exact-match HEAD 2>/dev/null || git describe --tags --always 2>/dev/null || echo "0.0.0-dev")
APP_VERSION="${APP_VERSION#v}"  # Remove prefixo 'v' (v1.4.0 → 1.4.0)
export APP_VERSION
echo -e "${GREEN}📦 Versão detectada: ${APP_VERSION}${NC}"

docker compose -f docker-compose.prod.yml build --build-arg VERSION=${APP_VERSION}

# Iniciar containers
echo -e "${YELLOW}🚀 Iniciando containers...${NC}"
docker compose -f docker-compose.prod.yml up -d

# Aguardar inicialização
echo -e "${YELLOW}⏳ Aguardando inicialização (30s)...${NC}"
sleep 30

# Verificar status
echo -e "${YELLOW}📊 Status dos containers:${NC}"
docker compose -f docker-compose.prod.yml ps

# Verificar saúde da API
echo -e "${YELLOW}🏥 Verificando saúde da API...${NC}"
if curl -f http://localhost:5000/health &> /dev/null; then
    echo -e "${GREEN}✅ API está respondendo!${NC}"
else
    echo -e "${RED}❌ API não está respondendo${NC}"
    echo -e "${YELLOW}📝 Verifique os logs:${NC}"
    echo "   docker compose -f docker-compose.prod.yml logs api"
    exit 1
fi

# Verificar saúde do Web
echo -e "${YELLOW}🏥 Verificando saúde do Frontend...${NC}"
if curl -f http://localhost:3000 &> /dev/null; then
    echo -e "${GREEN}✅ Frontend está respondendo!${NC}"
else
    echo -e "${RED}❌ Frontend não está respondendo${NC}"
    echo -e "${YELLOW}📝 Verifique os logs:${NC}"
    echo "   docker compose -f docker-compose.prod.yml logs web"
    exit 1
fi

echo ""
echo -e "${GREEN}==================================="
echo "✅ Deploy concluído com sucesso!"
echo "===================================${NC}"
echo ""
echo -e "${GREEN}🌐 Aplicação disponível em:${NC}"
echo "   API: http://localhost:5000"
echo "   Frontend: http://localhost:3000"
echo ""
echo -e "${YELLOW}📝 Comandos úteis:${NC}"
echo "   Logs: docker compose -f docker-compose.prod.yml logs -f"
echo "   Parar: docker compose -f docker-compose.prod.yml down"
echo "   Restart: docker compose -f docker-compose.prod.yml restart"
