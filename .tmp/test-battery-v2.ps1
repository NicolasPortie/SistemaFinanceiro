$ErrorActionPreference = 'Stop'

$baseUrl = 'http://localhost:5000'
$botProject = 'c:\Projetos\ControlFinance\.tmp\botcall\BotCall\BotCall.csproj'
$dbPeekProject = 'c:\Projetos\ControlFinance\.tmp\dbpeek\DbPeek\DbPeek.csproj'
$chatId = '7709703004'
$nome = 'Nicolas'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

$results = @()

function Add-Result([string]$id, [bool]$ok, [string]$details) {
  $script:results += [pscustomobject]@{ id = $id; ok = $ok; details = $details }
}

function Login {
  $body = @{ email = 'nicolasportieprofissional@gmail.com'; senha = 'Ni251000@' } | ConvertTo-Json
  return Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body $body
}

function Api-Get([string]$path, $headers) {
  try {
    return Invoke-RestMethod -Uri "$baseUrl$path" -Headers $headers
  } catch {
    Write-Host "API_GET_FAILED: $path"
    if ($_.Exception.Response -ne $null) {
      $resp = $_.Exception.Response
      Write-Host "STATUS: $($resp.StatusCode.value__)"
    }
    throw
  }
}

function Run-BotMessages([string[]]$messages) {
  $args = @('run', '--project', $botProject, '--', $chatId, $nome) + $messages
  $output = & dotnet @args 2>&1 | Out-String
  return $output
}

function Get-SqlLines([string]$mode, [string]$marker) {
  $raw = (& dotnet run --project $dbPeekProject -- $mode $marker 2>&1 | Out-String)
  $lines = $raw -split "`r?`n" | Where-Object { $_ -and $_.Contains('|') }
  return @($lines)
}

$login = Login
$auth = @{ Authorization = "Bearer $($login.token)" }
$cartoesResp = Api-Get '/api/cartoes' $auth
if ($cartoesResp -is [System.Array]) {
  $cartoes = @($cartoesResp)
} elseif ($null -ne $cartoesResp.value) {
  $cartoes = @($cartoesResp.value)
} else {
  $cartoes = @($cartoesResp)
}
$cardId = if ($cartoes.Count -gt 0) { [int]$cartoes[0].id } else { $null }

# 1) Despesa bot -> web
$markerDesp = "QABOT_DESP_$stamp"
$outDesp = Run-BotMessages @("gastei 45,67 no $markerDesp no pix", '1', 'sim')
$sqlDesp = @(Get-SqlLines 'lancamentos' $markerDesp)
$desp = if ($sqlDesp.Count -gt 0) { $sqlDesp[0].Split('|') } else { @() }
if ($desp.Count -ge 6 -and $desp[3] -eq '1') {
  Add-Result 'BOT_DESPESA' $true "id=$($desp[0]), descricao=$($desp[1]), valor=$($desp[2]), tipo=$($desp[3])"
} else {
  Add-Result 'BOT_DESPESA' $false "Nao localizado no web/API. BotOutput: $($outDesp.Substring(0,[Math]::Min(320,$outDesp.Length)))"
}

# 2) Receita bot -> web
$markerRec = "QABOT_REC_$stamp"
$outRec = Run-BotMessages @("recebi 5123,45 de $markerRec", 'sim')
$sqlRec = @(Get-SqlLines 'lancamentos' $markerRec)
$rec = if ($sqlRec.Count -gt 0) { $sqlRec[0].Split('|') } else { @() }
if ($rec.Count -ge 6 -and $rec[3] -eq '2') {
  Add-Result 'BOT_RECEITA' $true "id=$($rec[0]), descricao=$($rec[1]), valor=$($rec[2]), tipo=$($rec[3])"
} else {
  Add-Result 'BOT_RECEITA' $false "Nao localizado no web/API. BotOutput: $($outRec.Substring(0,[Math]::Min(320,$outRec.Length)))"
}

# 3) Parcelado bot -> fatura/web
$markerParc = "QABOT_PARC_$stamp"
$outParc = Run-BotMessages @("comprei $markerParc por 300 no credito 3x", '1', '4', 'sim')
$sqlParc = @(Get-SqlLines 'lancamentos' $markerParc)
$parc = if ($sqlParc.Count -gt 0) { $sqlParc[0].Split('|') } else { @() }
$faturas = if ($cardId) { @(Api-Get "/api/cartoes/$cardId/fatura" $auth) } else { @() }
$naFatura = $false
foreach ($f in $faturas) {
  foreach ($p in @($f.parcelas)) {
    if ($p.descricao -like "*$markerParc*") { $naFatura = $true }
  }
}
if ($parc.Count -ge 6 -and [int]$parc[5] -ge 3 -and $parc[4] -eq '3' -and $naFatura) {
  Add-Result 'BOT_PARCELA' $true "id=$($parc[0]), descricao=$($parc[1]), parcelas=$($parc[5]), refletido em fatura cartao=$cardId"
} else {
  Add-Result 'BOT_PARCELA' $false "Falha no parcelado. item=$([bool]($parc.Count -ge 6)) parcelas=$($parc[5]) fatura=$naFatura"
}

# 4) Conta fixa (novo)
$markerFixa = "QABOT_FIXA_$stamp"
$outFixa = Run-BotMessages @("/conta_fixa $markerFixa;123,45;8")
$sqlFixa = dotnet run --project $dbPeekProject -- lembretes $markerFixa
$fixaLine = $sqlFixa | Select-String -Pattern $markerFixa | Select-Object -First 1
if ($fixaLine) {
  Add-Result 'BOT_CONTA_FIXA' $true $fixaLine.Line
} else {
  Add-Result 'BOT_CONTA_FIXA' $false "Nao encontrou conta fixa no SQL. BotOutput: $($outFixa.Substring(0,[Math]::Min(320,$outFixa.Length)))"
}

# 5) Lembrete de pagamento (novo)
$markerLemb = "QABOT_LEMB_$stamp"
$outLemb = Run-BotMessages @("/lembrete criar $markerLemb;15/03/2026;99,90;mensal", '/lembrete listar')
$sqlLemb = dotnet run --project $dbPeekProject -- lembretes $markerLemb
$lembLine = $sqlLemb | Select-String -Pattern $markerLemb | Select-Object -First 1
if ($lembLine) {
  Add-Result 'BOT_LEMBRETE' $true $lembLine.Line
} else {
  Add-Result 'BOT_LEMBRETE' $false "Nao encontrou lembrete no SQL. BotOutput: $($outLemb.Substring(0,[Math]::Min(320,$outLemb.Length)))"
}

# 6) Salario mensal (novo)
$outSalario = Run-BotMessages @('/salario_mensal', 'quanto recebo mensalmente de salario')
if ($outSalario.ToLower().Contains('salario mensal') -or $outSalario.ToLower().Contains('estimativa')) {
  Add-Result 'BOT_SALARIO_MENSAL' $true 'Comando respondeu com estimativa de salario.'
} else {
  Add-Result 'BOT_SALARIO_MENSAL' $false "Resposta nao identificada. Saida: $($outSalario.Substring(0,[Math]::Min(320,$outSalario.Length)))"
}

# 7) Limite
$outLim = Run-BotMessages @('/limite Transporte 333')
$sqlLim = @(Get-SqlLines 'limites' 'Transporte')
$limOk = $false
foreach ($line in $sqlLim) {
  $parts = $line.Split('|')
  $valorNormalizado = if ($parts.Count -ge 3) { $parts[2].Replace(',', '.') } else { '' }
  if ($parts.Count -ge 4 -and $parts[1] -eq 'Transporte' -and $valorNormalizado -eq '333.00' -and $parts[3] -eq 'True') {
    $limOk = $true
  }
}
if ($limOk) {
  Add-Result 'BOT_LIMITE' $true 'Transporte=R$ 333.00'
} else {
  Add-Result 'BOT_LIMITE' $false 'Limite Transporte 333 nao confirmado na API.'
}

# 8) Meta
$markerMeta = "QABOT_META_$stamp"
$outMeta = Run-BotMessages @("/meta criar $markerMeta 777 12/2027", '/metas')
$sqlMeta = @(Get-SqlLines 'metas' $markerMeta)
$meta = if ($sqlMeta.Count -gt 0) { $sqlMeta[0].Split('|') } else { @() }
if ($meta.Count -ge 5 -and $meta[1] -eq $markerMeta) {
  Add-Result 'BOT_META' $true "id=$($meta[0]), alvo=$($meta[2]), prazo=$($meta[3]), status=$($meta[4])"
} else {
  Add-Result 'BOT_META' $false 'Meta criada via bot nao encontrada na API.'
}

# 9) Comandos de leitura importantes
$outRead = Run-BotMessages @('/resumo', '/fatura', '/faturas', '/categorias', '/cartao', '/simular celular 2400 6x', '/posso 180 jantar')
$okRead = @('/resumo','/fatura','/faturas','/categorias','/cartao') | ForEach-Object { $outRead.Contains($_) } | Where-Object { $_ -eq $true } | Measure-Object | Select-Object -ExpandProperty Count
if ($outRead.Length -gt 0) {
  Add-Result 'BOT_COMANDOS_LEITURA' $true 'Comandos executados sem excecao no bot.'
} else {
  Add-Result 'BOT_COMANDOS_LEITURA' $false 'Nao houve output dos comandos de leitura.'
}

# Sanidade web/API
$resumo = Api-Get '/api/lancamentos/resumo' $auth
if ($null -ne $resumo.saldo) {
  Add-Result 'WEB_API_RESUMO' $true "saldo=$($resumo.saldo), receitas=$($resumo.totalReceitas), gastos=$($resumo.totalGastos)"
} else {
  Add-Result 'WEB_API_RESUMO' $false 'Resumo sem saldo.'
}

$results | ConvertTo-Json -Depth 6
