# Configuração de CI/CD - ControlFinance

Este documento explica como configurar o CI/CD para deploy automático no servidor Linux.

## 📋 Pré-requisitos

### No Servidor Linux (192.168.15.2)

1. **Docker e Docker Compose**
2. **Git** (opcional, para deploy manual)
3. **Acesso SSH** configurado

## 🔧 Configuração do Servidor Linux

### 1. Instalar Docker e Docker Compose

```bash
# Conectar no servidor
ssh nicolas@192.168.15.2

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Verificar instalação
docker --version
docker compose version

# Logout e login novamente para aplicar permissões
exit
```

### 2. Criar Estrutura de Diretórios

```bash
ssh nicolas@192.168.15.2

# Criar diretório do projeto
mkdir -p ~/controlfinance

# Criar arquivo .env
cd ~/controlfinance
nano .env
```

Configure as variáveis de ambiente (veja `.env.prod.example`):

```env
# Banco de Dados
POSTGRES_DB=controlfinance
POSTGRES_USER=cf_user
POSTGRES_PASSWORD=SuaSenhaForte123!

# JWT (gere uma chave segura)
JWT_SECRET=SuaChaveJWTMuitoSeguraComPeloMenos64BytesParaHS512

# Telegram
TELEGRAM_BOT_TOKEN=seu_token_do_bot
TELEGRAM_WEBHOOK_URL=https://seu-dominio.com/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=seu_secret_token

# IA
GEMINI_API_KEY=sua_chave_gemini
GROQ_API_KEY=sua_chave_groq

# Frontend
NEXT_PUBLIC_API_URL=http://seu-servidor:5000
```

## 🔑 Configurar GitHub Secrets

### 1. Gerar Chave SSH (no seu Windows)

```powershell
# Gerar par de chaves SSH
ssh-keygen -t ed25519 -C "github-actions-controlfinance" -f controlfinance-deploy

# Isso criará:
# - controlfinance-deploy (chave privada)
# - controlfinance-deploy.pub (chave pública)
```

### 2. Adicionar Chave Pública ao Servidor

```bash
# Copiar conteúdo da chave pública
Get-Content controlfinance-deploy.pub | clip

# No servidor Linux
ssh nicolas@192.168.15.2
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
# Colar a chave pública e salvar
chmod 600 ~/.ssh/authorized_keys
```

### 3. Configurar Secrets no GitHub

Vá em: `https://github.com/NicolasPortie/SistemaFinanceiro/settings/secrets/actions`

Adicione os seguintes secrets:

| Secret Name | Valor |
|------------|-------|
| `SSH_PRIVATE_KEY` | Conteúdo do arquivo `controlfinance-deploy` (chave privada completa) |
| `SSH_USER` | `nicolas` |
| `SERVER_HOST` | `192.168.15.2` |

## 🚀 Deploy

### Deploy Automático (CI/CD)

Sempre que você fizer push para `main`, o GitHub Actions irá:

1. ✅ Executar build e testes
2. 🚀 Fazer deploy automático no servidor Linux
3. ✅ Verificar saúde da aplicação

```bash
git add .
git commit -m "Minha alteração"
git push origin main
```

### Deploy Manual

#### No Linux (Direto no Servidor)

```bash
ssh nicolas@192.168.15.2
cd ~/controlfinance

# Puxar últimas alterações (se tiver clonado o repo)
git pull origin main

# Ou copiar arquivos manualmente via rsync do Windows:
# rsync -avz --exclude='.git' . nicolas@192.168.15.2:~/controlfinance/

# Executar deploy
chmod +x deploy.sh
./deploy.sh
```

#### No Windows (Deploy Remoto)

```powershell
# Deploy manual via SSH do Windows
ssh nicolas@192.168.15.2 "cd ~/controlfinance && ./deploy.sh"
```

## 📊 Monitoramento

### Verificar Status dos Containers

```bash
ssh nicolas@192.168.15.2
cd ~/controlfinance
docker compose -f docker-compose.prod.yml ps
```

### Ver Logs

```bash
# Todos os serviços
docker compose -f docker-compose.prod.yml logs -f

# Apenas API
docker compose -f docker-compose.prod.yml logs -f api

# Apenas Frontend
docker compose -f docker-compose.prod.yml logs -f web

# Apenas Banco
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Restart de Serviços

```bash
# Restart completo
docker compose -f docker-compose.prod.yml restart

# Restart apenas API
docker compose -f docker-compose.prod.yml restart api
```

## 🔒 Segurança

### Configurar Firewall (UFW)

```bash
sudo apt install ufw -y

# Permitir SSH
sudo ufw allow 22/tcp

# Permitir portas da aplicação
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 5000/tcp  # API

# Ativar firewall
sudo ufw enable
sudo ufw status
```

### Configurar HTTPS com Nginx Reverse Proxy (Opcional)

Se quiser expor com domínio público:

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

# Configurar Nginx
sudo nano /etc/nginx/sites-available/controlfinance

# Obter certificado SSL
sudo certbot --nginx -d seu-dominio.com
```

## 🛠️ Comandos Úteis

```bash
# Parar todos os containers
docker compose -f docker-compose.prod.yml down

# Rebuild completo
docker compose -f docker-compose.prod.yml up -d --build --force-recreate

# Limpar tudo (CUIDADO: apaga volumes/dados)
docker compose -f docker-compose.prod.yml down -v

# Ver uso de recursos
docker stats

# Backup do banco
docker exec controlfinance-db-prod pg_dump -U cf_user controlfinance > backup.sql
```

## 🐛 Troubleshooting

### API não está respondendo

```bash
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml restart api
```

### Banco não conecta

```bash
docker compose -f docker-compose.prod.yml logs postgres
# Verificar se as credenciais no .env estão corretas
```

### Erro de memória

```bash
# Verificar uso de recursos
docker stats
# Adicionar limite de memória no docker-compose.prod.yml se necessário
```

## 📁 Estrutura no Servidor

```
~/controlfinance/
├── .env                           # Variáveis de ambiente (não comitar!)
├── docker-compose.prod.yml        # Configuração Docker Compose
├── deploy.sh                      # Script de deploy
├── src/                           # Código fonte da API
├── web-next/                      # Código fonte do Frontend
└── ...
```

## ✅ Checklist de Deploy

- [ ] Docker e Docker Compose instalados no servidor
- [ ] Arquivo `.env` configurado no servidor
- [ ] SSH configurado (chave pública no servidor)
- [ ] Secrets configurados no GitHub
- [ ] Firewall configurado
- [ ] Primeira execução do `deploy.sh` bem-sucedida
- [ ] API respondendo em http://192.168.15.2:5000
- [ ] Frontend respondendo em http://192.168.15.2:3000
- [ ] Webhook do Telegram configurado (se aplicável)

## 🎯 Fluxo de Trabalho

1. **Desenvolvimento** (Windows)
   - Desenvolver e testar localmente
   - Commit e push para `main`

2. **CI/CD** (GitHub Actions)
   - Build automático
   - Testes automáticos
   - Deploy automático no Linux

3. **Produção** (Linux/Docker)
   - Aplicação rodando em containers
   - Logs e monitoramento disponíveis
   - Backup regular do banco de dados
