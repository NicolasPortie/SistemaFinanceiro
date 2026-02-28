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

# Determinar versão a partir da tag git (ex: v1.27.2 → 1.27.2)
$gitTag = git describe --tags --exact-match HEAD 2>$null
if ($gitTag -and $gitTag -match '^v(.+)$') {
    $appVersion = $Matches[1]
} else {
    $appVersion = git describe --tags --always 2>$null
    if (-not $appVersion) { $appVersion = "0.0.0-dev" }
}
Write-Host "🏷️  Versão detectada: $appVersion" -ForegroundColor Cyan
$env:APP_VERSION = $appVersion

# Parar containers antigos
Write-Host "⏸️  Parando containers antigos..." -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml down

# Build das novas imagens (com cache - só rebuilda o que mudou)
Write-Host "🔨 Construindo novas imagens (versão: $appVersion)..." -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml build --build-arg VERSION=$appVersion

# Iniciar containers
Write-Host "🚀 Iniciando containers..." -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml up -d

# Aguardar API ficar saudável (healthcheck real, máx 120s)
Write-Host "⏳ Aguardando containers ficarem saudáveis..." -ForegroundColor Yellow
$maxWait = 120
$elapsed = 0
do {
    Start-Sleep -Seconds 5
    $elapsed += 5
    $apiStatus = docker inspect --format="{{.State.Health.Status}}" controlfinance-api-prod 2>$null
    Write-Host "   [$elapsed s] API: $apiStatus" -ForegroundColor Gray
} while ($apiStatus -ne "healthy" -and $elapsed -lt $maxWait)

if ($apiStatus -ne "healthy") {
    Write-Host "❌ API não ficou saudável em ${maxWait}s" -ForegroundColor Red
    docker compose -f docker-compose.prod.yml logs api --tail=50
    exit 1
}

# Limpar imagens antigas/dangling (depois do build, para não destruir cache)
Write-Host "🧹 Limpando imagens antigas..." -ForegroundColor Yellow
docker image prune -f

# Verificar status
Write-Host "📊 Status dos containers:" -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml ps

# Verificar saúde da API
Write-Host "🏥 Verificando saúde da API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 10 -ErrorAction Stop
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
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 10 -ErrorAction Stop
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
