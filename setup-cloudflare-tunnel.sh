#!/bin/bash
set -e

echo "=================================================="
echo "Setup Cloudflare Tunnel - ControlFinance"
echo "=================================================="

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se está rodando como root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${YELLOW}⚠️  Não execute este script como root!${NC}"
   exit 1
fi

# 1. Instalar cloudflared
echo -e "\n${GREEN}📦 Instalando cloudflared...${NC}"
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared -y

echo -e "\n${GREEN}✅ cloudflared instalado:${NC}"
cloudflared --version

# 2. Login
echo -e "\n${GREEN}🔐 Faça login no Cloudflare...${NC}"
echo -e "${YELLOW}Um link será aberto. Copie e cole no seu navegador.${NC}"
cloudflared tunnel login

# 3. Criar tunnel
echo -e "\n${GREEN}🌐 Criando tunnel...${NC}"
cloudflared tunnel create controlfinance

# 4. Listar tunnels
echo -e "\n${GREEN}📋 Lista de tunnels:${NC}"
cloudflared tunnel list

# 5. Obter tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep controlfinance | awk '{print $1}')
echo -e "\n${GREEN}🆔 Tunnel ID: ${TUNNEL_ID}${NC}"

if [ -z "$TUNNEL_ID" ]; then
    echo -e "${YELLOW}⚠️  Não foi possível detectar o Tunnel ID automaticamente.${NC}"
    echo "Execute: cloudflared tunnel list"
    exit 1
fi

# 6. Criar diretório de configuração
echo -e "\n${GREEN}📁 Criando configuração...${NC}"
sudo mkdir -p /etc/cloudflared

# 7. Solicitar domínio
echo -e "\n${YELLOW}📝 Digite seu domínio (exemplo: seudominio.com):${NC}"
read -p "Domínio: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}⚠️  Domínio não informado. Configure manualmente depois.${NC}"
    DOMAIN="seudominio.com"
fi

# 8. Criar config.yml
echo -e "\n${GREEN}📝 Criando /etc/cloudflared/config.yml...${NC}"
sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /etc/cloudflared/${TUNNEL_ID}.json

ingress:
  # API
  - hostname: api.${DOMAIN}
    service: http://localhost:5000
    originRequest:
      noTLSVerify: true
  
  # Frontend
  - hostname: app.${DOMAIN}
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
  
  # Catch-all
  - service: http_status:404
EOF

# 9. Copiar credenciais
echo -e "\n${GREEN}🔑 Copiando credenciais...${NC}"
sudo cp ~/.cloudflared/${TUNNEL_ID}.json /etc/cloudflared/

# 10. Configurar rotas DNS
echo -e "\n${GREEN}🌍 Configurando DNS...${NC}"
cloudflared tunnel route dns controlfinance api.${DOMAIN}
cloudflared tunnel route dns controlfinance app.${DOMAIN}

# 11. Testar configuração
echo -e "\n${GREEN}🧪 Testando configuração...${NC}"
sudo cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate

# 12. Instalar como serviço
echo -e "\n${GREEN}⚙️ Instalando como serviço systemd...${NC}"
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# 13. Aguardar inicialização
echo -e "\n${GREEN}⏳ Aguardando serviço iniciar...${NC}"
sleep 5

# 14. Verificar status
echo -e "\n${GREEN}📊 Status do serviço:${NC}"
sudo systemctl status cloudflared --no-pager

echo -e "\n${GREEN}=================================================="
echo "✅ Cloudflare Tunnel configurado com sucesso!"
echo "==================================================${NC}"
echo ""
echo -e "${GREEN}🌐 URLs da sua aplicação:${NC}"
echo "   API: https://api.${DOMAIN}"
echo "   Frontend: https://app.${DOMAIN}"
echo ""
echo -e "${GREEN}📝 Próximos passos:${NC}"
echo "   1. Atualize o arquivo .env com as novas URLs"
echo "   2. Reinicie os containers: docker compose -f ~/controlfinance/docker-compose.prod.yml restart"
echo "   3. Teste: curl https://api.${DOMAIN}/api/telegram/health"
echo ""
echo -e "${GREEN}🛠️ Comandos úteis:${NC}"
echo "   Ver logs: sudo journalctl -u cloudflared -f"
echo "   Status: sudo systemctl status cloudflared"
echo "   Reiniciar: sudo systemctl restart cloudflared"
echo ""
