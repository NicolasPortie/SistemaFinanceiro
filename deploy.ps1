# Deploy ControlFinance - Produção (Windows)

$ErrorActionPreference = "Stop"

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Deploy ControlFinance - Produção" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Verificar se o arquivo .env existe
if (-not (Test-Path .env)) {
    Write-Host "❌ Arquivo .env não encontrado!" -ForegroundColor Red
    Write-Host "📝 Copie o .env.prod.example e configure:" -ForegroundColor Yellow
    Write-Host "   Copy-Item .env.prod.example .env"
    Write-Host "   notepad .env"
    exit 1
}

# Verificar se Docker está instalado
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker não está instalado" -ForegroundColor Red
    exit 1
}

# Parar containers antigos
Write-Host "⏸️  Parando containers antigos..." -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml down

# Limpar imagens antigas
Write-Host "🧹 Limpando imagens antigas..." -ForegroundColor Yellow
docker image prune -f

# Build das novas imagens
Write-Host "🔨 Construindo novas imagens..." -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml build --no-cache

# Iniciar containers
Write-Host "🚀 Iniciando containers..." -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml up -d

# Aguardar inicialização
Write-Host "⏳ Aguardando inicialização (30s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Verificar status
Write-Host "📊 Status dos containers:" -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml ps

# Verificar saúde da API
Write-Host "🏥 Verificando saúde da API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/telegram/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ API está respondendo!" -ForegroundColor Green
} catch {
    Write-Host "❌ API não está respondendo" -ForegroundColor Red
    Write-Host "📝 Verifique os logs:" -ForegroundColor Yellow
    Write-Host "   docker compose -f docker-compose.prod.yml logs api"
    exit 1
}

# Verificar saúde do Web
Write-Host "🏥 Verificando saúde do Frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Frontend está respondendo!" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend não está respondendo" -ForegroundColor Red
    Write-Host "📝 Verifique os logs:" -ForegroundColor Yellow
    Write-Host "   docker compose -f docker-compose.prod.yml logs web"
    exit 1
}

Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host "✅ Deploy concluído com sucesso!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Aplicação disponível em:" -ForegroundColor Green
Write-Host "   API: http://localhost:5000"
Write-Host "   Frontend: http://localhost:3000"
Write-Host ""
Write-Host "📝 Comandos úteis:" -ForegroundColor Yellow
Write-Host "   Logs: docker compose -f docker-compose.prod.yml logs -f"
Write-Host "   Parar: docker compose -f docker-compose.prod.yml down"
Write-Host "   Restart: docker compose -f docker-compose.prod.yml restart"
