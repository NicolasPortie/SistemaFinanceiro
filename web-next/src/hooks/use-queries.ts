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
} from "@/lib/api";
import { toast } from "sonner";

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
};

// ── Dashboard ──────────────────────────────────────────────
export function useResumo(mes?: string) {
  return useQuery({
    queryKey: queryKeys.resumo(mes),
    queryFn: () => api.lancamentos.resumo(mes),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
      staleTime: 10 * 60 * 1000,
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
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
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

export function useCategorias() {
  return useQuery({
    queryKey: queryKeys.categorias,
    queryFn: () => api.categorias.listar(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useCartoes() {
  return useQuery({
    queryKey: queryKeys.cartoes,
    queryFn: () => api.cartoes.listar(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ── Perfil Financeiro ──────────────────────────────────────
export function usePerfilFinanceiro() {
  return useQuery({
    queryKey: queryKeys.perfil,
    queryFn: () => api.previsao.perfil(),
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
    enabled: false, // carrega sob demanda
  });
}

// ── Limites ────────────────────────────────────────────────
export function useLimites() {
  return useQuery({
    queryKey: queryKeys.limites,
    queryFn: () => api.limites.listar(),
    staleTime: 2 * 60 * 1000,
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
    staleTime: 2 * 60 * 1000,
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
    mutationFn: (data: { nome: string; limite: number; diaVencimento: number }) =>
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

export function useFaturas(cartaoId: number) {
  return useQuery({
    queryKey: queryKeys.fatura(cartaoId),
    queryFn: () => api.cartoes.faturas(cartaoId),
    enabled: cartaoId > 0,
    staleTime: 2 * 60 * 1000,
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
