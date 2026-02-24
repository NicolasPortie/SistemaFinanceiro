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
  useRemoverVariosLancamentos,
  queryKeys,
} from "@/hooks/use-queries";
import { formatCurrency, formatDate, formatFormaPagamento } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
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
  CalendarDays,
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
import { CurrencyInput } from "@/components/ui/currency-input";
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

// ── Month Selector Hook ──────────────────────────────────────
const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function useMonthSelector() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const mesParam = isCurrentMonth ? undefined : `${year}-${String(month + 1).padStart(2, "0")}`;
  const label = `${meses[month]} ${year}`;

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const next = () => {
    // Optionally allow future months, or block it. Let's allow it for future provisions.
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const reset = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  // Calculate first and last day for the `de` and `ate` API parameters
  const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-${lastDayOfMonth}`;

  // Use standard month selector behaviors without isAllTime
  return { mesParam, label, isCurrentMonth, prev, next, reset, firstDay, lastDay };
}

export default function LancamentosPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Lancamento | null>(null);
  const [viewingItem, setViewingItem] = useState<Lancamento | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingMany, setDeletingMany] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const queryClient = useQueryClient();

  const { label, isCurrentMonth, prev, next, reset, firstDay, lastDay, mesParam } = useMonthSelector();

  const { data: resumo, isLoading: loadingResumo, isError, error } = useResumo(mesParam);
  const { data: categorias = [] } = useCategorias();
  const { data: cartoes = [] } = useCartoes();
  const criarLancamento = useCriarLancamento();
  const atualizarLancamento = useAtualizarLancamento();
  const removerLancamento = useRemoverLancamento();
  const removerVariosLancamentos = useRemoverVariosLancamentos();

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
      de: firstDay,
      ate: lastDay,
    }),
    [filtroTipo, filtroCategoria, busca, pagina, categorias, firstDay, lastDay]
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

  const onDeleteMany = () => {
    if (selectedIds.length === 0) return;
    removerVariosLancamentos.mutate(selectedIds, {
      onSuccess: () => {
        setDeletingMany(false);
        setSelectedIds([]);
      }
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!lancamentosData) return;
    if (checked) {
      setSelectedIds(lancamentosData.items.map((l) => l.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectRow = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
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
        <Button onClick={() => setShowForm(true)} className="gap-2 h-10 px-3 sm:px-5 rounded-xl shadow-premium font-semibold bg-emerald-600 hover:bg-emerald-500 text-white">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Lançamento</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </PageHeader>

      {/* ── Month Selector ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4 }}
        className="flex items-center justify-center gap-2.5 mb-4 sm:mb-6"
      >
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/30 shadow-sm hover:shadow-md transition-all duration-300" onClick={prev} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button
          onClick={reset}
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-card border border-border/30 hover:border-primary/25 hover:shadow-md transition-all duration-300 min-w-36 sm:min-w-45 justify-center shadow-sm group"
        >
          <CalendarDays className="h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-105" />
          <span className="text-sm font-bold tracking-tight">{label}</span>
          {!isCurrentMonth && (
            <span className="text-[10px] text-primary ml-0.5 font-semibold">(atual)</span>
          )}
        </button>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/30 shadow-sm hover:shadow-md transition-all duration-300" onClick={next} disabled={isCurrentMonth} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* ── Bulk Actions Bar ── */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4"
          >
            <div className="flex items-center justify-between p-3 px-4 rounded-xl border border-primary/20 bg-primary/5 text-primary">
              <span className="text-sm font-semibold">
                {selectedIds.length} {selectedIds.length === 1 ? "lançamento selecionado" : "lançamentos selecionados"}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="hover:bg-primary/10">
                  Cancelar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeletingMany(true)} className="gap-2 shadow-sm">
                  <Trash2 className="h-4 w-4" />
                  Excluir Selecionados
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats Overview ── */}
      {loadingResumo ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={handleRefresh} />
      ) : resumo ? (
        <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-6">
          <StatCard
            title="Receitas do Mês"
            value={formatCurrency(resumo.totalReceitas)}
            icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="up"
            delay={0}
          />
          <StatCard
            title="Gastos do Mês"
            value={formatCurrency(resumo.totalGastos)}
            icon={<TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="down"
            delay={1}
          />
          <StatCard
            title="Saldo do Mês"
            value={formatCurrency(resumo.saldo)}
            subtitle={resumo.saldo > 0 ? "Superávit" : resumo.saldo < 0 ? "Déficit" : "Equilibrado"}
            icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend={resumo.saldo > 0 ? "up" : resumo.saldo < 0 ? "down" : "neutral"}
            delay={2}
          />
          <StatCard
            title="Total de Transações"
            value={lancamentosData?.total ?? 0}
            subtitle="Neste mês"
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
        <div className="p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full md:max-w-sm">
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

          <Separator orientation="vertical" className="h-6 hidden md:block" />

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
              <SelectTrigger className="w-full sm:w-56 h-8 rounded-lg text-xs border-transparent bg-muted/50 hover:bg-muted min-w-0">
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
        <div className="hidden lg:grid lg:grid-cols-[auto_2.5fr_1fr_1fr_1fr_0.8fr_auto] gap-4 items-center px-6 py-3 border-b border-border/50 bg-muted/30">
          <div className="pr-2">
            <Checkbox
              checked={!!lancamentosData?.items?.length && selectedIds.length === lancamentosData.items.length}
              onCheckedChange={(c: boolean) => toggleSelectAll(c)}
              aria-label="Selecionar todos os lançamentos"
            />
          </div>
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
                      className={`hidden lg:grid lg:grid-cols-[auto_2.5fr_1fr_1fr_1fr_0.8fr_auto] gap-4 items-center px-6 py-3.5 transition-all duration-200 cursor-pointer ${selectedIds.includes(l.id) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/20"
                        }`}
                      onClick={() => setViewingItem(l)}
                    >
                      <div className="pr-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(l.id)}
                          onCheckedChange={(c: boolean) => toggleSelectRow(l.id, c)}
                          aria-label={`Selecionar lançamento ${l.descricao}`}
                        />
                      </div>
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

                    {/* Mobile card (Premium layout) */}
                    <div
                      className={`lg:hidden flex flex-col gap-3 p-4 sm:p-5 border-b border-border/40 transition-colors cursor-pointer active:scale-[0.99] ${selectedIds.includes(l.id) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/10"
                        }`}
                      onClick={() => setViewingItem(l)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 w-full min-w-0">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.includes(l.id)}
                              onCheckedChange={(c: boolean) => toggleSelectRow(l.id, c)}
                              aria-label={`Selecionar lançamento ${l.descricao}`}
                              className="w-5 h-5 rounded-md"
                            />
                          </div>
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-sm ${l.tipo === "receita" ? "from-emerald-400 to-emerald-500 text-white dark:from-emerald-500/20 dark:to-emerald-500/10 dark:text-emerald-400" : "from-red-400 to-red-500 text-white dark:from-red-500/20 dark:to-red-500/10 dark:text-red-400"}`}>
                            {l.tipo === "receita" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-foreground truncate">{l.descricao}</p>
                            <p className="text-[12px] text-muted-foreground/80 font-medium truncate mt-0.5">{l.categoria}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`block text-[15px] font-extrabold tabular-nums tracking-tight ${l.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {l.tipo === "receita" ? "+" : "−"} {formatCurrency(l.valor)}
                          </span>
                          <span className="block text-[11px] font-semibold text-muted-foreground/60 mt-1">{formatDate(l.data)}</span>
                        </div>
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
        <SheetContent className="w-full sm:w-125 sm:max-w-125 overflow-hidden">
          {/* Gradient accent line at top */}
          <div className={`h-1 w-full shrink-0 ${tipoSelecionado === "receita" ? "bg-linear-to-r from-emerald-400 via-emerald-500 to-teal-500" : "bg-linear-to-r from-red-400 via-red-500 to-rose-500"} transition-all duration-500`} />

          {/* Header */}
          <SheetHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-500 ${tipoSelecionado === "receita" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg sm:text-xl font-semibold">Novo Lançamento</SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">Registre uma nova movimentação financeira</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={form.handleSubmit(onSubmit)} className="px-5 sm:px-7 pb-8 space-y-4 sm:space-y-5">

              {/* ── Type selector — animated toggle ── */}
              <div className="relative flex p-1 rounded-xl bg-muted/40">
                {/* Sliding indicator */}
                <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out ${tipoSelecionado === "receita" ? "left-1 bg-emerald-500 shadow-lg shadow-emerald-500/25" : "left-[calc(50%+3px)] bg-red-500 shadow-lg shadow-red-500/25"}`} />
                <button
                  type="button"
                  onClick={() => { form.setValue("tipo", "receita"); form.setValue("cartaoId", ""); form.setValue("formaPagamento", ""); form.setValue("numeroParcelas", ""); }}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 cursor-pointer ${tipoSelecionado === "receita" ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Receita
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("tipo", "despesa")}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 cursor-pointer ${tipoSelecionado === "despesa" ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <ArrowDownCircle className="h-4 w-4" />
                  Despesa
                </button>
              </div>

              {/* ── Main fields section ── */}
              <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Descrição</Label>
                  <Input placeholder="Ex: Supermercado, Salário..." className="h-11 rounded-xl border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" {...form.register("descricao")} />
                  {form.formState.errors.descricao && <p className="text-xs text-red-500 font-medium">{form.formState.errors.descricao.message}</p>}
                </div>

                {/* Amount with currency mask */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor</Label>
                  <div className="relative">
                    <div className={`absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold transition-colors duration-300 ${tipoSelecionado === "receita" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                      R$
                    </div>
                    <CurrencyInput
                      value={form.watch("valor")}
                      onValueChange={(v) => form.setValue("valor", v, { shouldValidate: form.formState.isSubmitted })}
                      placeholder="0,00"
                      className="h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                    />
                  </div>
                  {form.formState.errors.valor && <p className="text-xs text-red-500 font-medium">{form.formState.errors.valor.message}</p>}
                </div>

                {/* Divider */}
                <div className="border-t border-border/20" />

                {/* Category */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Categoria</Label>
                  <Select value={categoriaSelecionada} onValueChange={(v) => form.setValue("categoria", v)}>
                    <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background focus:ring-1 focus:ring-primary/30"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>
                          <span className="flex items-center gap-2.5">
                            <div className={`h-2 w-2 rounded-full ${getCategoryColor(c.nome)}`} />
                            {c.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data <span className="normal-case text-muted-foreground/60">(opcional)</span></Label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input type="date" className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" {...form.register("data")} />
                  </div>
                </div>
              </div>

              {/* ── Payment method (expenses only) ── */}
              {tipoSelecionado === "despesa" && (
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Forma de Pagamento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => { form.setValue("formaPagamento", "pix"); form.setValue("cartaoId", ""); form.setValue("numeroParcelas", ""); }}
                      className={`group relative flex flex-col items-center gap-1.5 sm:gap-2.5 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer border ${formaPagamentoSelecionada === "pix" ? "bg-primary/5 text-primary border-primary/20 shadow-sm shadow-primary/5" : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40 hover:border-border/50 hover:text-foreground"}`}
                    >
                      <div className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl transition-all ${formaPagamentoSelecionada === "pix" ? "bg-primary/10" : "bg-muted/40 group-hover:bg-muted/60"}`}>
                        <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      PIX
                    </button>
                    <button
                      type="button"
                      onClick={() => { form.setValue("formaPagamento", "debito"); form.setValue("cartaoId", ""); form.setValue("numeroParcelas", ""); }}
                      className={`group relative flex flex-col items-center gap-1.5 sm:gap-2.5 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer border ${formaPagamentoSelecionada === "debito" ? "bg-primary/5 text-primary border-primary/20 shadow-sm shadow-primary/5" : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40 hover:border-border/50 hover:text-foreground"}`}
                    >
                      <div className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl transition-all ${formaPagamentoSelecionada === "debito" ? "bg-primary/10" : "bg-muted/40 group-hover:bg-muted/60"}`}>
                        <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      Débito
                    </button>
                    <button
                      type="button"
                      onClick={() => form.setValue("formaPagamento", "credito")}
                      className={`group relative flex flex-col items-center gap-1.5 sm:gap-2.5 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer border ${formaPagamentoSelecionada === "credito" ? "bg-primary/5 text-primary border-primary/20 shadow-sm shadow-primary/5" : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40 hover:border-border/50 hover:text-foreground"}`}
                    >
                      <div className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl transition-all ${formaPagamentoSelecionada === "credito" ? "bg-primary/10" : "bg-muted/40 group-hover:bg-muted/60"}`}>
                        <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      Crédito
                    </button>
                  </div>
                </div>
              )}

              {/* ── Card + Installments (credit only) ── */}
              {tipoSelecionado === "despesa" && formaPagamentoSelecionada === "credito" && cartoes.length === 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Nenhum cartão cadastrado.</p>
                  <p className="text-xs text-muted-foreground mt-1">Cadastre um cartão na página <span className="font-semibold">Cartões</span> para usar crédito.</p>
                </div>
              )}
              {tipoSelecionado === "despesa" && formaPagamentoSelecionada === "credito" && cartoes.length > 0 && (
                <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-5">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground/50" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dados do Cartão</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Cartão</Label>
                    <Select value={cartaoSelecionado} onValueChange={(v) => form.setValue("cartaoId", v)}>
                      <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background"><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                      <SelectContent>{cartoes.map((c) => (<SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Parcelas</Label>
                    <Select value={form.watch("numeroParcelas") ?? ""} onValueChange={(v) => form.setValue("numeroParcelas", v)}>
                      <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background"><SelectValue placeholder="À vista (1x)" /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>{n}x{n === 1 ? " (à vista)" : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* ── Submit button ── */}
              <div className="pt-2 sm:pt-3 pb-safe">
                <Button
                  type="submit"
                  className={`w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-semibold text-sm sm:text-[15px] transition-all duration-300 cursor-pointer ${tipoSelecionado === "receita"
                    ? "bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-white"
                    : "bg-linear-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 text-white"
                    } active:scale-[0.98]`}
                  loading={criarLancamento.isPending}
                >
                  <Receipt className="h-5 w-5" />
                  Registrar Lançamento
                </Button>
              </div>
            </form>
          </div>
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
            <Button type="submit" className="w-full h-11 rounded-xl gap-2 font-bold shadow-premium" loading={atualizarLancamento.isPending}>
              Salvar alterações
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
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl" loading={removerLancamento.isPending}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* ── Bulk Delete Confirmation ── */}
      <AlertDialog open={deletingMany} onOpenChange={setDeletingMany}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vários lançamentos?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover os <strong>{selectedIds.length}</strong> lançamentos selecionados? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteMany} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl" loading={removerVariosLancamentos.isPending}>
              Remover {selectedIds.length} lançamentos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </PageShell>
  );
}
