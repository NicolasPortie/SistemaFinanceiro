// ============================================================
// ControlFinance — TanStack Query Hooks
// Centralized data fetching with cache, dedup, and auto-refetch
// ============================================================

import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type SimularCompraRequest,
  type CriarMetaRequest,
  type AtualizarMetaRequest,
  type DefinirLimiteRequest,
  type AtualizarLancamentoRequest,
  type CriarLancamentoRequest,
  type AtualizarCartaoRequest,
  type AtualizarPerfilRequest,
  type CriarLembreteRequest,
  type AtualizarLembreteRequest,
  type PagarContaFixaRequest,
  type AvaliarGastoRequest,
  type CriarContaBancariaRequest,
  type AtualizarContaBancariaRequest,
} from "@/lib/api";
import { toast } from "sonner";

// ── Cache Timing Constants (milliseconds) ──────────────────
const STALE_1_MIN = 1 * 60 * 1000;
const STALE_2_MIN = 2 * 60 * 1000;
const STALE_5_MIN = 5 * 60 * 1000;
const STALE_10_MIN = 10 * 60 * 1000;
const GC_5_MIN = 5 * 60 * 1000;
const GC_10_MIN = 10 * 60 * 1000;
const GC_15_MIN = 15 * 60 * 1000;
const GC_30_MIN = 30 * 60 * 1000;

// ── Query Keys ─────────────────────────────────────────────
export const queryKeys = {
  resumo: (mes?: string) => ["resumo", mes ?? "current"] as const,
  lancamentos: (params?: Record<string, unknown>) => ["lancamentos", params ?? {}] as const,
  categorias: ["categorias"] as const,
  cartoes: ["cartoes"] as const,
  fatura: (cartaoId: number) => ["fatura", cartaoId] as const,
  perfil: ["perfil-financeiro"] as const,
  limites: ["limites"] as const,
  metas: (status?: string) => ["metas", status ?? "all"] as const,
  historicoSimulacao: ["historico-simulacao"] as const,
  usuario: ["usuario-perfil"] as const,
  lembretes: (apenasAtivos?: boolean) => ["lembretes", apenasAtivos ?? true] as const,
  contasBancarias: ["contas-bancarias"] as const,
};

// ── Dashboard ──────────────────────────────────────────────
export function useResumo(mes?: string) {
  return useQuery({
    queryKey: queryKeys.resumo(mes),
    queryFn: () => api.lancamentos.resumo(mes),
    staleTime: STALE_2_MIN,
    gcTime: GC_10_MIN,
  });
}

export function useResumoHistorico(mesesAtras: number = 6) {
  const meses = Array.from({ length: mesesAtras }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }).reverse();

  return useQueries({
    queries: meses.map((mes) => ({
      queryKey: queryKeys.resumo(mes),
      queryFn: () => api.lancamentos.resumo(mes),
      staleTime: STALE_10_MIN,
    })),
    combine: (results) => ({
      data: results
        .map((r, i) =>
          r.data
            ? {
              mes: meses[i],
              receitas: r.data.totalReceitas,
              gastos: r.data.totalGastos,
              saldo: r.data.saldo,
            }
            : null
        )
        .filter((d): d is NonNullable<typeof d> => d !== null),
      isLoading: results.some((r) => r.isLoading),
    }),
  });
}

export function useLancamentos(params?: {
  tipo?: string;
  categoriaId?: number;
  busca?: string;
  de?: string;
  ate?: string;
  pagina?: number;
  tamanhoPagina?: number;
}) {
  return useQuery({
    queryKey: queryKeys.lancamentos(params as Record<string, unknown>),
    queryFn: () => api.lancamentos.listar(params),
    staleTime: STALE_1_MIN,
    gcTime: GC_5_MIN,
  });
}

export function useAtualizarLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AtualizarLancamentoRequest }) =>
      api.lancamentos.atualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Lançamento atualizado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar");
    },
  });
}

export function useRemoverLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.lancamentos.remover(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Lançamento removido!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover");
    },
  });
}

export function useRemoverVariosLancamentos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => api.lancamentos.removerEmMassa(ids),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success(`${ids.length} lançamento(s) removido(s)!`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover os lançamentos");
    },
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: queryKeys.categorias,
    queryFn: () => api.categorias.listar(),
    staleTime: STALE_10_MIN,
    gcTime: GC_30_MIN,
  });
}

export function useCartoes() {
  return useQuery({
    queryKey: queryKeys.cartoes,
    queryFn: () => api.cartoes.listar(),
    staleTime: STALE_5_MIN,
    gcTime: GC_15_MIN,
  });
}

// ── Perfil Financeiro ──────────────────────────────────────
export function usePerfilFinanceiro() {
  return useQuery({
    queryKey: queryKeys.perfil,
    queryFn: () => api.previsao.perfil(),
    staleTime: STALE_5_MIN,
  });
}

// ── Simulação ──────────────────────────────────────────────
export function useSimularCompra() {
  return useMutation({
    mutationFn: (data: SimularCompraRequest) => api.previsao.simular(data),
    onError: (err: Error) => {
      toast.error(err.message || "Erro na simulação");
    },
  });
}

export function useHistoricoSimulacao() {
  return useQuery({
    queryKey: queryKeys.historicoSimulacao,
    queryFn: () => api.previsao.historico(),
    staleTime: STALE_5_MIN,
    enabled: false, // carrega sob demanda
  });
}

// ── Limites ────────────────────────────────────────────────
export function useLimites() {
  return useQuery({
    queryKey: queryKeys.limites,
    queryFn: () => api.limites.listar(),
    staleTime: STALE_2_MIN,
  });
}

export function useDefinirLimite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DefinirLimiteRequest) => api.limites.definir(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.limites });
      toast.success("Limite definido com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao salvar limite");
    },
  });
}

export function useRemoverLimite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoria: string) => api.limites.remover(categoria),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.limites });
      toast.success("Limite removido");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover");
    },
  });
}

// ── Metas ──────────────────────────────────────────────────
export function useMetas(status?: string) {
  return useQuery({
    queryKey: queryKeys.metas(status),
    queryFn: () => api.metas.listar(status),
    staleTime: STALE_2_MIN,
  });
}

export function useCriarMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CriarMetaRequest) => api.metas.criar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Meta criada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar meta");
    },
  });
}

export function useAtualizarMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AtualizarMetaRequest }) =>
      api.metas.atualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Meta atualizada!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar");
    },
  });
}

export function useRemoverMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.metas.remover(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Meta removida");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover");
    },
  });
}

// ── Cartão ─────────────────────────────────────────────────
export function useCriarCartao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { nome: string; limite: number; diaFechamento: number; diaVencimento: number }) =>
      api.cartoes.criar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
      toast.success("Cartão criado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar cartão");
    },
  });
}

export function useAtualizarCartao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AtualizarCartaoRequest }) =>
      api.cartoes.atualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
      toast.success("Cartão atualizado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar cartão");
    },
  });
}

export function useDesativarCartao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.cartoes.desativar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
      toast.success("Cartão desativado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao desativar cartão");
    },
  });
}

export function useAdicionarLimiteExtra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { valorAdicional: number; percentualExtra: number } }) =>
      api.cartoes.adicionarLimiteExtra(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
      toast.success("Limite extra aplicado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao aplicar limite extra");
    },
  });
}

export function useResgatarLimiteExtra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { valorResgate: number; percentualBonus: number } }) =>
      api.cartoes.resgatarLimiteExtra(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
      toast.success(data?.mensagem || "Limite resgatado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao resgatar limite");
    },
  });
}

export function useFaturas(cartaoId: number) {
  return useQuery({
    queryKey: queryKeys.fatura(cartaoId),
    queryFn: () => api.cartoes.faturas(cartaoId),
    enabled: cartaoId > 0,
    staleTime: STALE_2_MIN,
    retry: false,
  });
}

// ── Categorias CRUD ────────────────────────────────────────
export function useCriarCategoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { nome: string }) => api.categorias.criar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categorias });
      toast.success("Categoria criada!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar categoria");
    },
  });
}

export function useAtualizarCategoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { nome: string } }) =>
      api.categorias.atualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categorias });
      toast.success("Categoria atualizada!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar");
    },
  });
}

export function useRemoverCategoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.categorias.remover(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categorias });
      toast.success("Categoria removida!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover");
    },
  });
}

// ── Perfil ─────────────────────────────────────────────────
export function useAtualizarPerfil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AtualizarPerfilRequest) => api.auth.atualizarPerfil(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.usuario });
      toast.success("Perfil atualizado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar perfil");
    },
  });
}

// ── Lançamentos ────────────────────────────────────────────
export function useCriarLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CriarLancamentoRequest) => api.lancamentos.criar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.limites });
      toast.success("Lançamento registrado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao registrar");
    },
  });
}

// ── Lembretes / Contas Fixas ───────────────────────────────
export function useLembretes(apenasAtivos?: boolean) {
  return useQuery({
    queryKey: queryKeys.lembretes(apenasAtivos),
    queryFn: () => api.lembretes.listar(apenasAtivos),
    staleTime: STALE_2_MIN,
    gcTime: GC_10_MIN,
  });
}

export function useCriarLembrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CriarLembreteRequest) => api.lembretes.criar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lembretes"] });
      toast.success("Lembrete criado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar lembrete");
    },
  });
}

export function useAtualizarLembrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AtualizarLembreteRequest }) =>
      api.lembretes.atualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lembretes"] });
      toast.success("Lembrete atualizado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar lembrete");
    },
  });
}

export function useDesativarLembrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.lembretes.desativar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lembretes"] });
      toast.success("Lembrete desativado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao desativar lembrete");
    },
  });
}

export function usePagarContaFixa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PagarContaFixaRequest }) =>
      api.lembretes.pagar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lembretes"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      toast.success("Pagamento registrado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao registrar pagamento");
    },
  });
}
// ── Contas Bancárias ────────────────────────────────────────
export function useContasBancarias() {
  return useQuery({
    queryKey: queryKeys.contasBancarias,
    queryFn: () => api.contasBancarias.listar(),
    staleTime: STALE_5_MIN,
    gcTime: GC_15_MIN,
  });
}

export function useCriarContaBancaria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CriarContaBancariaRequest) => api.contasBancarias.criar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contasBancarias });
      toast.success("Conta criada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar conta");
    },
  });
}

export function useAtualizarContaBancaria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AtualizarContaBancariaRequest }) =>
      api.contasBancarias.atualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contasBancarias });
      toast.success("Conta atualizada!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar conta");
    },
  });
}

export function useDesativarContaBancaria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.contasBancarias.desativar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contasBancarias });
      toast.success("Conta desativada!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao desativar conta");
    },
  });
}
// ── Decisão de Gasto ───────────────────────────────────────
export function useAvaliarGasto() {
  return useMutation({
    mutationFn: (data: AvaliarGastoRequest) => api.decisao.avaliar(data),
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao avaliar gasto");
    },
  });
}
