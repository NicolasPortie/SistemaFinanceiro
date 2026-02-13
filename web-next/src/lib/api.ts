// ============================================================
// ControlFinance — API Client Layer
// Professional HTTP client with auto-refresh, rate-limit handling
// ============================================================

const API_BASE = "/api";

// ── Types ──────────────────────────────────────────────────

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  telegramVinculado: boolean;
  criadoEm: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiraEm: string;
  usuario: Usuario;
}

export interface CodigoTelegramResponse {
  codigo: string;
  expiraEm: string;
  instrucoes: string;
}

export interface ResumoFinanceiro {
  de: string;
  ate: string;
  totalGastos: number;
  totalReceitas: number;
  saldo: number;
  gastosPorCategoria: GastoCategoria[];
}

export interface GastoCategoria {
  categoria: string;
  total: number;
  percentual: number;
}

export interface Categoria {
  id: number;
  nome: string;
  padrao: boolean;
}

export interface Cartao {
  id: number;
  nome: string;
  limite: number;
  limiteUsado: number;
  limiteDisponivel: number;
  diaVencimento: number;
  ativo: boolean;
}

export interface SimularCompraRequest {
  descricao: string;
  valor: number;
  formaPagamento: string;
  numeroParcelas: number;
  cartaoCreditoId?: number;
  dataPrevista?: string;
}

export interface SimulacaoResultado {
  simulacaoId: number;
  descricao: string;
  valor: number;
  formaPagamento: string;
  numeroParcelas: number;
  risco: string;
  confianca: string;
  recomendacao: string;
  menorSaldoProjetado: number;
  piorMes: string;
  folgaMensalMedia: number;
  meses: SimulacaoMes[];
  cenariosAlternativos?: CenarioAlternativo[];
  resumoTexto: string;
}

export interface SimulacaoMes {
  mes: string;
  receitaPrevista: number;
  gastoPrevisto: number;
  compromissosExistentes: number;
  saldoBase: number;
  impactoCompra: number;
  saldoComCompra: number;
  impactoPercentual: number;
}

export interface CenarioAlternativo {
  numeroParcelas: number;
  valorParcela: number;
  risco: string;
  menorSaldoProjetado: number;
  piorMes: string;
}

export interface PerfilFinanceiro {
  receitaMensalMedia: number;
  gastoMensalMedio: number;
  gastoFixoEstimado: number;
  gastoVariavelEstimado: number;
  saldoMedioMensal: number;
  totalParcelasAbertas: number;
  quantidadeParcelasAbertas: number;
  diasDeHistorico: number;
  mesesComDados: number;
  confianca: string;
  atualizadoEm: string;
}

export interface LimiteCategoria {
  id: number;
  categoriaId: number;
  categoriaNome: string;
  valorLimite: number;
  gastoAtual: number;
  percentualConsumido: number;
  status: string;
}

export interface DefinirLimiteRequest {
  categoria: string;
  valor: number;
}

export interface MetaFinanceira {
  id: number;
  nome: string;
  tipo: string;
  valorAlvo: number;
  valorAtual: number;
  percentualConcluido: number;
  valorMensalNecessario: number;
  status: string;
  prioridade: string;
  desvio: string;
  prazo: string;
  categoriaNome?: string;
  mesesRestantes: number;
  criadoEm: string;
}

export interface CriarMetaRequest {
  nome: string;
  tipo: string;
  valorAlvo: number;
  valorAtual: number;
  prazo: string;
  categoria?: string;
  prioridade: string;
}

export interface AtualizarMetaRequest {
  valorAtual?: number;
  status?: string;
  prioridade?: string;
}

// ── Lancamentos ────────────────────────────────────────────

export interface Lancamento {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  tipo: string;
  formaPagamento: string;
  categoria: string;
  categoriaId: number;
  numeroParcelas: number;
  parcelado: boolean;
  criadoEm: string;
}

export interface LancamentosPaginados {
  items: Lancamento[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
  totalPaginas: number;
}

export interface AtualizarLancamentoRequest {
  valor?: number;
  descricao?: string;
  data?: string;
  categoria?: string;
}

export interface CriarLancamentoRequest {
  valor: number;
  descricao: string;
  data?: string;
  tipo: 1 | 2;
  formaPagamento: 1 | 2 | 3;
  categoria?: string;
  numeroParcelas?: number;
  cartaoCreditoId?: number;
}

// ── Cartões extras ─────────────────────────────────────────

export interface AtualizarCartaoRequest {
  nome?: string;
  limite?: number;
  diaVencimento?: number;
}

export interface FaturaResumo {
  faturaId: number;
  cartaoId: number;
  cartaoNome: string;
  mesReferencia: string;
  total: number;
  dataFechamento: string;
  dataVencimento: string;
  status: string;
  parcelas: FaturaParcela[];
}

export interface FaturaParcela {
  descricao: string;
  categoria: string;
  valor: number;
  valorTotal: number;
  parcela: string;
  numeroParcela: number;
  totalParcelas: number;
  dataCompra: string;
  dataVencimento: string;
  paga: boolean;
}

// ── Auth extras ────────────────────────────────────────────

export interface AtualizarPerfilRequest {
  nome?: string;
  senhaAtual?: string;
  novaSenha?: string;
}

export interface RecuperarSenhaResponse {
  mensagem: string;
  codigo?: string;
}

// ── Request Options ────────────────────────────────────────

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  _isRetry?: boolean;
}

function toSnakeCase(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function normalizeMeta(meta: MetaFinanceira): MetaFinanceira {
  return {
    ...meta,
    tipo: toSnakeCase(meta.tipo),
    status: toSnakeCase(meta.status),
    prioridade: toSnakeCase(meta.prioridade),
    desvio: toSnakeCase(meta.desvio),
  };
}

// ── Refresh Token Singleton ────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("cf_refresh_token");
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    localStorage.setItem("cf_token", data.token);
    localStorage.setItem("cf_refresh_token", data.refreshToken);
    localStorage.setItem("cf_user", JSON.stringify(data.usuario));
    return true;
  } catch {
    return false;
  }
}

// ── Core Request Function ──────────────────────────────────

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, _isRetry = false } = options;

  const token = localStorage.getItem("cf_token");
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Rate limit
  if (res.status === 429) {
    throw new Error("Muitas requisições. Aguarde um momento e tente novamente.");
  }

  // Unauthorized — try refresh
  if (res.status === 401 && !_isRetry) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await (refreshPromise ?? Promise.resolve(false));
    if (refreshed) {
      return request<T>(path, { ...options, _isRetry: true });
    }

    // Refresh failed — full logout
    localStorage.removeItem("cf_token");
    localStorage.removeItem("cf_refresh_token");
    localStorage.removeItem("cf_user");
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.erro || errorData?.message || `Erro ${res.status}`);
  }

  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ── API Endpoints ──────────────────────────────────────────

export const api = {
  auth: {
    registrar: (data: { nome: string; email: string; senha: string; codigoConvite: string }) =>
      request<AuthResponse>("/auth/registrar", { method: "POST", body: data }),

    login: (data: { email: string; senha: string }) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: data }),

    logout: () => request("/auth/logout", { method: "POST" }),

    perfil: () => request<Usuario>("/auth/perfil"),

    atualizarPerfil: (data: AtualizarPerfilRequest) =>
      request<Usuario>("/auth/perfil", { method: "PUT", body: data }),

    recuperarSenha: (data: { email: string }) =>
      request<RecuperarSenhaResponse>("/auth/recuperar-senha", { method: "POST", body: data }),

    redefinirSenha: (data: { email: string; codigo: string; novaSenha: string }) =>
      request("/auth/redefinir-senha", { method: "POST", body: data }),

    gerarCodigoTelegram: () =>
      request<CodigoTelegramResponse>("/auth/telegram/gerar-codigo", {
        method: "POST",
      }),
  },

  lancamentos: {
    criar: (data: CriarLancamentoRequest) =>
      request("/lancamentos", {
        method: "POST",
        body: data,
      }),

    listar: (params?: {
      tipo?: string;
      categoriaId?: number;
      busca?: string;
      de?: string;
      ate?: string;
      pagina?: number;
      tamanhoPagina?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.tipo) searchParams.set("tipo", params.tipo);
      if (params?.categoriaId) searchParams.set("categoriaId", params.categoriaId.toString());
      if (params?.busca) searchParams.set("busca", params.busca);
      if (params?.de) searchParams.set("de", params.de);
      if (params?.ate) searchParams.set("ate", params.ate);
      if (params?.pagina) searchParams.set("pagina", params.pagina.toString());
      if (params?.tamanhoPagina) searchParams.set("tamanhoPagina", params.tamanhoPagina.toString());
      const qs = searchParams.toString();
      return request<LancamentosPaginados>(`/lancamentos${qs ? `?${qs}` : ""}`);
    },

    resumo: (mes?: string) =>
      request<ResumoFinanceiro>(`/lancamentos/resumo${mes ? `?mes=${mes}` : ""}`),

    atualizar: (id: number, data: AtualizarLancamentoRequest) =>
      request(`/lancamentos/${id}`, { method: "PUT", body: data }),

    remover: (id: number) =>
      request(`/lancamentos/${id}`, { method: "DELETE" }),
  },

  categorias: {
    listar: () => request<Categoria[]>("/categorias"),
    criar: (data: { nome: string }) =>
      request<Categoria>("/categorias", { method: "POST", body: data }),
    atualizar: (id: number, data: { nome: string }) =>
      request<Categoria>(`/categorias/${id}`, { method: "PUT", body: data }),
    remover: (id: number) =>
      request(`/categorias/${id}`, { method: "DELETE" }),
  },

  cartoes: {
    listar: () => request<Cartao[]>("/cartoes"),
    criar: (data: { nome: string; limite: number; diaVencimento: number }) =>
      request("/cartoes", { method: "POST", body: data }),
    atualizar: (id: number, data: AtualizarCartaoRequest) =>
      request("/cartoes/" + id, { method: "PUT", body: data }),
    desativar: (id: number) =>
      request(`/cartoes/${id}`, { method: "DELETE" }),
    faturas: (cartaoId: number) =>
      request<FaturaResumo[]>(`/cartoes/${cartaoId}/fatura`),
  },

  previsao: {
    simular: (data: SimularCompraRequest) =>
      request<SimulacaoResultado>("/previsoes/compra/simular", {
        method: "POST",
        body: data,
      }),
    perfil: () => request<PerfilFinanceiro>("/previsoes/perfil"),
    historico: () => request<SimulacaoResultado[]>("/previsoes/compra/historico"),
  },

  limites: {
    listar: () => request<LimiteCategoria[]>("/limites"),
    definir: (data: DefinirLimiteRequest) => request("/limites", { method: "POST", body: data }),
    remover: (categoria: string) =>
      request(`/limites/${encodeURIComponent(categoria)}`, { method: "DELETE" }),
  },

  metas: {
    listar: async (status?: string) => {
      const metas = await request<MetaFinanceira[]>(`/metas${status ? `?status=${status}` : ""}`);
      return metas.map(normalizeMeta);
    },
    criar: async (data: CriarMetaRequest) => {
      const meta = await request<MetaFinanceira>("/metas", { method: "POST", body: data });
      return normalizeMeta(meta);
    },
    atualizar: async (id: number, data: AtualizarMetaRequest) => {
      const meta = await request<MetaFinanceira>(`/metas/${id}`, { method: "PUT", body: data });
      return normalizeMeta(meta);
    },
    remover: (id: number) => request(`/metas/${id}`, { method: "DELETE" }),
  },
};
