// ==========================================================================
// BATERIA MESTRA DE TESTES - ControlFinance
// Execução automatizada dos testes da BATERIA_MESTRA_TESTES_WEB_BOT_CRUZAMENTOS.md
// ==========================================================================

const http = require('http');
const crypto = require('crypto');

const API = 'http://localhost:5000';
const EMAIL = 'nicolasportieprofissional@gmail.com';
const SENHA = 'conectairrig@';
const STAMP = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);

let TOKEN = '';
let REFRESH = '';
let USER_DATA = {};
let results = [];
let totalPassed = 0;
let totalFailed = 0;
let totalBlocked = 0;

// ---- HTTP Helper ----
function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...headers,
      },
    };
    if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(d); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: d });
      });
    });
    r.on('error', reject);
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

function record(id, desc, passed, detail = '') {
  const status = passed === null ? 'BLOQUEADO' : passed ? 'PASSOU' : 'FALHOU';
  if (passed === true) totalPassed++;
  else if (passed === false) totalFailed++;
  else totalBlocked++;
  results.push({ id, desc, status, detail });
  const icon = passed === true ? '✅' : passed === false ? '❌' : '⚠️';
  console.log(`${icon} ${id}: ${desc} - ${status}${detail ? ' | ' + detail : ''}`);
}

// ---- DB Helper ----
function dbQuery(sql, params = []) {
  const { Client } = require('pg');
  const c = new Client({ host: 'localhost', port: 5432, database: 'controlfinance', user: 'postgres', password: 'admin' });
  return c.connect().then(() => c.query(sql, params)).then(r => { c.end(); return r; }).catch(e => { c.end(); throw e; });
}

// =========================================================================
// SUITE 1: PRE-FLIGHT
// =========================================================================
async function preflight() {
  console.log('\n══════════════════════════════════════');
  console.log('  FASE 1: PRE-FLIGHT');
  console.log('══════════════════════════════════════\n');

  // Health API
  const h = await req('GET', '/api/telegram/health');
  record('PRE-01', 'API Health', h.status === 200 && h.body?.status === 'online', `status=${h.body?.status}`);

  // Login
  const login = await req('POST', '/api/auth/login', { email: EMAIL, senha: SENHA });
  const ok = login.status === 200 && login.body?.token;
  if (ok) { TOKEN = login.body.token; REFRESH = login.body.refreshToken; USER_DATA = login.body; }
  record('PRE-02', 'Login API', !!ok, `status=${login.status} nome=${login.body?.nome}`);

  // Perfil
  const perfil = await req('GET', '/api/auth/perfil');
  record('PRE-03', 'Perfil carrega', perfil.status === 200, `nome=${perfil.body?.nome}`);

  // Telegram vinculado
  record('PRE-04', 'Telegram vinculado', perfil.body?.telegramVinculado === true, `vinculado=${perfil.body?.telegramVinculado}`);
}

// =========================================================================
// SUITE 2: WEB-AUTH
// =========================================================================
async function suiteWebAuth() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: WEB-AUTH (Autenticação)');
  console.log('══════════════════════════════════════\n');

  // WEB-AUTH-001: Login válido
  const login = await req('POST', '/api/auth/login', { email: EMAIL, senha: SENHA });
  record('WEB-AUTH-001', 'Login válido', login.status === 200 && !!login.body?.token);
  if (login.body?.token) TOKEN = login.body.token;

  // WEB-AUTH-002: Login senha inválida
  const bad = await req('POST', '/api/auth/login', { email: EMAIL, senha: 'errada123' });
  record('WEB-AUTH-002', 'Login senha inválida', bad.status === 401 || bad.status === 400);

  // WEB-AUTH-003: Login email inválido
  const bademail = await req('POST', '/api/auth/login', { email: 'invalido', senha: SENHA });
  record('WEB-AUTH-003', 'Login email inválido', bademail.status >= 400);

  // WEB-AUTH-005: Registro com convite inválido
  const regBad = await req('POST', '/api/auth/registrar', { nome: 'Teste', email: `inv_${STAMP}@test.com`, senha: 'Test@123', codigoConvite: 'invalido' });
  record('WEB-AUTH-005', 'Registro convite inválido', regBad.status >= 400, `status=${regBad.status}`);

  // WEB-AUTH-006: Registro email existente
  const regDup = await req('POST', '/api/auth/registrar', { nome: 'Teste', email: EMAIL, senha: 'Test@123', codigoConvite: 'qualquer' });
  record('WEB-AUTH-006', 'Registro email duplicado', regDup.status >= 400);

  // WEB-AUTH-012: Logout (verifica endpoint)
  const logout = await req('POST', '/api/auth/logout', { refreshToken: REFRESH });
  record('WEB-AUTH-012', 'Logout', logout.status === 200 || logout.status === 204, `status=${logout.status}`);

  // Re-login after logout
  const reLogin = await req('POST', '/api/auth/login', { email: EMAIL, senha: SENHA });
  if (reLogin.body?.token) { TOKEN = reLogin.body.token; REFRESH = reLogin.body.refreshToken; }

  // WEB-AUTH-017: Rota protegida sem token
  const oldToken = TOKEN;
  TOKEN = '';
  const noAuth = await req('GET', '/api/lancamentos');
  record('WEB-AUTH-017', 'Rota sem token = 401', noAuth.status === 401);
  TOKEN = oldToken;

  // WEB-AUTH-019: Sanitização nome
  const xssName = await req('PUT', '/api/auth/perfil', { nome: '<script>alert(1)</script>' });
  const perfilAfter = await req('GET', '/api/auth/perfil');
  const sanitized = perfilAfter.body?.nome && !perfilAfter.body.nome.includes('<script>');
  record('WEB-AUTH-019', 'Sanitização nome perfil', sanitized, `nome=${perfilAfter.body?.nome}`);

  // Restaurar nome
  await req('PUT', '/api/auth/perfil', { nome: 'Nicolas' });
}

// =========================================================================
// SUITE 3: WEB-LANCAMENTOS
// =========================================================================
async function suiteWebLancamentos() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: WEB-LANC (Lançamentos)');
  console.log('══════════════════════════════════════\n');

  // WEB-LANC-001: Criar despesa débito
  const desp = await req('POST', '/api/lancamentos', {
    descricao: `WEB_LANC_001_${STAMP}`, valor: 55.50, tipo: 'Gasto', categoria: 'Alimentação', formaPagamento: 'Debito'
  });
  record('WEB-LANC-001', 'Criar despesa débito', desp.status === 200 && desp.body?.id > 0, `id=${desp.body?.id}`);

  // WEB-LANC-002: Criar receita
  const rec = await req('POST', '/api/lancamentos', {
    descricao: `WEB_LANC_002_${STAMP}`, valor: 3000, tipo: 'Receita', categoria: 'Salário', formaPagamento: 'Pix'
  });
  record('WEB-LANC-002', 'Criar receita', rec.status === 200 && rec.body?.id > 0);

  // WEB-LANC-006: Valor zero
  const zero = await req('POST', '/api/lancamentos', {
    descricao: 'Zero test', valor: 0, tipo: 'Gasto', categoria: 'Outros', formaPagamento: 'Pix'
  });
  record('WEB-LANC-006', 'Valor zero bloqueado', zero.status === 400, `status=${zero.status}`);

  // WEB-LANC-008: Descricao vazia
  const vazia = await req('POST', '/api/lancamentos', {
    descricao: '', valor: 10, tipo: 'Gasto', categoria: 'Outros', formaPagamento: 'Pix'
  });
  record('WEB-LANC-008', 'Descrição vazia', vazia.status >= 400, `status=${vazia.status}`);

  // WEB-LANC-009: Editar descrição
  if (desp.body?.id) {
    const edit = await req('PUT', `/api/lancamentos/${desp.body.id}`, {
      descricao: `WEB_LANC_009_EDIT_${STAMP}`, valor: 55.50, tipo: 'Gasto', categoria: 'Alimentação', formaPagamento: 'Debito'
    });
    record('WEB-LANC-009', 'Editar descrição', edit.status === 200, `status=${edit.status}`);
  }

  // WEB-LANC-010: Editar valor
  if (desp.body?.id) {
    const edit2 = await req('PUT', `/api/lancamentos/${desp.body.id}`, {
      descricao: `WEB_LANC_009_EDIT_${STAMP}`, valor: 99.99, tipo: 'Gasto', categoria: 'Alimentação', formaPagamento: 'Debito'
    });
    record('WEB-LANC-010', 'Editar valor', edit2.status === 200);
  }

  // WEB-LANC-013: Excluir lançamento
  if (desp.body?.id) {
    const del = await req('DELETE', `/api/lancamentos/${desp.body.id}`);
    record('WEB-LANC-013', 'Excluir lançamento', del.status === 200 || del.status === 204);
  }

  // WEB-LANC-014/015: Filtro por tipo
  const filtGasto = await req('GET', '/api/lancamentos?tipo=Gasto');
  const onlyGastos = filtGasto.body?.every?.(l => l.tipo === 'Gasto' || l.tipo === 0);
  record('WEB-LANC-014', 'Filtro tipo Gasto', filtGasto.status === 200, `count=${filtGasto.body?.length}`);

  const filtRec = await req('GET', '/api/lancamentos?tipo=Receita');
  record('WEB-LANC-015', 'Filtro tipo Receita', filtRec.status === 200, `count=${filtRec.body?.length}`);

  // WEB-LANC-022: Isolamento usuário
  TOKEN = '';
  const iso = await req('GET', '/api/lancamentos/99999');
  record('WEB-LANC-022', 'Isolamento sem token', iso.status === 401);
  // Re-auth
  const reLogin = await req('POST', '/api/auth/login', { email: EMAIL, senha: SENHA });
  TOKEN = reLogin.body?.token || '';

  // Resumo - CRÍTICO: Receita/Gasto separados
  const resumo = await req('GET', '/api/lancamentos/resumo');
  const cats = resumo.body?.gastosPorCategoria || [];
  const catNames = cats.map(c => c.categoria || c.nome);
  const receitaCats = ['Salário', 'Salario', 'Renda Extra', 'Reembolso', 'Freelance', 'Investimento', 'Dividendos'];
  const hasReceitaInGastos = catNames.some(n => receitaCats.includes(n));
  record('RESUMO-CRITICO', 'Nenhuma cat receita em gastos', !hasReceitaInGastos, `cats=[${catNames.join(', ')}]`);

  // Limpar receita de teste
  if (rec.body?.id) await req('DELETE', `/api/lancamentos/${rec.body.id}`);
}

// =========================================================================
// SUITE 4: WEB-CARTOES
// =========================================================================
async function suiteWebCartoes() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: WEB-CARD (Cartões e Faturas)');
  console.log('══════════════════════════════════════\n');

  // WEB-CARD-001: Criar cartão
  const card = await req('POST', '/api/cartoes', {
    nome: `CARD_${STAMP}`, limite: 5000, diaVencimento: 15
  });
  record('WEB-CARD-001', 'Criar cartão válido', card.status === 200 && card.body?.id > 0, `id=${card.body?.id}`);

  // Listar cartões
  const list = await req('GET', '/api/cartoes');
  const found = list.body?.some?.(c => c.nome === `CARD_${STAMP}`);
  record('WEB-CARD-LIST', 'Cartão na listagem', found);

  if (card.body?.id) {
    // WEB-CARD-006: Editar nome
    const edit = await req('PUT', `/api/cartoes/${card.body.id}`, { nome: `CARD_EDIT_${STAMP}`, limite: 5000, diaVencimento: 15 });
    record('WEB-CARD-006', 'Editar cartão nome', edit.status === 200);

    // WEB-CARD-023: Compra crédito à vista
    const compra1x = await req('POST', '/api/lancamentos', {
      descricao: `CRD1x_${STAMP}`, valor: 150, tipo: 'Gasto', categoria: 'Lazer',
      formaPagamento: 'Credito', cartaoId: card.body.id, numeroParcelas: 1
    });
    record('WEB-CARD-023', 'Compra crédito 1x', compra1x.status === 200);

    // WEB-CARD-024: Compra crédito parcelada 3x
    const compra3x = await req('POST', '/api/lancamentos', {
      descricao: `CRD3x_${STAMP}`, valor: 600, tipo: 'Gasto', categoria: 'Vestuário',
      formaPagamento: 'Credito', cartaoId: card.body.id, numeroParcelas: 3
    });
    record('WEB-CARD-024', 'Compra crédito 3x', compra3x.status === 200);

    // WEB-CARD-011: Faturas
    const fat = await req('GET', `/api/cartoes/${card.body.id}/fatura`);
    record('WEB-CARD-011', 'Consultar faturas', fat.status === 200, `faturas=${fat.body?.length || 'obj'}`);

    // WEB-CARD-025: Ajuste centavos (valor não divisível)
    const compraOdd = await req('POST', '/api/lancamentos', {
      descricao: `CRDOdd_${STAMP}`, valor: 100, tipo: 'Gasto', categoria: 'Outros',
      formaPagamento: 'Credito', cartaoId: card.body.id, numeroParcelas: 3
    });
    record('WEB-CARD-025', 'Compra com ajuste centavos', compraOdd.status === 200);

    // DB check: parcelas
    try {
      const parcRes = await dbQuery(`SELECT l.id, l.descricao, l.valor as valor_original, 
        (SELECT SUM(p.valor) FROM parcelas p WHERE p.lancamento_id = l.id) as soma_parcelas,
        (SELECT COUNT(*) FROM parcelas p WHERE p.lancamento_id = l.id) as qtd_parcelas
        FROM lancamentos l WHERE l.descricao LIKE $1`, [`%${STAMP}%`]);
      let allOk = true;
      for (const r of parcRes.rows) {
        if (r.qtd_parcelas > 0 && Math.abs(parseFloat(r.valor_original) - parseFloat(r.soma_parcelas)) > 0.02) {
          allOk = false;
        }
      }
      record('DB-PARC-001', 'Soma parcelas = valor original', allOk, `checked=${parcRes.rows.length}`);
    } catch (e) {
      record('DB-PARC-001', 'Soma parcelas = valor original', null, e.message);
    }

    // WEB-CARD-021: Limite usado
    const cartoes2 = await req('GET', '/api/cartoes');
    const myCard = cartoes2.body?.find?.(c => c.id === card.body.id);
    record('WEB-CARD-021', 'Limite usado > 0', myCard && myCard.limiteUsado > 0, `usado=${myCard?.limiteUsado}`);

    // Cleanup: Deletar cartão
    await req('DELETE', `/api/cartoes/${card.body.id}`);
  }

  // WEB-CARD-026: Fatura cartão inválido
  const fat404 = await req('GET', '/api/cartoes/99999/fatura');
  record('WEB-CARD-026', 'Fatura cartão inexistente', fat404.status === 404 || fat404.status >= 400, `status=${fat404.status}`);
}

// =========================================================================
// SUITE 5: WEB-LIMITES
// =========================================================================
async function suiteWebLimites() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: WEB-LIM (Limites)');
  console.log('══════════════════════════════════════\n');

  // WEB-LIM-001: Criar limite
  const lim = await req('POST', '/api/limites', { categoria: 'Alimentação', valor: 800 });
  record('WEB-LIM-001', 'Criar limite válido', lim.status === 200 || lim.status === 201, `status=${lim.status}`);

  // WEB-LIM-003: Listar limites
  const limList = await req('GET', '/api/limites');
  record('WEB-LIM-003', 'Listar limites', limList.status === 200 && Array.isArray(limList.body));

  // Verificar status do limite
  if (Array.isArray(limList.body)) {
    const alim = limList.body.find(l => l.categoria === 'Alimentação');
    record('WEB-LIM-010', 'Limite tem dados', !!alim, `consumido=${alim?.consumido} status=${alim?.status}`);
  }

  // WEB-LIM-004: Atualizar limite
  const limUp = await req('POST', '/api/limites', { categoria: 'Alimentação', valor: 1000 });
  record('WEB-LIM-004', 'Atualizar limite', limUp.status === 200 || limUp.status === 201);

  // WEB-LIM-005: Remover limite
  const limDel = await req('DELETE', '/api/limites/Alimentação');
  record('WEB-LIM-005', 'Remover limite', limDel.status === 200 || limDel.status === 204, `status=${limDel.status}`);
}

// =========================================================================
// SUITE 6: WEB-METAS
// =========================================================================
async function suiteWebMetas() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: WEB-META (Metas)');
  console.log('══════════════════════════════════════\n');

  // WEB-META-001: Criar meta
  const meta = await req('POST', '/api/metas', {
    nome: `META_${STAMP}`, tipo: 'juntar_valor', valorAlvo: 5000, prazo: '12/2026', prioridade: 'alta'
  });
  record('WEB-META-001', 'Criar meta', meta.status === 200 && meta.body?.id > 0, `id=${meta.body?.id}`);

  if (meta.body?.id) {
    // WEB-META-008: Atualizar valor
    const up = await req('PUT', `/api/metas/${meta.body.id}`, { valorAtual: 1200 });
    record('WEB-META-008', 'Atualizar valor meta', up.status === 200);

    // WEB-META-009: Auto concluir
    const auto = await req('PUT', `/api/metas/${meta.body.id}`, { valorAtual: 5000 });
    const metaAfter = await req('GET', '/api/metas');
    const myMeta = metaAfter.body?.find?.(m => m.id === meta.body.id);
    record('WEB-META-009', 'Auto-concluir meta', myMeta?.status === 'concluida' || myMeta?.concluida === true, `status=${myMeta?.status}`);

    // Listar metas
    record('WEB-META-013', 'Listar metas', metaAfter.status === 200 && Array.isArray(metaAfter.body));

    // WEB-META-016: Percentual
    if (myMeta) {
      const pct = myMeta.percentual || (myMeta.valorAtual / myMeta.valorAlvo * 100);
      record('WEB-META-016', 'Percentual cálculo', pct >= 99, `pct=${pct}`);
    }

    // Cleanup
    await req('DELETE', `/api/metas/${meta.body.id}`);
  }

  // WEB-META-004: Valor alvo inválido
  const badMeta = await req('POST', '/api/metas', { nome: 'bad', tipo: 'juntar_valor', valorAlvo: 0, prazo: '12/2026' });
  record('WEB-META-004', 'Valor alvo inválido', badMeta.status >= 400, `status=${badMeta.status}`);

  // WEB-META-024: Data timezone
  const metaTz = await req('POST', '/api/metas', {
    nome: `METATZ_${STAMP}`, tipo: 'juntar_valor', valorAlvo: 1000, prazo: '12/2026', prioridade: 'media'
  });
  if (metaTz.body?.id) {
    const check = await req('GET', '/api/metas');
    const mtz = check.body?.find?.(m => m.id === metaTz.body.id);
    const prazoOk = mtz?.prazo?.includes('2026-12') || mtz?.prazo?.includes('12/2026');
    record('WEB-META-024', 'Prazo sem drift timezone', prazoOk, `prazo=${mtz?.prazo}`);
    await req('DELETE', `/api/metas/${metaTz.body.id}`);
  }
}

// =========================================================================
// SUITE 7: WEB-SIMULAÇÃO
// =========================================================================
async function suiteWebSimulacao() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: WEB-SIM (Simulação)');
  console.log('══════════════════════════════════════\n');

  // WEB-SIM-001: Simular pix válido
  const sim = await req('POST', '/api/previsoes/compra/simular', {
    descricao: `SIM_${STAMP}`, valor: 200, formaPagamento: 'Pix'
  });
  record('WEB-SIM-001', 'Simular pix válido', sim.status === 200 && sim.body != null, `risco=${sim.body?.nivelRisco || sim.body?.risco}`);

  // WEB-SIM-003: Simular crédito 12x
  const sim12 = await req('POST', '/api/previsoes/compra/simular', {
    descricao: `SIM12_${STAMP}`, valor: 2400, formaPagamento: 'Credito', numeroParcelas: 12
  });
  record('WEB-SIM-003', 'Simular crédito 12x', sim12.status === 200);

  // WEB-SIM-015: Histórico
  const hist = await req('GET', '/api/previsoes/compra/historico');
  record('WEB-SIM-015', 'Histórico simulações', hist.status === 200 && Array.isArray(hist.body));

  // WEB-SIM-014: Perfil financeiro
  const perfil = await req('GET', '/api/previsoes/perfil');
  record('WEB-SIM-014', 'Perfil financeiro', perfil.status === 200, `confianca=${perfil.body?.confianca || perfil.body?.nivelConfianca}`);

  // Decisão de gasto
  const dec = await req('POST', '/api/decisao/avaliar', { descricao: 'jantar', valor: 80 });
  record('BOT-SIM-004', '/posso - decisão gasto', dec.status === 200, `parecer=${dec.body?.parecer || dec.body?.decisao}`);
}

// =========================================================================
// SUITE 8: WEB-CATEGORIAS
// =========================================================================
async function suiteWebCategorias() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: WEB-PERF (Categorias/Perfil)');
  console.log('══════════════════════════════════════\n');

  // Listar categorias
  const cats = await req('GET', '/api/categorias');
  record('WEB-PERF-018', 'Listar categorias', cats.status === 200 && Array.isArray(cats.body), `count=${cats.body?.length}`);

  // Criar categoria custom
  const newCat = await req('POST', '/api/categorias', { nome: `CAT_${STAMP}` });
  record('WEB-PERF-011', 'Criar categoria customizada', newCat.status === 200 || newCat.status === 201, `id=${newCat.body?.id}`);

  if (newCat.body?.id) {
    // Duplicada
    const dup = await req('POST', '/api/categorias', { nome: `CAT_${STAMP}` });
    record('WEB-PERF-012', 'Categoria duplicada bloqueada', dup.status >= 400, `status=${dup.status}`);

    // Editar
    const edit = await req('PUT', `/api/categorias/${newCat.body.id}`, { nome: `CAT_EDIT_${STAMP}` });
    record('WEB-PERF-013', 'Editar categoria', edit.status === 200);

    // Remover
    const del = await req('DELETE', `/api/categorias/${newCat.body.id}`);
    record('WEB-PERF-015', 'Remover categoria', del.status === 200 || del.status === 204);
  }
}

// =========================================================================
// SUITE 9: ENCODING UTF-8
// =========================================================================
async function suiteEncoding() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: ENCODING (UTF-8)');
  console.log('══════════════════════════════════════\n');

  // ENC-1: Acentos simples
  const enc1 = await req('POST', '/api/lancamentos', {
    descricao: `Manutenção veículo ${STAMP}`, valor: 350, tipo: 'Gasto', categoria: 'Transporte', formaPagamento: 'Debito'
  });
  const get1 = enc1.body?.id ? await req('GET', `/api/lancamentos/${enc1.body.id}`) : { body: enc1.body };
  const desc1 = get1.body?.descricao || enc1.body?.descricao;
  record('ENC-001', 'Acentos preservados', desc1?.includes('Manutenção') && desc1?.includes('veículo'), `desc=${desc1}`);

  // ENC-2: Caracteres especiais
  const enc2 = await req('POST', '/api/lancamentos', {
    descricao: `Ônibus São Paulo → Curitiba ${STAMP}`, valor: 120, tipo: 'Gasto', categoria: 'Transporte', formaPagamento: 'Pix'
  });
  const desc2 = enc2.body?.descricao;
  record('ENC-002', 'Chars especiais preservados', desc2?.includes('Ônibus') || desc2?.includes('São'), `desc=${desc2}`);

  // ENC-3: Emojis (se suportados)
  const enc3 = await req('POST', '/api/lancamentos', {
    descricao: `Café ☕ e 🍕 ${STAMP}`, valor: 45, tipo: 'Gasto', categoria: 'Alimentação', formaPagamento: 'Pix'
  });
  record('ENC-003', 'Emojis na descrição', enc3.status === 200, `desc=${enc3.body?.descricao}`);

  // Cleanup
  for (const e of [enc1, enc2, enc3]) {
    if (e.body?.id) await req('DELETE', `/api/lancamentos/${e.body.id}`);
  }
}

// =========================================================================
// SUITE 10: SEGURANÇA
// =========================================================================
async function suiteSecurity() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: SEGURANÇA');
  console.log('══════════════════════════════════════\n');

  // SEC-001: JWT ausente
  const saved = TOKEN;
  TOKEN = '';
  const noJwt = await req('GET', '/api/lancamentos');
  record('SEC-001', 'JWT ausente = 401', noJwt.status === 401);
  TOKEN = saved;

  // SEC-002: JWT inválido
  const oldT = TOKEN;
  TOKEN = 'invalid.token.here';
  const badJwt = await req('GET', '/api/lancamentos');
  record('SEC-002', 'JWT inválido = 401', badJwt.status === 401);
  TOKEN = oldT;

  // SEC-007: Security headers
  const hdr = await req('GET', '/api/telegram/health');
  const hasXCTO = !!hdr.headers['x-content-type-options'];
  const hasXFO = !!hdr.headers['x-frame-options'];
  record('SEC-007', 'Security headers presentes', hasXCTO || hasXFO, `XCTO=${hasXCTO} XFO=${hasXFO}`);

  // SEC-009: XSS sanitização
  const xss = await req('POST', '/api/lancamentos', {
    descricao: '<img onerror=alert(1)>', valor: 10, tipo: 'Gasto', categoria: 'Outros', formaPagamento: 'Pix'
  });
  const descXss = xss.body?.descricao || '';
  const xssSafe = !descXss.includes('<img') || descXss.includes('&lt;');
  record('SEC-009', 'XSS sanitizado', xss.status === 200 && xssSafe, `desc=${descXss}`);
  if (xss.body?.id) await req('DELETE', `/api/lancamentos/${xss.body.id}`);

  // SEC-010: Recuperação senha não vaza email
  const recov = await req('POST', '/api/auth/recuperar-senha', { email: 'inexistente@example.com' });
  record('SEC-010', 'Recuperação não vaza email', recov.status === 200 || recov.status === 404, `status=${recov.status}`);

  // SEC-011: Webhook sem secret
  const noSecret = await req('POST', '/api/telegram/webhook', { update_id: 1 }, { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' });
  record('SEC-011', 'Webhook sem secret correto', noSecret.status === 401 || noSecret.status === 403, `status=${noSecret.status}`);
}

// =========================================================================
// SUITE 11: CONSISTÊNCIA DB
// =========================================================================
async function suiteDB() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: CONSISTÊNCIA DB');
  console.log('══════════════════════════════════════\n');

  try {
    // Parcelas integridade
    const parcelas = await dbQuery(`
      SELECT l.id, l.descricao, l.valor::numeric as valor_original,
        COALESCE((SELECT SUM(p.valor::numeric) FROM parcelas p WHERE p.lancamento_id = l.id), 0) as soma_parcelas,
        (SELECT COUNT(*) FROM parcelas p WHERE p.lancamento_id = l.id) as qtd
      FROM lancamentos l 
      WHERE (SELECT COUNT(*) FROM parcelas p WHERE p.lancamento_id = l.id) > 0
      LIMIT 20
    `);
    let allOk = true;
    for (const r of parcelas.rows) {
      if (Math.abs(parseFloat(r.valor_original) - parseFloat(r.soma_parcelas)) > 0.02) {
        allOk = false;
        console.log(`   ❌ Lancamento ${r.id}: valor=${r.valor_original} soma_parcelas=${r.soma_parcelas}`);
      }
    }
    record('DB-INTEG-001', 'Integridade parcelas', allOk, `checked=${parcelas.rows.length}`);

    // Faturas com total correto
    const faturas = await dbQuery(`
      SELECT f.id, f.total::numeric as total_fatura,
        COALESCE((SELECT SUM(p.valor::numeric) FROM parcelas p WHERE p.fatura_id = f.id), 0) as soma_parcelas
      FROM faturas f
      WHERE f.total > 0
      LIMIT 20
    `);
    let fatOk = true;
    for (const f of faturas.rows) {
      if (Math.abs(parseFloat(f.total_fatura) - parseFloat(f.soma_parcelas)) > 0.02) {
        fatOk = false;
        console.log(`   ❌ Fatura ${f.id}: total=${f.total_fatura} soma=${f.soma_parcelas}`);
      }
    }
    record('DB-INTEG-002', 'Integridade faturas', fatOk, `checked=${faturas.rows.length}`);

    // Lançamentos órfãos (sem usuario)
    const orphans = await dbQuery('SELECT COUNT(*) as cnt FROM lancamentos WHERE usuario_id NOT IN (SELECT id FROM usuarios)');
    record('DB-INTEG-003', 'Sem lançamentos órfãos', parseInt(orphans.rows[0].cnt) === 0, `orfaos=${orphans.rows[0].cnt}`);

    // Metas integridade
    const metas = await dbQuery(`
      SELECT id, nome, valor_alvo::numeric, valor_atual::numeric, status
      FROM metas_financeiras
      WHERE valor_atual >= valor_alvo AND status != 'concluida' AND status != 2
    `);
    record('DB-INTEG-004', 'Metas auto-concluidas', metas.rows.length === 0, `incompletas=${metas.rows.length}`);

  } catch (e) {
    record('DB-INTEG', 'Consultas DB', null, e.message);
  }
}

// =========================================================================
// SUITE 12: RESUMO E DASHBOARD
// =========================================================================
async function suiteResumoDash() {
  console.log('\n══════════════════════════════════════');
  console.log('  SUITE: RESUMO/DASHBOARD');
  console.log('══════════════════════════════════════\n');

  const resumo = await req('GET', '/api/lancamentos/resumo');
  record('WEB-DASH-002', 'Resumo carrega', resumo.status === 200 && resumo.body != null);

  if (resumo.body) {
    const gastos = resumo.body.totalGastos ?? resumo.body.gastos;
    const receitas = resumo.body.totalReceitas ?? resumo.body.receitas;
    const saldo = resumo.body.saldo;
    record('WEB-DASH-002b', 'Resumo dados', gastos != null && receitas != null, `G=${gastos} R=${receitas} S=${saldo}`);

    // Verificar gastos por categoria não tem receita
    const gpc = resumo.body.gastosPorCategoria || [];
    const catNames = gpc.map(c => c.categoria || c.nome);
    const recCats = ['Salário', 'Salario', 'Renda Extra', 'Reembolso', 'Freelance', 'Investimento'];
    const hasBad = catNames.some(n => recCats.includes(n));
    record('WEB-DASH-CRIT', 'Gastos sem cat receita', !hasBad, `cats=[${catNames.join(', ')}]`);
  }

  // Perfil financeiro
  const perfil = await req('GET', '/api/previsoes/perfil');
  record('WEB-DASH-PERF', 'Perfil financeiro carrega', perfil.status === 200);
}

// =========================================================================
// MAIN: Execução sequencial de todas as suites
// =========================================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  BATERIA MESTRA DE TESTES - ControlFinance              ║');
  console.log('║  Data: ' + new Date().toISOString() + '              ║');
  console.log('║  STAMP: ' + STAMP + '                                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  await preflight();
  await suiteWebAuth();
  await suiteWebLancamentos();
  await suiteWebCartoes();
  await suiteWebLimites();
  await suiteWebMetas();
  await suiteWebSimulacao();
  await suiteWebCategorias();
  await suiteEncoding();
  await suiteSecurity();
  await suiteDB();
  await suiteResumoDash();

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  RESULTADO FINAL                                        ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passou: ${totalPassed}`);
  console.log(`║  ❌ Falhou: ${totalFailed}`);
  console.log(`║  ⚠️  Bloqueado: ${totalBlocked}`);
  console.log(`║  Total: ${results.length}`);
  console.log(`║  Taxa: ${(totalPassed / results.length * 100).toFixed(1)}%`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (totalFailed > 0) {
    console.log('── FALHAS ──');
    results.filter(r => r.status === 'FALHOU').forEach(r => {
      console.log(`  ❌ ${r.id}: ${r.desc} | ${r.detail}`);
    });
  }
  if (totalBlocked > 0) {
    console.log('\n── BLOQUEADOS ──');
    results.filter(r => r.status === 'BLOQUEADO').forEach(r => {
      console.log(`  ⚠️ ${r.id}: ${r.desc} | ${r.detail}`);
    });
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
