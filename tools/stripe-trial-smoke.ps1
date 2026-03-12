param(
    [string]$ApiBaseUrl = "http://localhost:5000",
    [string]$Email = "dev@ravier.app",
    [string]$Senha = "Dev@1234",
    [string]$Cpf = "52998224725",
    [string]$Plano = "Individual"
)

$ErrorActionPreference = "Stop"

Write-Host "== Stripe Trial Smoke Test ==" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl" -ForegroundColor Gray
Write-Host "Usuario: $Email" -ForegroundColor Gray

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$health = Invoke-WebRequest -UseBasicParsing -Uri "$ApiBaseUrl/health" -WebSession $session
if ($health.StatusCode -ne 200) {
    throw "API nao respondeu com 200 no endpoint /health."
}

$loginBody = @{ email = $Email; senha = $Senha } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$ApiBaseUrl/api/auth/login" -Method Post -WebSession $session -ContentType "application/json" -Body $loginBody

if (-not $login.csrfToken) {
    throw "A API nao retornou csrfToken no login."
}

$headers = @{ "X-CSRF-Token" = $login.csrfToken }

$perfilBody = @{ cpf = $Cpf } | ConvertTo-Json
$perfil = Invoke-RestMethod -Uri "$ApiBaseUrl/api/auth/perfil" -Method Put -WebSession $session -Headers $headers -ContentType "application/json" -Body $perfilBody

if (-not $perfil.temCpf) {
    throw "O perfil nao confirmou TemCpf = true apos atualizar o CPF."
}

$checkoutBody = @{ plano = $Plano } | ConvertTo-Json
$checkout = Invoke-RestMethod -Uri "$ApiBaseUrl/api/assinaturas/checkout" -Method Post -WebSession $session -Headers $headers -ContentType "application/json" -Body $checkoutBody

if (-not $checkout.url) {
    throw "A API nao retornou uma URL de checkout do Stripe."
}

Write-Host "" 
Write-Host "Smoke test concluido." -ForegroundColor Green
Write-Host "Checkout URL:" -ForegroundColor Green
Write-Host $checkout.url
Write-Host ""
Write-Host "Proximo passo: abrir a URL acima e verificar no Stripe se aparece '7 dias gratis' e a data da primeira cobranca." -ForegroundColor Yellow
Write-Host "Se for concluir o pagamento em modo teste, exponha o webhook da API para sincronizar a assinatura local." -ForegroundColor Yellow