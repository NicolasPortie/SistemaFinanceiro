# Configuração Cloudflare Tunnel - ControlFinance

Este guia explica como configurar o Cloudflare Tunnel para expor sua aplicação de forma segura sem abrir portas no firewall.

## 📋 Pré-requisitos

- Conta no Cloudflare (gratuita)
- Domínio configurado no Cloudflare
- Aplicação rodando no servidor Linux

## 🚀 Instalação do cloudflared no Linux

### 1. Conectar no servidor

```bash
ssh nicolas@192.168.15.2
```

### 2. Instalar cloudflared

```bash
# Adicionar repositório GPG
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

# Adicionar repositório apt
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Instalar
sudo apt update && sudo apt install cloudflared -y

# Verificar instalação
cloudflared --version
```

## 🔐 Autenticação

### 1. Fazer login no Cloudflare

```bash
cloudflared tunnel login
```

Isso abrirá um link no navegador. Acesse-o e autorize o cloudflared.

**Nota:** Se o servidor não tiver interface gráfica, copie o link e abra no seu navegador Windows.

## 🌐 Criar e Configurar o Tunnel

### 1. Criar o tunnel

```bash
cloudflared tunnel create controlfinance
```

Isso criará um arquivo de credenciais em `~/.cloudflared/`

### 2. Listar tunnels

```bash
cloudflared tunnel list
```

Anote o **Tunnel ID** (algo como: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 3. Criar arquivo de configuração

```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Cole este conteúdo (ajuste o `tunnel ID` e `credentials-file`):

```yaml
tunnel: COLE_SEU_TUNNEL_ID_AQUI
credentials-file: /home/nicolas/.cloudflared/COLE_SEU_TUNNEL_ID_AQUI.json

ingress:
  # Redirecionar API
  - hostname: api.seudominio.com
    service: http://localhost:5000
    originRequest:
      noTLSVerify: true
  
  # Redirecionar Frontend
  - hostname: app.seudominio.com
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
  
  # Catch-all (obrigatório)
  - service: http_status:404
```

**Importante:** Substitua:
- `COLE_SEU_TUNNEL_ID_AQUI` pelo ID do seu tunnel
- `seudominio.com` pelo seu domínio real

### 4. Copiar arquivo de credenciais

```bash
sudo cp ~/.cloudflared/*.json /etc/cloudflared/
```

## 🔗 Configurar DNS no Cloudflare

### Opção 1: Via Dashboard (Recomendado)

1. Acesse: https://dash.cloudflare.com
2. Selecione seu domínio
3. Vá em **Traffic** → **Cloudflare Tunnel**
4. Selecione seu tunnel **controlfinance**
5. Clique em **Configure**
6. Na seção **Public Hostname**, adicione:

   **Para API:**
   - Subdomain: `api`
   - Domain: `seudominio.com`
   - Service Type: `HTTP`
   - URL: `localhost:5000`

   **Para Frontend:**
   - Subdomain: `app`
   - Domain: `seudominio.com`
   - Service Type: `HTTP`
   - URL: `localhost:3000`

### Opção 2: Via CLI

```bash
# Criar rota DNS para API
cloudflared tunnel route dns controlfinance api.seudominio.com

# Criar rota DNS para Frontend
cloudflared tunnel route dns controlfinance app.seudominio.com
```

## 🏃 Iniciar o Tunnel

### Teste Manual

```bash
sudo cloudflared tunnel run controlfinance
```

Se tudo estiver OK, você verá logs indicando que o tunnel está conectado.

Teste acessando: https://api.seudominio.com/api/telegram/health

### Instalar como Serviço (Modo Produção)

```bash
# Instalar serviço
sudo cloudflared service install

# Iniciar serviço
sudo systemctl start cloudflared

# Habilitar inicialização automática
sudo systemctl enable cloudflared

# Verificar status
sudo systemctl status cloudflared

# Ver logs
sudo journalctl -u cloudflared -f
```

## ✅ Verificação Final

### 1. Verificar status do tunnel

```bash
sudo systemctl status cloudflared
```

### 2. Testar endpoints

```bash
# API
curl https://api.seudominio.com/api/telegram/health

# Frontend
curl -I https://app.seudominio.com
```

### 3. No navegador

- API: `https://api.seudominio.com/api/telegram/health`
- Frontend: `https://app.seudominio.com`

## 🔧 Configurar Variáveis de Ambiente

Após o tunnel estar funcionando, atualize o arquivo `.env` no servidor:

```bash
cd ~/controlfinance
nano .env
```

Atualize as URLs:

```env
# Frontend
NEXT_PUBLIC_API_URL=https://api.seudominio.com

# Telegram (se usar)
TELEGRAM_WEBHOOK_URL=https://api.seudominio.com/api/telegram/webhook
```

Reinicie os containers:

```bash
docker compose -f docker-compose.prod.yml restart
```

## 🛠️ Comandos Úteis

```bash
# Ver lista de tunnels
cloudflared tunnel list

# Ver rotas DNS
cloudflared tunnel route dns

# Parar serviço
sudo systemctl stop cloudflared

# Reiniciar serviço
sudo systemctl restart cloudflared

# Ver logs em tempo real
sudo journalctl -u cloudflared -f

# Remover tunnel (CUIDADO!)
cloudflared tunnel delete controlfinance
```

## 🔒 Segurança Adicional (Opcional)

### 1. Configurar Cloudflare Access

Para adicionar autenticação adicional:

1. Acesse: https://dash.cloudflare.com
2. Vá em **Zero Trust** → **Access** → **Applications**
3. Crie uma política de acesso para controlar quem pode acessar
4. Adicione regras (email, IP, etc.)

### 2. Rate Limiting

1. No Cloudflare Dashboard
2. Vá em **Security** → **WAF**
3. Configure regras de rate limiting para proteger contra abusos

## 📊 Monitoramento

### Ver métricas do tunnel

```bash
# No navegador
https://dash.cloudflare.com → Traffic → Analytics
```

### Logs locais

```bash
sudo journalctl -u cloudflared --since "1 hour ago"
```

## 🐛 Troubleshooting

### Tunnel não conecta

```bash
# Verificar se o serviço está rodando
sudo systemctl status cloudflared

# Verificar logs
sudo journalctl -u cloudflared -n 50

# Reiniciar
sudo systemctl restart cloudflared
```

### DNS não resolve

- Aguarde 1-2 minutos para propagação do DNS
- Verifique no painel do Cloudflare se as entradas DNS foram criadas
- Certifique-se de que o proxy (nuvem laranja) está ativado

### Erro 502/504

- Verifique se os containers estão rodando: `docker compose -f ~/controlfinance/docker-compose.prod.yml ps`
- Verifique os logs da API: `docker logs controlfinance-api-prod`
- Verifique se as portas estão corretas no config.yml

## 📝 Resumo da Configuração

```
Internet
    ↓
Cloudflare Tunnel (HTTPS)
    ↓
Servidor Linux (192.168.15.2)
    ├── API (http://localhost:5000)
    └── Frontend (http://localhost:3000)
```

**URLs Públicas:**
- API: `https://api.seudominio.com`
- Frontend: `https://app.seudominio.com`

**Vantagens:**
- ✅ HTTPS automático (certificado SSL do Cloudflare)
- ✅ Sem necessidade de abrir portas no firewall
- ✅ DDoS protection automático
- ✅ CDN global do Cloudflare
- ✅ Analytics e logs
- ✅ Túnel criptografado

---

## 🎯 Próximos Passos

1. ✅ Instalar cloudflared
2. ✅ Criar tunnel
3. ✅ Configurar DNS
4. ✅ Testar endpoints
5. ✅ Configurar serviço systemd
6. ✅ Atualizar variáveis de ambiente
7. ✅ Configurar webhook do Telegram (se aplicável)
