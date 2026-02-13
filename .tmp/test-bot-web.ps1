$ErrorActionPreference = 'Stop'

$baseUrl = 'http://localhost:5000'
$chatId = 7709703004
$secret = 'cf_webhook_secret_2026_dev'
$updateId = 920000
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

$results = @()

function Add-Result([string]$id, [bool]$ok, [string]$details) {
  $script:results += [pscustomobject]@{
    id = $id
    ok = $ok
    details = $details
  }
}

function Login {
  $body = @{ email = 'nicolasportieprofissional@gmail.com'; senha = 'Ni251000@' } | ConvertTo-Json
  return Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body $body
}

function Api-Get($path, $headers) {
  return Invoke-RestMethod -Uri "$baseUrl$path" -Headers $headers
}

function Send-Tg([string]$text) {
  $script:updateId++
  $payload = @{
    update_id = $script:updateId
    message = @{
      message_id = $script:updateId
      date = [int][double]::Parse((Get-Date -UFormat %s))
      chat = @{ id = $chatId; type = 'private'; first_name = 'Nicolas' }
      from = @{ id = $chatId; is_bot = $false; first_name = 'Nicolas'; username = 'nicolas' }
      text = $text
    }
  } | ConvertTo-Json -Depth 8

  $headers = @{ 'X-Telegram-Bot-Api-Secret-Token' = $secret }
  $resp = Invoke-WebRequest -Uri "$baseUrl/api/telegram/webhook" -Method Post -Headers $headers -ContentType 'application/json' -Body $payload -UseBasicParsing
  Start-Sleep -Milliseconds 650
  return $resp.StatusCode
}

function Find-Lancamento($headers, [string]$marker) {
  $encoded = [System.Uri]::EscapeDataString($marker)
  $resp = Api-Get "/api/lancamentos?busca=$encoded&tamanhoPagina=200" $headers
  return @($resp.items)
}

function Wait-Lancamento($headers, [string]$marker, [int]$tries = 12) {
  for ($i = 0; $i -lt $tries; $i++) {
    $items = Find-Lancamento $headers $marker
    if ($items.Count -gt 0) { return $items }
    Start-Sleep -Milliseconds 800
  }
  return @()
}

$login = Login
$auth = @{ Authorization = "Bearer $($login.token)" }

$cartoes = @(Api-Get '/api/cartoes' $auth)
$cardId = if ($cartoes.Count -gt 0) { $cartoes[0].id } else { $null }

# 1) Despesa via bot
$markerDesp = "QA_BOT_DESPESA_$stamp"
Send-Tg "gastei 45,67 com $markerDesp no pix" | Out-Null
Send-Tg "sim" | Out-Null
$desp = Wait-Lancamento $auth $markerDesp
$despItem = $desp | Where-Object { $_.descricao -like "*$markerDesp*" } | Select-Object -First 1
if ($despItem) {
  Add-Result 'B-DESPESA' $true "Lancamento id=$($despItem.id) tipo=$($despItem.tipo) valor=$($despItem.valor)"
} else {
  Add-Result 'B-DESPESA' $false 'Nao encontrou lancamento de despesa com marcador.'
}

# 2) Receita via bot
$markerRec = "QA_BOT_RECEITA_$stamp"
Send-Tg "recebi 5321,10 de salario $markerRec" | Out-Null
Send-Tg "sim" | Out-Null
$rec = Wait-Lancamento $auth $markerRec
$recItem = $rec | Where-Object { $_.descricao -like "*$markerRec*" } | Select-Object -First 1
if ($recItem) {
  Add-Result 'B-RECEITA' $true "Lancamento id=$($recItem.id) tipo=$($recItem.tipo) valor=$($recItem.valor)"
} else {
  Add-Result 'B-RECEITA' $false 'Nao encontrou lancamento de receita com marcador.'
}

# 3) Parcela via bot
$markerParc = "QA_BOT_PARCELA_$stamp"
$beforeFaturas = if ($cardId) { @(Api-Get "/api/cartoes/$cardId/fatura" $auth) } else { @() }
Send-Tg "comprei $markerParc por 300 no credito 3x" | Out-Null
Send-Tg "1" | Out-Null
Send-Tg "sim" | Out-Null
$parc = Wait-Lancamento $auth $markerParc
$parcItem = $parc | Where-Object { $_.descricao -like "*$markerParc*" } | Select-Object -First 1
$afterFaturas = if ($cardId) { @(Api-Get "/api/cartoes/$cardId/fatura" $auth) } else { @() }
$parcelaNaFatura = $false
foreach ($f in $afterFaturas) {
  foreach ($p in @($f.parcelas)) {
    if ($p.descricao -like "*$markerParc*") { $parcelaNaFatura = $true }
  }
}
if ($parcItem -and $parcItem.numeroParcelas -ge 3 -and $parcelaNaFatura) {
  Add-Result 'B-PARCELA' $true "Lancamento id=$($parcItem.id) parcelas=$($parcItem.numeroParcelas) refletido em fatura cartao=$cardId"
} else {
  Add-Result 'B-PARCELA' $false "Falha em validar parcelamento. item_encontrado=$([bool]$parcItem) parcelas=$($parcItem.numeroParcelas) na_fatura=$parcelaNaFatura"
}

# 4) Limite via bot
Send-Tg '/limite Transporte 333' | Out-Null
Start-Sleep -Milliseconds 900
$limites = @(Api-Get '/api/limites' $auth)
$limTransporte = $limites | Where-Object { $_.categoriaNome -eq 'Transporte' } | Select-Object -First 1
if ($limTransporte -and [decimal]$limTransporte.valorLimite -eq [decimal]333) {
  Add-Result 'B-LIMITE' $true "Transporte=R$ $($limTransporte.valorLimite)"
} else {
  Add-Result 'B-LIMITE' $false 'Limite de Transporte 333 nao confirmado.'
}

# 5) Meta via bot
$markerMeta = "QA_META_$stamp"
Send-Tg "/meta criar $markerMeta 777 12/2027" | Out-Null
Start-Sleep -Milliseconds 1000
$metas = @(Api-Get '/api/metas' $auth)
$meta = $metas | Where-Object { $_.nome -eq $markerMeta } | Select-Object -First 1
if ($meta) {
  Add-Result 'B-META' $true "Meta id=$($meta.id) nome=$($meta.nome) alvo=$($meta.valorAlvo) prazo=$($meta.prazo)"
} else {
  Add-Result 'B-META' $false 'Meta criada via bot nao encontrada na API.'
}

# 6) Conta fixa via bot
$markerFixa = "QA_FIXA_$stamp"
Send-Tg "/conta_fixa $markerFixa;123,45;8" | Out-Null
Start-Sleep -Milliseconds 700
$dbFixa = dotnet run --project c:\Projetos\ControlFinance\.tmp\dbpeek\DbPeek\DbPeek.csproj -- lembretes $markerFixa
$dbFixaMatch = $dbFixa | Select-String -Pattern $markerFixa
if ($dbFixaMatch) {
  Add-Result 'B-CONTA_FIXA' $true "Registro SQL: $($dbFixaMatch.Line)"
} else {
  Add-Result 'B-CONTA_FIXA' $false 'Conta fixa nao encontrada na tabela lembretes_pagamento.'
}

# 7) Lembrete via bot
$markerLembrete = "QA_LEMBRETE_$stamp"
Send-Tg "/lembrete criar $markerLembrete;15/03/2026;99,90;mensal" | Out-Null
Start-Sleep -Milliseconds 700
$dbLembrete = dotnet run --project c:\Projetos\ControlFinance\.tmp\dbpeek\DbPeek\DbPeek.csproj -- lembretes $markerLembrete
$dbLembreteMatch = $dbLembrete | Select-String -Pattern $markerLembrete
if ($dbLembreteMatch) {
  Add-Result 'B-LEMBRETE' $true "Registro SQL: $($dbLembreteMatch.Line)"
} else {
  Add-Result 'B-LEMBRETE' $false 'Lembrete nao encontrado na tabela lembretes_pagamento.'
}

# 8) Salario mensal via bot (execucao de comando)
$salCmd = Send-Tg '/salario_mensal'
$salNatural = Send-Tg 'quanto recebo mensalmente de salario?'
if ($salCmd -eq 200 -and $salNatural -eq 200) {
  Add-Result 'B-SALARIO_MENSAL' $true 'Comando e frase natural aceitos pelo webhook (200).'
} else {
  Add-Result 'B-SALARIO_MENSAL' $false "Status comando=$salCmd natural=$salNatural"
}

# 9) Web/API sanidade apos bateria
$resumo = Api-Get '/api/lancamentos/resumo' $auth
if ($null -ne $resumo.saldo) {
  Add-Result 'WEB-RESUMO' $true "Resumo OK: saldo=$($resumo.saldo) receitas=$($resumo.totalReceitas) gastos=$($resumo.totalGastos)"
} else {
  Add-Result 'WEB-RESUMO' $false 'Resumo nao retornou saldo.'
}

$results | ConvertTo-Json -Depth 6
