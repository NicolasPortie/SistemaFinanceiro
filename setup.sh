#!/bin/bash
set -e

echo "======================================"
echo "Setup ControlFinance - Servidor Linux"
echo "======================================"

cd ~/controlfinance

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "⚠️  Arquivo .env não encontrado!"
    echo "Criando .env baseado em .env.prod.example..."
    cp .env.prod.example .env
    echo ""
    echo "⚠️  IMPORTANTE: Configure as variáveis no arquivo .env"
    sed -i 's/CHANGE_ME_STRONG_PASSWORD/Seu567890!DevLinux/g' .env
    sed -i 's/CHANGE_ME_JWT_SECRET_WITH_AT_LEAST_64_BYTES_FOR_HS512_ALGORITHM/JwtSecretWithAtLeast64BytesForHS512Algorithm2026ControlFinance/g' .env
fi

echo ""
echo "📊 Status dos containers:"
docker compose -f docker-compose.prod.yml ps 2>&1 || echo "Containers não iniciados ainda"

echo ""
echo "✅ Setup concluído! Execute: ./deploy.sh"
