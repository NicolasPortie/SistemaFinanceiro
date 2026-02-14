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
    # Gerar segredos aleatórios fortes automaticamente
    DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    JWT_SEC=$(openssl rand -base64 72 | tr -d '/+=' | head -c 80)
    ENCRYPT_KEY=$(openssl rand -base64 32)
    sed -i "s/CHANGE_ME_STRONG_PASSWORD/${DB_PASS}/g" .env
    sed -i "s/CHANGE_ME_JWT_SECRET_WITH_AT_LEAST_64_BYTES_FOR_HS512_ALGORITHM/${JWT_SEC}/g" .env
    echo ""
    echo "🔐 Segredos gerados automaticamente com openssl rand."
    echo "📝 Verifique o .env e adicione ENCRYPTION_KEY e INVITE_CODE_HASH manualmente."
fi

echo ""
echo "📊 Status dos containers:"
docker compose -f docker-compose.prod.yml ps 2>&1 || echo "Containers não iniciados ainda"

echo ""
echo "✅ Setup concluído! Execute: ./deploy.sh"
