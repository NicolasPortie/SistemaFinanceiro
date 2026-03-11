// ============================================================
// Ravier — TanStack Query Hooks
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
  type ConfirmarImportacaoRequest,
  type FamiliaData,
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
  importacaoHistorico: ["importacao-historico"] as const,
  familia: ["familia"] as const,
  familiaRecursos: ["familia-recursos"] as const,
  familiaDashboard: (mes?: number, ano?: number) => ["familia-dashboard", mes, ano] as const,
  familiaCategorias: (mes?: number, ano?: number) => ["familia-categorias", mes, ano] as const,
  familiaEvolucao: (meses?: number) => ["familia-evolucao", meses ?? 6] as const,
  familiaMetas: ["familia-metas"] as const,
  familiaCategoriasComp: ["familia-categorias-comp"] as const,
  familiaOrcamentos: ["familia-orcamentos"] as const,
  familiaConvite: (token: string) => ["familia-convite", token] as const,
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
    staleTime: 0,
    gcTime: GC_30_MIN,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
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
    mutationFn: (data: {
      nome: string;
      limite: number;
      diaFechamento: number;
      diaVencimento: number;
    }) => api.cartoes.criar(data),
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
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { valorAdicional: number; percentualExtra: number };
    }) => api.cartoes.adicionarLimiteExtra(id, data),
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
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { valorResgate: number; percentualBonus: number };
    }) => api.cartoes.resgatarLimiteExtra(id, data),
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

export function useTogglePagaFatura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (faturaId: number) => api.cartoes.togglePagaFatura(faturaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "fatura" });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar fatura");
    },
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

// ── Importação de Extratos ─────────────────────────────────
export function useImportacaoHistorico() {
  return useQuery({
    queryKey: queryKeys.importacaoHistorico,
    queryFn: () => api.importacao.historico(),
    staleTime: STALE_2_MIN,
    gcTime: GC_10_MIN,
  });
}

export function useUploadImportacao() {
  return useMutation({
    mutationFn: (params: {
      arquivo: File;
      tipoImportacao: import("@/lib/api").TipoImportacao;
      contaBancariaId?: number;
      cartaoCreditoId?: number;
      banco?: string;
      forcarReimportacao?: boolean;
      mesFaturaReferencia?: string;
    }) =>
      api.importacao.upload(
        params.arquivo,
        params.tipoImportacao,
        params.contaBancariaId,
        params.cartaoCreditoId,
        params.banco,
        params.forcarReimportacao,
        params.mesFaturaReferencia
      ),
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao processar arquivo");
    },
  });
}

export function useConfirmarImportacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ConfirmarImportacaoRequest) => api.importacao.confirmar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.importacaoHistorico });
      queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
      // Invalidate all fatura queries (any cartão)
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "fatura" });
      toast.success("Importação confirmada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao confirmar importação");
    },
  });
}

// ── Família ────────────────────────────────────────────────────────
export function useFamilia() {
  return useQuery({
    queryKey: queryKeys.familia,
    queryFn: async () => {
      const res = await api.familia.obter();
      if ("familia" in res && res.familia === null) return null;
      return res as FamiliaData;
    },
    staleTime: STALE_2_MIN,
    gcTime: GC_10_MIN,
  });
}

export function useEnviarConviteFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.familia.enviarConvite(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familia });
      toast.success("Convite enviado!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao enviar convite"),
  });
}

export function useCancelarConviteFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.familia.cancelarConvite(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familia });
      toast.success("Convite cancelado!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao cancelar convite"),
  });
}

export function useAceitarConviteFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.familia.aceitarConvite(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familia });
      toast.success("Convite aceito! Você agora faz parte da família.");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao aceitar convite"),
  });
}

export function useRecusarConviteFamilia() {
  return useMutation({
    mutationFn: (token: string) => api.familia.recusarConvite(token),
    onSuccess: () => toast.success("Convite recusado."),
    onError: (err: Error) => toast.error(err.message || "Erro ao recusar convite"),
  });
}

export function useRemoverMembroFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.familia.removerMembro(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familia });
      toast.success("Membro removido da família.");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao remover membro"),
  });
}

export function useSairDaFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.familia.sair(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familia });
      toast.success("Você saiu da família.");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao sair da família"),
  });
}

export function useFamiliaRecursos() {
  const { data: familia } = useFamilia();
  return useQuery({
    queryKey: queryKeys.familiaRecursos,
    queryFn: () => api.familia.listarRecursos(),
    staleTime: STALE_2_MIN,
    enabled: !!familia,
  });
}

export function useAtivarRecursoFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recurso: string) => api.familia.ativarRecurso(recurso),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familia });
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaRecursos });
      toast.success("Recurso solicitado! Aguardando aceite do membro.");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao ativar recurso"),
  });
}

export function useAceitarRecursoFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recurso: string) => api.familia.aceitarRecurso(recurso),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familia });
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaRecursos });
      toast.success("Recurso aceito e ativado!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao aceitar recurso"),
  });
}

export function useRecusarRecursoFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recurso: string) => api.familia.recusarRecurso(recurso),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaRecursos });
      toast.success("Recurso recusado.");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao recusar recurso"),
  });
}

export function useDesativarRecursoFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recurso: string) => api.familia.desativarRecurso(recurso),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familia });
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaRecursos });
      toast.success("Recurso desativado.");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao desativar recurso"),
  });
}

export function useFamiliaDashboard(mes?: number, ano?: number) {
  const { data: familia } = useFamilia();
  const isActive = familia?.status === "Ativa" && !!familia?.membroId;
  return useQuery({
    queryKey: queryKeys.familiaDashboard(mes, ano),
    queryFn: () => api.familia.dashboardResumo(mes, ano),
    staleTime: STALE_2_MIN,
    enabled: isActive,
  });
}

export function useFamiliaDashboardCategorias(mes?: number, ano?: number) {
  const { data: familia } = useFamilia();
  const isActive = familia?.status === "Ativa" && !!familia?.membroId;
  return useQuery({
    queryKey: queryKeys.familiaCategorias(mes, ano),
    queryFn: () => api.familia.dashboardCategorias(mes, ano),
    staleTime: STALE_2_MIN,
    enabled: isActive,
  });
}

export function useFamiliaEvolucao(meses?: number) {
  const { data: familia } = useFamilia();
  const isActive = familia?.status === "Ativa" && !!familia?.membroId;
  return useQuery({
    queryKey: queryKeys.familiaEvolucao(meses),
    queryFn: () => api.familia.dashboardEvolucao(meses),
    staleTime: STALE_5_MIN,
    enabled: isActive,
  });
}

export function useFamiliaMetas() {
  const { data: familia } = useFamilia();
  const isActive = familia?.status === "Ativa" && !!familia?.membroId;
  return useQuery({
    queryKey: queryKeys.familiaMetas,
    queryFn: () => api.familia.listarMetas(),
    staleTime: STALE_2_MIN,
    enabled: isActive,
  });
}

export function useCriarMetaFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CriarMetaRequest) => api.familia.criarMeta(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaMetas });
      toast.success("Meta conjunta criada!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao criar meta"),
  });
}

export function useAtualizarValorMetaFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, valorAtual }: { id: number; valorAtual: number }) =>
      api.familia.atualizarValorMeta(id, valorAtual),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaMetas });
      toast.success("Meta atualizada!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao atualizar meta"),
  });
}

export function useRemoverMetaFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.familia.removerMeta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaMetas });
      toast.success("Meta removida!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao remover meta"),
  });
}

export function useFamiliaCategoriasComp() {
  const { data: familia } = useFamilia();
  const isActive = familia?.status === "Ativa" && !!familia?.membroId;
  return useQuery({
    queryKey: queryKeys.familiaCategoriasComp,
    queryFn: () => api.familia.listarCategorias(),
    staleTime: STALE_2_MIN,
    enabled: isActive,
  });
}

export function useCriarCategoriaFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => api.familia.criarCategoria(nome),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaCategoriasComp });
      toast.success("Categoria compartilhada criada!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao criar categoria"),
  });
}

export function useAtualizarCategoriaFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: number; nome: string }) =>
      api.familia.atualizarCategoria(id, nome),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaCategoriasComp });
      toast.success("Categoria atualizada!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao atualizar categoria"),
  });
}

export function useRemoverCategoriaFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.familia.removerCategoria(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaCategoriasComp });
      toast.success("Categoria descompartilhada!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao remover categoria"),
  });
}

export function useFamiliaOrcamentos() {
  const { data: familia } = useFamilia();
  const isActive = familia?.status === "Ativa" && !!familia?.membroId;
  return useQuery({
    queryKey: queryKeys.familiaOrcamentos,
    queryFn: () => api.familia.listarOrcamentos(),
    staleTime: STALE_2_MIN,
    enabled: isActive,
  });
}

export function useCriarOrcamentoFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { categoriaId: number; valorLimite: number }) =>
      api.familia.criarOrcamento(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaOrcamentos });
      toast.success("Orçamento familiar criado!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao criar orçamento"),
  });
}

export function useAtualizarOrcamentoFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { valorLimite: number; ativo: boolean } }) =>
      api.familia.atualizarOrcamento(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaOrcamentos });
      toast.success("Orçamento atualizado!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao atualizar orçamento"),
  });
}

export function useRemoverOrcamentoFamilia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.familia.removerOrcamento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.familiaOrcamentos });
      toast.success("Orçamento removido!");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao remover orçamento"),
  });
}
