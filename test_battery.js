// Bateria Mestra de Testes - API Smoke + Business Logic
// Testa os endpoints principais e valida regras de negócio

const http = require('http');

const BASE = 'http://localhost:5000';
let TOKEN = '';
let results = [];
let userId = 6;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function test(id, name, passed, detail = '') {
  const status = passed ? 'PASSOU' : 'FALHOU';
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${id}: ${name} - ${status}${detail ? ' | ' + detail : ''}`);
  results.push({ id, name, status, detail });
}

async function run() {
  console.log('========================================');
  console.log('  BATERIA MESTRA DE TESTES - API');
  console.log('  ' + new Date().toISOString());
  console.log('========================================\n');

  // ========== PRE-FLIGHT ==========
  console.log('--- PRE-FLIGHT ---');
  
  // Health check
  const health = await request('GET', '/health');
  test('SMK-001', 'Health check', health.status === 200,
    `status=${health.status}, body=${JSON.stringify(health.data).substring(0, 80)}`);

  // Telegram health
  const tgHealth = await request('GET', '/api/telegram/health');
  test('SMK-002', 'Telegram health', tgHealth.status === 200,
    `status=${tgHealth.status}`);

  // ========== AUTH ==========
  console.log('\n--- WEB-AUTH ---');

  // Login válido
  const login = await request('POST', '/api/auth/login', { email: 'test@test.com', senha: 'Test@123' });
  test('WEB-AUTH-001', 'Login válido', login.status === 200 && !!login.data?.token,
    `status=${login.status}, hasToken=${!!login.data?.token}`);
  TOKEN = login.data?.token || '';

  // Login com senha inválida
  const badPwd = await request('POST', '/api/auth/login', { email: 'test@test.com', senha: 'WrongPassword1!' });
  test('WEB-AUTH-002', 'Login senha inválida', badPwd.status === 401,
    `status=${badPwd.status}`);

  // Login com email inexistente
  const badEmail = await request('POST', '/api/auth/login', { email: 'naoexiste@test.com', senha: 'Test@123' });
  test('WEB-AUTH-003', 'Login email inexistente', badEmail.status === 401,
    `status=${badEmail.status}`);

  // Registro com convite inválido
  const badInvite = await request('POST', '/api/auth/registrar', {
    nome: 'Test', email: 'reg_test@test.com', senha: 'Test@123!', codigoConvite: 'invalido'
  });
  test('WEB-AUTH-005', 'Registro convite inválido', badInvite.status === 400 || (badInvite.data?.erro || '').includes('convite'),
    `status=${badInvite.status}, body=${JSON.stringify(badInvite.data).substring(0, 100)}`);

  // Perfil
  const perfil = await request('GET', '/api/auth/perfil', null, TOKEN);
  test('WEB-AUTH-PERFIL', 'Perfil autenticado', perfil.status === 200 && !!perfil.data?.nome,
    `status=${perfil.status}, nome=${perfil.data?.nome}`);

  // Rota sem token
  const noToken = await request('GET', '/api/lancamentos', null);
  test('WEB-AUTH-017', 'Rota privada sem token', noToken.status === 401,
    `status=${noToken.status}`);

  // ========== CATEGORIAS ==========
  console.log('\n--- CATEGORIAS ---');

  const cats = await request('GET', '/api/categorias', null, TOKEN);
  test('CAT-001', 'Listar categorias', cats.status === 200 && Array.isArray(cats.data),
    `status=${cats.status}, count=${cats.data?.length}`);

  // Verificar categorias de receita e gasto estão presentes
  const catNames = (cats.data || []).map(c => c.nome);
  const hasSalario = catNames.includes('Salário');
  const hasRendaExtra = catNames.includes('Renda Extra');
  const hasAlimentacao = catNames.includes('Alimentação');
  test('CAT-002', 'Categorias receita presentes', hasSalario && hasRendaExtra,
    `Salário=${hasSalario}, Renda Extra=${hasRendaExtra}`);
  test('CAT-003', 'Categorias gasto presentes', hasAlimentacao,
    `Alimentação=${hasAlimentacao}`);

  // ========== LANÇAMENTOS ==========
  console.log('\n--- LANÇAMENTOS ---');

  const STAMP = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15);

  // Criar lançamento gasto
  const gasto = await request('POST', '/api/lancamentos', {
    descricao: `TESTE_GASTO_${STAMP}`,
    valor: 150.50,
    tipo: 1, // Gasto
    categoria: 'Alimentação',
    data: new Date().toISOString().split('T')[0],
    formaPagamento: 1
  }, TOKEN);
  test('LANC-001', 'Criar lançamento gasto', gasto.status === 200 || gasto.status === 201,
    `status=${gasto.status}, data=${JSON.stringify(gasto.data).substring(0, 150)}`);
  const gastoId = gasto.data?.id || gasto.data?.lancamento?.id;

  // Criar lançamento receita
  const receita = await request('POST', '/api/lancamentos', {
    descricao: `TESTE_RECEITA_${STAMP}`,
    valor: 5000,
    tipo: 2, // Receita
    categoria: 'Salário',
    data: new Date().toISOString().split('T')[0],
    formaPagamento: 1
  }, TOKEN);
  test('LANC-002', 'Criar lançamento receita', receita.status === 200 || receita.status === 201,
    `status=${receita.status}, data=${JSON.stringify(receita.data).substring(0, 150)}`);
  const receitaId = receita.data?.id || receita.data?.lancamento?.id;

  // *** TESTE CRÍTICO: Gasto com categoria de receita ***
  const gastoRevCat = await request('POST', '/api/lancamentos', {
    descricao: `TESTE_GASTO_CATREV_${STAMP}`,
    valor: 100,
    tipo: 1, // Gasto
    categoria: 'Renda Extra', // Tentando criar gasto com categoria receita
    data: new Date().toISOString().split('T')[0],
    formaPagamento: 1
  }, TOKEN);
  test('LANC-003-CRITICO', 'Gasto com categoria receita reclassifica', 
    (gastoRevCat.status === 200 || gastoRevCat.status === 201),
    `status=${gastoRevCat.status}, data=${JSON.stringify(gastoRevCat.data).substring(0, 200)}`);

  // Verificar que a categoria foi reclassificada para "Outros"
  const catRetornada = gastoRevCat.data?.categoria;
  test('LANC-003b-CRITICO', 'Categoria reclassificada para Outros',
    catRetornada === 'Outros',
    `categoria retornada="${catRetornada}"`);
  const gastoRevCatId = gastoRevCat.data?.id;

  // Listar lançamentos
  const lancList = await request('GET', '/api/lancamentos', null, TOKEN);
  test('LANC-004', 'Listar lançamentos', lancList.status === 200,
    `status=${lancList.status}, count=${Array.isArray(lancList.data) ? lancList.data.length : 'N/A'}`);

  // Get lançamento individual
  if (gastoId) {
    const lancGet = await request('GET', `/api/lancamentos/${gastoId}`, null, TOKEN);
    test('LANC-005', 'Buscar lançamento por ID', lancGet.status === 200,
      `status=${lancGet.status}`);
  }

  // ========== RESUMO ==========
  console.log('\n--- RESUMO (TESTE CRÍTICO: SEPARAÇÃO RECEITA/GASTO) ---');

  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;
  const resumo = await request('GET', `/api/lancamentos/resumo?mes=${mesStr}`, null, TOKEN);
  test('RESUMO-001', 'Obter resumo mensal', resumo.status === 200,
    `status=${resumo.status}`);

  if (resumo.status === 200 && resumo.data) {
    const r = resumo.data;
    test('RESUMO-002', 'Resumo tem totalGastos', r.totalGastos !== undefined,
      `totalGastos=${r.totalGastos}`);
    test('RESUMO-003', 'Resumo tem totalReceitas', r.totalReceitas !== undefined,
      `totalReceitas=${r.totalReceitas}`);

    // *** TESTE MAIS CRÍTICO: Categorias de receita NÃO aparecem no gastosPorCategoria ***
    const gastosCat = r.gastosPorCategoria || [];
    const catGastoNames = gastosCat.map(g => g.categoria || g.nome);
    const temSalarioEmGastos = catGastoNames.some(n => 
      ['Salário', 'Salario', 'Renda Extra', 'Reembolso', 'Freelance', 'Receita', 'Receitas'].includes(n)
    );
    test('RESUMO-004-CRITICO', 'Receita NÃO aparece em gastosPorCategoria',
      !temSalarioEmGastos,
      `categoriasGasto=[${catGastoNames.join(', ')}]`);

    // Verificar que o gasto com "Renda Extra" foi reclassificado
    const temRendaExtra = catGastoNames.includes('Renda Extra');
    test('RESUMO-005-CRITICO', 'Renda Extra ausente de gastosPorCategoria',
      !temRendaExtra,
      `temRendaExtra=${temRendaExtra}`);

    console.log(`\n  📊 Resumo detalhado:`);
    console.log(`     Total Gastos:   R$ ${r.totalGastos}`);
    console.log(`     Total Receitas: R$ ${r.totalReceitas}`);
    console.log(`     Saldo:          R$ ${r.saldo}`);
    console.log(`     Gastos por Categoria:`);
    for (const gc of gastosCat) {
      console.log(`       - ${gc.categoria || gc.nome}: R$ ${gc.total || gc.valor} (${gc.percentual}%)`);
    }
  }

  // ========== CARTÕES ==========
  console.log('\n--- CARTÕES ---');

  const cartoes = await request('GET', '/api/cartoes', null, TOKEN);
  test('CART-001', 'Listar cartões', cartoes.status === 200,
    `status=${cartoes.status}, count=${Array.isArray(cartoes.data) ? cartoes.data.length : 'N/A'}`);

  // Criar cartão
  const novoCartao = await request('POST', '/api/cartoes', {
    nome: `Teste_${STAMP}`,
    limite: 5000,
    diaFechamento: 15,
    diaVencimento: 25
  }, TOKEN);
  test('CART-002', 'Criar cartão', novoCartao.status === 200 || novoCartao.status === 201,
    `status=${novoCartao.status}`);
  const cartaoId = novoCartao.data?.id || novoCartao.data?.cartao?.id;

  if (cartaoId) {
    // Consultar fatura
    const fatura = await request('GET', `/api/cartoes/${cartaoId}/fatura`, null, TOKEN);
    test('CART-003', 'Consultar fatura', fatura.status === 200,
      `status=${fatura.status}`);
  }

  // ========== LIMITES ==========
  console.log('\n--- LIMITES ---');

  const limites = await request('GET', '/api/limites', null, TOKEN);
  test('LIM-001', 'Listar limites', limites.status === 200,
    `status=${limites.status}`);

  const novoLimite = await request('POST', '/api/limites', {
    categoria: 'Alimentação',
    valor: 500
  }, TOKEN);
  test('LIM-002', 'Criar limite', novoLimite.status === 200 || novoLimite.status === 201,
    `status=${novoLimite.status}, data=${JSON.stringify(novoLimite.data).substring(0, 100)}`);

  // ========== METAS ==========
  console.log('\n--- METAS ---');

  const metas = await request('GET', '/api/metas', null, TOKEN);
  test('META-001', 'Listar metas', metas.status === 200,
    `status=${metas.status}`);

  const novaMeta = await request('POST', '/api/metas', {
    nome: `Meta_${STAMP}`,
    valorAlvo: 10000,
    valorAtual: 2000,
    prazo: new Date(now.getFullYear(), now.getMonth() + 6, 1).toISOString().split('T')[0]
  }, TOKEN);
  test('META-002', 'Criar meta', novaMeta.status === 200 || novaMeta.status === 201,
    `status=${novaMeta.status}`);

  // ========== PREVISÃO ==========
  console.log('\n--- PREVISÃO ---');

  const previsaoPerfil = await request('GET', '/api/previsoes/perfil', null, TOKEN);
  test('PREV-001', 'Perfil financeiro', previsaoPerfil.status === 200,
    `status=${previsaoPerfil.status}`);

  const simular = await request('POST', '/api/previsoes/compra/simular', {
    descricao: 'Teste notebook',
    valor: 3000,
    parcelas: 12
  }, TOKEN);
  test('PREV-002', 'Simular compra', simular.status === 200,
    `status=${simular.status}`);

  // ========== DECISÃO DE GASTO ==========
  console.log('\n--- DECISÃO ---');

  const decisao = await request('POST', '/api/decisao/avaliar', {
    descricao: 'Jantar especial',
    valor: 200,
    categoria: 'Alimentação'
  }, TOKEN);
  test('DEC-001', 'Avaliar decisão de gasto', decisao.status === 200,
    `status=${decisao.status}`);

  // ========== ENCODING VALIDATION ==========
  console.log('\n--- ENCODING / CARACTERES ESPECIAIS ---');

  // Lançamento com caracteres acentuados
  const lancAcento = await request('POST', '/api/lancamentos', {
    descricao: 'Manutenção veículo - óleo e câmbio',
    valor: 450,
    tipo: 1,
    categoria: 'Transporte',
    data: new Date().toISOString().split('T')[0],
    formaPagamento: 1
  }, TOKEN);
  test('ENC-001', 'Lançamento com acentos', lancAcento.status === 200 || lancAcento.status === 201,
    `status=${lancAcento.status}`);

  // Verificar que a descrição volta correta
  if (lancAcento.data) {
    const lancId = lancAcento.data?.id || lancAcento.data?.lancamento?.id;
    if (lancId) {
      const lancCheck = await request('GET', `/api/lancamentos/${lancId}`, null, TOKEN);
      const desc = lancCheck.data?.descricao || lancCheck.data?.lancamento?.descricao || '';
      const encodingOk = desc.includes('Manutenção') && desc.includes('veículo') && desc.includes('câmbio');
      test('ENC-002', 'Acentos retornados corretamente', encodingOk,
        `descricao="${desc}"`);
    }
  }

  // ========== SECURITY ==========
  console.log('\n--- SEGURANÇA ---');

  // XSS no nome
  const xssTest = await request('PUT', '/api/auth/perfil', {
    nome: '<script>alert("xss")</script>'
  }, TOKEN);
  if (xssTest.status === 200) {
    const perfilCheck = await request('GET', '/api/auth/perfil', null, TOKEN);
    const nomeClean = perfilCheck.data?.nome || '';
    const hasScript = nomeClean.includes('<script>');
    test('SEC-001', 'Sanitização XSS no nome', !hasScript,
      `nome="${nomeClean}"`);
  }

  // Acesso a recurso de outro usuário (ID não existente)
  const otherUser = await request('GET', '/api/lancamentos/999999', null, TOKEN);
  test('SEC-002', 'Acesso recurso inexistente', otherUser.status === 404 || otherUser.status === 403,
    `status=${otherUser.status}`);

  // ========== CLEANUP ==========
  console.log('\n--- CLEANUP ---');

  // Deletar lançamentos de teste
  if (gastoId) {
    const del1 = await request('DELETE', `/api/lancamentos/${gastoId}`, null, TOKEN);
    test('CLEAN-001', 'Deletar lançamento gasto', del1.status === 200 || del1.status === 204,
      `status=${del1.status}`);
  }
  if (receitaId) {
    const del2 = await request('DELETE', `/api/lancamentos/${receitaId}`, null, TOKEN);
    test('CLEAN-002', 'Deletar lançamento receita', del2.status === 200 || del2.status === 204,
      `status=${del2.status}`);
  }
  if (gastoRevCatId) {
    const del4 = await request('DELETE', `/api/lancamentos/${gastoRevCatId}`, null, TOKEN);
    test('CLEAN-004', 'Deletar lanç gasto cat rev', del4.status === 200 || del4.status === 204,
      `status=${del4.status}`);
  }
  if (cartaoId) {
    const del3 = await request('DELETE', `/api/cartoes/${cartaoId}`, null, TOKEN);
    test('CLEAN-003', 'Deletar cartão teste', del3.status === 200 || del3.status === 204,
      `status=${del3.status}`);
  }

  // Restaurar nome do perfil
  await request('PUT', '/api/auth/perfil', { nome: 'Test User' }, TOKEN);

  // ========== RELATÓRIO FINAL ==========
  console.log('\n========================================');
  console.log('  RELATÓRIO FINAL');
  console.log('========================================');
  const passed = results.filter(r => r.status === 'PASSOU').length;
  const failed = results.filter(r => r.status === 'FALHOU').length;
  console.log(`\n  Total: ${results.length}`);
  console.log(`  ✅ Passou: ${passed}`);
  console.log(`  ❌ Falhou: ${failed}`);
  console.log(`  Taxa: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n  Falhas:');
    for (const r of results.filter(r => r.status === 'FALHOU')) {
      console.log(`    ❌ ${r.id}: ${r.name} | ${r.detail}`);
    }
  }

  console.log('\n========================================\n');
}

run().catch(e => console.error('FATAL:', e));
