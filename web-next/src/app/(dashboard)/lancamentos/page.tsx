"use client";

import { useState, useMemo } from "react";
import {
  useResumo,
  useCategorias,
  useCartoes,
  useCriarLancamento,
  useLancamentos,
  useAtualizarLancamento,
  useRemoverLancamento,
  queryKeys,
} from "@/hooks/use-queries";
import { formatCurrency, formatDate, formatFormaPagamento } from "@/lib/format";
import {
  lancamentoSchema,
  editarLancamentoSchema,
  type LancamentoData,
  type EditarLancamentoData,
} from "@/lib/schemas";
import type { Lancamento } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Receipt,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Calendar,
  Tag,
  SlidersHorizontal,
  RefreshCw,
  DollarSign,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  StatCard,
  EmptyState,
  ErrorState,
  CardSkeleton,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";

// ── Category Colors ──────────────────────────────────────────
const categoryColorMap: Record<string, string> = {
  "Alimentação": "bg-orange-500",
  "Transporte": "bg-blue-500",
  "Moradia": "bg-violet-500",
  "Lazer": "bg-pink-500",
  "Saúde": "bg-emerald-500",
  "Educação": "bg-cyan-500",
  "Salário": "bg-emerald-500",
  "Roupas": "bg-rose-500",
  "Outros": "bg-gray-500",
};

function getCategoryColor(cat: string) {
  return categoryColorMap[cat] || "bg-primary";
}

// ── Payment Method Icons ─────────────────────────────────────
function PaymentIcon({ method, className = "h-3.5 w-3.5" }: { method: string; className?: string }) {
  const m = method?.toLowerCase();
  if (m === "pix") return <Smartphone className={className} />;
  if (m === "credito" || m === "cartão de crédito") return <CreditCard className={className} />;
  return <Banknote className={className} />;
}

export default function LancamentosPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Lancamento | null>(null);
  const [viewingItem, setViewingItem] = useState<Lancamento | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const queryClient = useQueryClient();

  const { data: resumo, isLoading: loadingResumo, isError, error } = useResumo();
  const { data: categorias = [] } = useCategorias();
  const { data: cartoes = [] } = useCartoes();
  const criarLancamento = useCriarLancamento();
  const atualizarLancamento = useAtualizarLancamento();
  const removerLancamento = useRemoverLancamento();

  const listParams = useMemo(
    () => ({
      tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
      categoriaId:
        filtroCategoria !== "todas"
          ? categorias.find((c) => c.nome === filtroCategoria)?.id
          : undefined,
      busca: busca.trim() ? busca.trim() : undefined,
      pagina,
      tamanhoPagina: 20,
    }),
    [filtroTipo, filtroCategoria, busca, pagina, categorias]
  );

  const { data: lancamentosData, isLoading: loadingLancamentos } = useLancamentos(listParams);

  const form = useForm<LancamentoData>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: { descricao: "", valor: "", tipo: "despesa", categoria: "", cartaoId: "", formaPagamento: "", numeroParcelas: "" },
  });

  const editForm = useForm<EditarLancamentoData>({
    resolver: zodResolver(editarLancamentoSchema),
  });

  const tipoSelecionado = useWatch({ control: form.control, name: "tipo" });
  const categoriaSelecionada = useWatch({ control: form.control, name: "categoria" });
  const cartaoSelecionado = useWatch({ control: form.control, name: "cartaoId" });
  const formaPagamentoSelecionada = useWatch({ control: form.control, name: "formaPagamento" });

  const activeFilters = (filtroTipo !== "todos" ? 1 : 0) + (filtroCategoria !== "todas" ? 1 : 0) + (busca.trim() ? 1 : 0);

  const onSubmit = async (data: LancamentoData) => {
    const valor = parseFloat(data.valor.replace(",", "."));

    let formaPagamento: 1 | 2 | 3 = 2;
    let cartaoId: number | undefined;
    let parcelas = 1;

    if (data.tipo === "receita") {
      formaPagamento = 1;
    } else if (data.formaPagamento === "credito") {
      formaPagamento = 3;
      cartaoId = data.cartaoId ? parseInt(data.cartaoId, 10) : undefined;
      parcelas = data.numeroParcelas ? parseInt(data.numeroParcelas, 10) : 1;
      if (parcelas < 1 || isNaN(parcelas)) parcelas = 1;
    } else if (data.formaPagamento === "pix") {
      formaPagamento = 1;
    } else if (data.formaPagamento === "debito") {
      formaPagamento = 2;
    }

    criarLancamento.mutate(
      {
        descricao: data.descricao,
        valor,
        tipo: data.tipo === "despesa" ? 1 : 2,
        formaPagamento,
        categoria: data.categoria || "Outros",
        numeroParcelas: parcelas,
        cartaoCreditoId: cartaoId,
        data: data.data || undefined,
      },
      {
        onSuccess: () => {
          form.reset();
          setShowForm(false);
        },
      }
    );
  };

  const onEdit = async (data: EditarLancamentoData) => {
    if (!editingItem) return;
    atualizarLancamento.mutate(
      {
        id: editingItem.id,
        data: {
          descricao: data.descricao,
          valor: parseFloat(data.valor.replace(",", ".")),
          categoria: data.categoria || undefined,
          data: data.data || undefined,
        },
      },
      { onSuccess: () => setEditingItem(null) }
    );
  };

  const onDelete = () => {
    if (deletingId === null) return;
    removerLancamento.mutate(deletingId, { onSuccess: () => setDeletingId(null) });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.resumo() });
    queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
  };

  const openEdit = (lancamento: Lancamento) => {
    editForm.reset({
      descricao: lancamento.descricao,
      valor: lancamento.valor.toFixed(2).replace(".", ","),
      categoria: lancamento.categoria,
      data: lancamento.data?.split("T")[0] ?? "",
    });
    setEditingItem(lancamento);
  };

  const clearFilters = () => {
    setFiltroTipo("todos");
    setFiltroCategoria("todas");
    setBusca("");
    setPagina(1);
  };

  return (
    <PageShell>
      {/* ── Page Header ── */}
      <PageHeader title="Lançamentos" description="Gerencie todas as suas receitas e despesas">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar dados</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button onClick={() => setShowForm(true)} className="gap-2 h-10 px-3 sm:px-5 rounded-xl shadow-premium font-semibold">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Lançamento</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </PageHeader>

      {/* ── Stats Overview ── */}
      {loadingResumo ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={handleRefresh} />
      ) : resumo ? (
        <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Receitas"
            value={formatCurrency(resumo.totalReceitas)}
            icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="up"
            delay={0}
          />
          <StatCard
            title="Despesas"
            value={formatCurrency(resumo.totalGastos)}
            icon={<TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="down"
            delay={1}
          />
          <StatCard
            title="Saldo"
            value={formatCurrency(resumo.saldo)}
            subtitle={resumo.saldo >= 0 ? "Positivo" : "Negativo"}
            icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend={resumo.saldo >= 0 ? "up" : "down"}
            delay={2}
          />
          <StatCard
            title="Transações"
            value={lancamentosData?.total ?? 0}
            subtitle="Este mês"
            icon={<Receipt className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="neutral"
            delay={3}
          />
        </div>
      ) : null}

      {/* ── Toolbar: Search + Filters ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-premium"
      >
        <div className="p-3 sm:p-4 flex flex-col lg:flex-row items-start lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Buscar lançamentos..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
              className="pl-9 h-10 rounded-xl bg-muted/30 border-transparent focus:border-primary/30 focus:bg-card transition-all"
            />
            {busca && (
              <button onClick={() => { setBusca(""); setPagina(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" aria-label="Limpar busca">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Separator orientation="vertical" className="h-6 hidden lg:block" />

          {/* Filter pills */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground/60 hidden sm:block" />
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => { setFiltroTipo("todos"); setPagina(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filtroTipo === "todos" ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                Todos
              </button>
              <button
                onClick={() => { setFiltroTipo("receita"); setPagina(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${filtroTipo === "receita" ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <ArrowUpCircle className="h-3 w-3" />
                Receitas
              </button>
              <button
                onClick={() => { setFiltroTipo("gasto"); setPagina(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${filtroTipo === "gasto" ? "bg-red-500 text-white shadow-sm shadow-red-500/25" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <ArrowDownCircle className="h-3 w-3" />
                Despesas
              </button>
            </div>

            <Select value={filtroCategoria} onValueChange={(v) => { setFiltroCategoria(v); setPagina(1); }}>
              <SelectTrigger className="w-full sm:w-40 h-8 rounded-lg text-xs border-transparent bg-muted/50 hover:bg-muted">
                <Tag className="h-3 w-3 mr-1.5 text-muted-foreground/60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeFilters > 0 && (
              <button
                onClick={clearFilters}
                className="ml-1 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="h-3 w-3" />
                Limpar ({activeFilters})
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Transaction Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card-premium overflow-hidden"
      >
        {/* Table header */}
        <div className="hidden lg:grid lg:grid-cols-[2.5fr_1fr_1fr_1fr_0.8fr_auto] gap-4 items-center px-6 py-3 border-b border-border/50 bg-muted/30">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Descrição</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Categoria</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Pagamento</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Data</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 text-right">Valor</span>
          <span className="w-24" />
        </div>

        {loadingLancamentos ? (
          <div className="p-6 sm:p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando lançamentos...</p>
          </div>
        ) : lancamentosData && lancamentosData.items.length > 0 ? (
          <>
            <div className="divide-y divide-border/30">
              <AnimatePresence>
                {lancamentosData.items.map((l, i) => (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.015 * i }}
                    className="group"
                  >
                    {/* Desktop row */}
                    <div
                      className="hidden lg:grid lg:grid-cols-[2.5fr_1fr_1fr_1fr_0.8fr_auto] gap-4 items-center px-6 py-3.5 hover:bg-muted/20 transition-all duration-200 cursor-pointer"
                      onClick={() => setViewingItem(l)}
                    >
                      {/* Description + type indicator */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${l.tipo === "receita" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"}`}>
                          {l.tipo === "receita" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold truncate">{l.descricao}</p>
                          {l.parcelado && (
                            <p className="text-[11px] text-muted-foreground/60 font-medium">{l.numeroParcelas}x de {formatCurrency(l.valor / l.numeroParcelas)}</p>
                          )}
                        </div>
                      </div>

                      {/* Category */}
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${getCategoryColor(l.categoria)}`} />
                        <span className="text-[13px] text-muted-foreground font-medium truncate">{l.categoria}</span>
                      </div>

                      {/* Payment method */}
                      <div className="flex items-center gap-2">
                        <PaymentIcon method={l.formaPagamento} className="h-3.5 w-3.5 text-muted-foreground/60" />
                        <span className="text-[13px] text-muted-foreground font-medium">{formatFormaPagamento(l.formaPagamento)}</span>
                      </div>

                      {/* Date */}
                      <span className="text-[13px] text-muted-foreground/80 font-medium tabular-nums">{formatDate(l.data)}</span>

                      {/* Value */}
                      <span className={`text-sm font-bold tabular-nums text-right whitespace-nowrap ${l.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {l.tipo === "receita" ? "+" : "−"} {formatCurrency(l.valor)}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-0.5 w-24 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(l)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeletingId(l.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div
                      className="lg:hidden flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setViewingItem(l)}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${l.tipo === "receita" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"}`}>
                        {l.tipo === "receita" ? <ArrowUpCircle className="h-4.5 w-4.5" /> : <ArrowDownCircle className="h-4.5 w-4.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{l.descricao}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground/60 font-medium">{formatDate(l.data)}</span>
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <span className="text-[11px] text-muted-foreground/60 font-medium">{l.categoria}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-sm font-bold tabular-nums ${l.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {l.tipo === "receita" ? "+" : "−"} {formatCurrency(l.valor)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {lancamentosData.totalPaginas > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-t border-border/30 bg-muted/10">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-muted-foreground font-medium tabular-nums">
                    {lancamentosData.total} lançamento{lancamentosData.total !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[12px] text-muted-foreground/40 hidden sm:inline">·</span>
                  <span className="text-[12px] text-muted-foreground font-medium tabular-nums hidden sm:inline">
                    Página {lancamentosData.pagina} de {lancamentosData.totalPaginas}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs gap-1.5"
                    disabled={pagina <= 1}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-lg text-xs gap-1.5"
                    disabled={pagina >= lancamentosData.totalPaginas}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Próxima
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-6 sm:p-12">
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="Nenhum lançamento encontrado"
              description={activeFilters > 0 ? "Tente remover os filtros para ver mais resultados" : "Registre seu primeiro lançamento para começar a controlar suas finanças"}
              action={
                activeFilters > 0 ? (
                  <Button variant="outline" onClick={clearFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    Limpar filtros
                  </Button>
                ) : (
                  <Button onClick={() => setShowForm(true)} className="gap-2 shadow-premium">
                    <Plus className="h-4 w-4" />
                    Registrar lançamento
                  </Button>
                )
              }
            />
          </div>
        )}
      </motion.div>

      {/* ── New Transaction Sheet (Side Panel) ── */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4 sm:pb-6">
            <SheetTitle className="text-xl sm:text-2xl font-extrabold tracking-tight">Novo Lançamento</SheetTitle>
            <SheetDescription className="text-muted-foreground/70">Registre uma nova receita ou despesa</SheetDescription>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { form.setValue("tipo", "receita"); form.setValue("cartaoId", ""); form.setValue("formaPagamento", ""); form.setValue("numeroParcelas", ""); }}
                className={`flex items-center justify-center gap-2.5 h-[3.75rem] rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer ${tipoSelecionado === "receita"
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 scale-[1.02] ring-2 ring-emerald-400/20"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60 border border-border/40 hover:border-border/60"
                }`}
              >
                <ArrowUpCircle className="h-5 w-5" />
                Receita
              </button>
              <button
                type="button"
                onClick={() => form.setValue("tipo", "despesa")}
                className={`flex items-center justify-center gap-2.5 h-[3.75rem] rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer ${tipoSelecionado === "despesa"
                  ? "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 scale-[1.02] ring-2 ring-red-400/20"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60 border border-border/40 hover:border-border/60"
                }`}
              >
                <ArrowDownCircle className="h-5 w-5" />
                Despesa
              </button>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Input placeholder="Ex: Supermercado, Salário..." className="h-11 rounded-xl" {...form.register("descricao")} />
              {form.formState.errors.descricao && <p className="text-xs text-red-500 font-medium">{form.formState.errors.descricao.message}</p>}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input placeholder="0,00" className="h-11 rounded-xl pl-9 text-lg tabular-nums font-semibold" {...form.register("valor")} />
              </div>
              {form.formState.errors.valor && <p className="text-xs text-red-500 font-medium">{form.formState.errors.valor.message}</p>}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
              <Select value={categoriaSelecionada} onValueChange={(v) => form.setValue("categoria", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.nome}>
                      <span className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${getCategoryColor(c.nome)}`} />
                        {c.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment method (expenses only) */}
            {tipoSelecionado === "despesa" && (
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de Pagamento</Label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { form.setValue("formaPagamento", "pix"); form.setValue("cartaoId", ""); form.setValue("numeroParcelas", ""); }}
                    className={`flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl text-xs font-bold transition-all duration-300 cursor-pointer ${formaPagamentoSelecionada === "pix" ? "bg-primary/10 text-primary border-2 border-primary/30 shadow-md shadow-primary/5 scale-[1.02]" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40 hover:border-border/60"}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
                      <Smartphone className="h-4.5 w-4.5" />
                    </div>
                    PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => { form.setValue("formaPagamento", "debito"); form.setValue("cartaoId", ""); form.setValue("numeroParcelas", ""); }}
                    className={`flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl text-xs font-bold transition-all duration-300 cursor-pointer ${formaPagamentoSelecionada === "debito" ? "bg-primary/10 text-primary border-2 border-primary/30 shadow-md shadow-primary/5 scale-[1.02]" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40 hover:border-border/60"}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
                      <Banknote className="h-4.5 w-4.5" />
                    </div>
                    Débito
                  </button>
                  {cartoes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => form.setValue("formaPagamento", "credito")}
                      className={`flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl text-xs font-bold transition-all duration-300 cursor-pointer ${formaPagamentoSelecionada === "credito" ? "bg-primary/10 text-primary border-2 border-primary/30 shadow-md shadow-primary/5 scale-[1.02]" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40 hover:border-border/60"}`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
                        <CreditCard className="h-4.5 w-4.5" />
                      </div>
                      Crédito
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card + Installments (credit only) */}
            {tipoSelecionado === "despesa" && formaPagamentoSelecionada === "credito" && cartoes.length > 0 && (
              <div className="space-y-4 p-5 rounded-2xl bg-muted/15 border border-border/25 shadow-sm">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cartão</Label>
                  <Select value={cartaoSelecionado} onValueChange={(v) => form.setValue("cartaoId", v)}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                    <SelectContent>{cartoes.map((c) => (<SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parcelas</Label>
                  <Select value={form.watch("numeroParcelas") ?? ""} onValueChange={(v) => form.setValue("numeroParcelas", v)}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="À vista (1x)" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}x{n === 1 ? " (à vista)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data (opcional)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input type="date" className="h-11 rounded-xl pl-9" {...form.register("data")} />
              </div>
            </div>

            <Separator />

            {/* Submit */}
            <Button type="submit" className="w-full h-13 rounded-2xl gap-2.5 font-bold text-[15px] shadow-premium btn-premium" disabled={criarLancamento.isPending}>
              {criarLancamento.isPending ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <>
                  <Receipt className="h-4.5 w-4.5" />
                  Registrar Lançamento
                </>
              )}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Edit Dialog ── */}
      <Dialog open={editingItem !== null} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Lançamento</DialogTitle>
            <DialogDescription>Altere os dados do lançamento</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-5">
            {editingItem && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${editingItem.tipo === "receita" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"}`}>
                  {editingItem.tipo === "receita" ? <ArrowUpCircle className="h-4.5 w-4.5" /> : <ArrowDownCircle className="h-4.5 w-4.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider">{editingItem.tipo}</span>
                  <span className="text-xs text-muted-foreground ml-2">· {formatFormaPagamento(editingItem.formaPagamento)}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Input className="h-11 rounded-xl" {...editForm.register("descricao")} />
              {editForm.formState.errors.descricao && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.descricao.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input className="h-11 rounded-xl pl-9 text-lg tabular-nums font-semibold" {...editForm.register("valor")} />
              </div>
              {editForm.formState.errors.valor && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.valor.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
              <Select value={editForm.watch("categoria") ?? ""} onValueChange={(v) => editForm.setValue("categoria", v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categorias.map((c) => (<SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input type="date" className="h-11 rounded-xl pl-9" {...editForm.register("data")} />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl gap-2 font-bold shadow-premium" disabled={atualizarLancamento.isPending}>
              {atualizarLancamento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── View Detail Dialog ── */}
      <Dialog open={viewingItem !== null} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Detalhes do Lançamento</DialogTitle>
            <DialogDescription>Informações completas</DialogDescription>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-5">
              {/* Header card */}
              <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl bg-muted/20 border border-border/30">
                <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl shrink-0 ${viewingItem.tipo === "receita" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"}`}>
                  {viewingItem.tipo === "receita" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-sm sm:text-base">{viewingItem.descricao}</p>
                  <Badge variant={viewingItem.tipo === "receita" ? "default" : "destructive"} className="text-[11px] mt-1 capitalize">{viewingItem.tipo}</Badge>
                </div>
                <span className={`text-base sm:text-xl font-extrabold tabular-nums shrink-0 ${viewingItem.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {viewingItem.tipo === "receita" ? "+" : "−"} {formatCurrency(viewingItem.valor)}
                </span>
              </div>

              {/* Detail grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Categoria</span>
                  </div>
                  <p className="text-sm font-semibold">{viewingItem.categoria}</p>
                </div>

                <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <PaymentIcon method={viewingItem.formaPagamento} className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Pagamento</span>
                  </div>
                  <p className="text-sm font-semibold">{formatFormaPagamento(viewingItem.formaPagamento)}</p>
                </div>

                <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Data</span>
                  </div>
                  <p className="text-sm font-semibold">{formatDate(viewingItem.data)}</p>
                </div>

                {viewingItem.parcelado && (
                  <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Parcelas</span>
                    </div>
                    <p className="text-sm font-semibold">{viewingItem.numeroParcelas}x de {formatCurrency(viewingItem.valor / viewingItem.numeroParcelas)}</p>
                  </div>
                )}

                {viewingItem.criadoEm && (
                  <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Criado em</span>
                    </div>
                    <p className="text-sm font-semibold">{formatDate(viewingItem.criadoEm)}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 h-10 rounded-xl font-semibold" onClick={() => { setViewingItem(null); openEdit(viewingItem); }}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button variant="destructive" className="flex-1 gap-2 h-10 rounded-xl font-semibold" onClick={() => { setViewingItem(null); setDeletingId(viewingItem.id); }}>
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O lançamento será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              {removerLancamento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
