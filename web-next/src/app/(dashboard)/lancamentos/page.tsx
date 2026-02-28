"use client";

import { useState, useMemo } from "react";
import {
  useResumo,
  useCategorias,
  useCartoes,
  useContasBancarias,
  useCriarLancamento,
  useLancamentos,
  useAtualizarLancamento,
  useRemoverLancamento,
  useRemoverVariosLancamentos,
  queryKeys,
} from "@/hooks/use-queries";
import { formatCurrency, formatDate, formatFormaPagamento } from "@/lib/format";
import type { Lancamento } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { lancamentoSchema, editarLancamentoSchema } from "@/lib/schemas";
import type { LancamentoData, EditarLancamentoData } from "@/lib/schemas";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Pencil,
  Trash2,
  X,
  Loader2,
  CreditCard,
  Smartphone,
  Banknote,
  Landmark,
  Tag,
  Calendar,
  DollarSign,
  MoreVertical,
  RefreshCw,
  MessageSquare,
  Globe,
  Image as ImageIcon,
} from "lucide-react";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/shared/page-components";
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

import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Category Colors ──────────────────────────────────────────
const categoryColorMap: Record<string, string> = {
  Alimentação: "bg-orange-500",
  Transporte: "bg-blue-500",
  Moradia: "bg-violet-500",
  Lazer: "bg-pink-500",
  Saúde: "bg-emerald-500",
  Educação: "bg-cyan-500",
  Salário: "bg-emerald-500",
  Roupas: "bg-rose-500",
  Outros: "bg-gray-500",
};

const categoryBadgeColors: Record<string, string> = {
  Alimentação: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  Transporte: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Moradia: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  Lazer: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400",
  Saúde: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Educação: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  Salário: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Roupas: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  Outros: "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400",
};

function getCategoryColor(cat: string) {
  return categoryColorMap[cat] || "bg-primary";
}

function getCategoryBadge(cat: string) {
  return categoryBadgeColors[cat] || "bg-primary/10 text-primary";
}

// ── Payment Method Icons ─────────────────────────────────────
function PaymentIcon({
  method,
  className = "h-3.5 w-3.5",
}: {
  method: string;
  className?: string;
}) {
  const m = method?.toLowerCase();
  if (m === "pix") return <Smartphone className={className} />;
  if (m === "credito" || m === "cartão de crédito") return <CreditCard className={className} />;
  return <Banknote className={className} />;
}

// ── Month Selector Hook ──────────────────────────────────────
const meses = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function useMonthSelector() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const mesParam = isCurrentMonth ? undefined : `${year}-${String(month + 1).padStart(2, "0")}`;
  const label = `${meses[month]} ${year}`;

  const prev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const next = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const reset = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-${lastDayOfMonth}`;

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

  const { label, isCurrentMonth, prev, next, reset, firstDay, lastDay, mesParam } =
    useMonthSelector();

  const { data: resumo, isLoading: loadingResumo, isError, error } = useResumo(mesParam);
  const { data: categorias = [] } = useCategorias();
  const { data: cartoes = [] } = useCartoes();
  const { data: contasBancarias = [] } = useContasBancarias();
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
    defaultValues: {
      descricao: "",
      valor: "",
      tipo: "despesa",
      categoria: "",
      cartaoId: "",
      contaId: "",
      formaPagamento: "",
      numeroParcelas: "",
    },
  });

  const editForm = useForm<EditarLancamentoData>({
    resolver: zodResolver(editarLancamentoSchema),
  });

  const tipoSelecionado = useWatch({ control: form.control, name: "tipo" });
  const categoriaSelecionada = useWatch({ control: form.control, name: "categoria" });
  const cartaoSelecionado = useWatch({ control: form.control, name: "cartaoId" });
  const contaSelecionada = useWatch({ control: form.control, name: "contaId" });
  const formaPagamentoSelecionada = useWatch({ control: form.control, name: "formaPagamento" });
  const valorDigitado = useWatch({ control: form.control, name: "valor" });
  const parcelasSelecionadas = useWatch({ control: form.control, name: "numeroParcelas" });

  const activeFilters =
    (filtroTipo !== "todos" ? 1 : 0) +
    (filtroCategoria !== "todas" ? 1 : 0) +
    (busca.trim() ? 1 : 0);

  const onSubmit = async (data: LancamentoData) => {
    const valor = parseFloat(data.valor.replace(",", "."));

    let formaPagamento: "PIX" | "Debito" | "Credito" | "Dinheiro" | "Outro" = "Outro";
    let cartaoId: number | undefined;
    let contaBancariaId: number | undefined;
    let parcelas = 1;

    if (data.tipo === "receita") {
      formaPagamento = "PIX";
    } else if (data.formaPagamento === "credito") {
      formaPagamento = "Credito";
      cartaoId = data.cartaoId ? parseInt(data.cartaoId, 10) : undefined;
      parcelas = data.numeroParcelas ? parseInt(data.numeroParcelas, 10) : 1;
      if (parcelas < 1 || isNaN(parcelas)) parcelas = 1;
    } else if (data.formaPagamento === "pix") {
      formaPagamento = "PIX";
      contaBancariaId = data.contaId ? parseInt(data.contaId, 10) : undefined;
    } else if (data.formaPagamento === "debito") {
      formaPagamento = "Debito";
      contaBancariaId = data.contaId ? parseInt(data.contaId, 10) : undefined;
    }

    criarLancamento.mutate(
      {
        descricao: data.descricao,
        valor,
        tipo: (data.tipo === "despesa" ? 1 : 2) as 1 | 2,
        formaPagamento: {
          PIX: 1,
          Debito: 2,
          Credito: 3,
          Dinheiro: 4,
          Outro: 5,
        }[formaPagamento] as unknown as 1 | 2 | 3,
        categoria: data.categoria || "Outros",
        numeroParcelas: parcelas,
        cartaoCreditoId: cartaoId,
        contaBancariaId,
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
      },
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

  const startIdx = lancamentosData ? (lancamentosData.pagina - 1) * 20 + 1 : 0;
  const endIdx = lancamentosData ? Math.min(lancamentosData.pagina * 20, lancamentosData.total) : 0;

  return (
    <div className="space-y-6">
      {/* ═══ Action Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 rounded-2xl p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <h2 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            Lançamentos
          </h2>
          <div className="hidden md:block h-8 w-px bg-slate-300 dark:bg-slate-600" />
          {/* Month selector */}
          <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-700/70 px-3 py-1.5 rounded-xl border border-white/60 dark:border-slate-600/60 shadow-sm">
            <button
              onClick={prev}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-28 justify-center select-none cursor-pointer hover:text-emerald-600 transition-colors"
            >
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              {label}
            </button>
            <button
              onClick={next}
              disabled={isCurrentMonth}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRefresh}
                  className="p-2.5 hover:bg-white/60 dark:hover:bg-slate-700/60 rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Atualizar dados</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            onClick={() => setShowForm(true)}
            className="bg-emerald-600 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer text-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Lançamento</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </motion.div>

      {/* ═══ Bulk Actions Bar ═══ */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between p-3 px-5 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 text-emerald-600 dark:text-emerald-400">
              <span className="text-sm font-semibold">
                {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "lançamento selecionado" : "lançamentos selecionados"}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                  className="hover:bg-emerald-600/10"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeletingMany(true)}
                  className="gap-2 shadow-sm rounded-xl"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Selecionados
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Stat Cards ═══ */}
      {loadingResumo ? (
        <CardSkeleton count={3} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={handleRefresh} />
      ) : resumo ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          {/* Receitas */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
          >
            <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
            <div className="flex justify-between items-start z-10">
              <div className="size-10 flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/15 rounded-xl text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="z-10 mt-auto">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                Receitas
              </p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                {formatCurrency(resumo.totalReceitas)}
              </h3>
            </div>
          </motion.div>

          {/* Gastos */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
          >
            <div className="absolute -right-6 -bottom-6 bg-red-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-red-500/15 transition-all" />
            <div className="flex justify-between items-start z-10">
              <div className="size-10 flex items-center justify-center bg-red-100 dark:bg-red-500/15 rounded-xl text-red-600 dark:text-red-400">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <div className="z-10 mt-auto">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                Gastos
              </p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                {formatCurrency(resumo.totalGastos)}
              </h3>
            </div>
          </motion.div>

          {/* Saldo */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300 ring-2 ring-emerald-600/20"
          >
            <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
            <div className="flex justify-between items-start z-10">
              <div className="size-10 flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/15 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Wallet className="h-5 w-5" />
              </div>
              {resumo.saldo !== 0 && resumo.totalReceitas > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5 border",
                    resumo.saldo > 0
                      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"
                      : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20"
                  )}
                >
                  {resumo.saldo > 0 ? "+" : ""}
                  {Math.round(
                    ((resumo.totalReceitas - resumo.totalGastos) / resumo.totalReceitas) * 100
                  )}
                  %
                </span>
              )}
            </div>
            <div className="z-10 mt-auto">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                Saldo
              </p>
              <h3
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  resumo.saldo >= 0
                    ? "text-slate-800 dark:text-white"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {formatCurrency(resumo.saldo)}
              </h3>
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* ═══ Filter Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-panel rounded-2xl p-4 lg:p-5"
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 w-full lg:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              placeholder="Buscar lançamentos..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-white/70 dark:bg-slate-700/50 border border-white/60 dark:border-slate-600/60 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600/30 transition-all"
            />
            {busca && (
              <button
                onClick={() => {
                  setBusca("");
                  setPagina(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="hidden lg:block h-8 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Type filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setFiltroTipo("todos");
                setPagina(1);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                filtroTipo === "todos"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "bg-white/60 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 border border-white/60 dark:border-slate-600/50"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setFiltroTipo("receita");
                setPagina(1);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                filtroTipo === "receita"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  : "bg-white/60 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 border border-white/60 dark:border-slate-600/50"
              )}
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Receitas
            </button>
            <button
              onClick={() => {
                setFiltroTipo("gasto");
                setPagina(1);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                filtroTipo === "gasto"
                  ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                  : "bg-white/60 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 border border-white/60 dark:border-slate-600/50"
              )}
            >
              <ArrowDownCircle className="h-3.5 w-3.5" />
              Gastos
            </button>
          </div>

          {/* Category dropdown */}
          <Select
            value={filtroCategoria}
            onValueChange={(v) => {
              setFiltroCategoria(v);
              setPagina(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl text-xs bg-white/70 dark:bg-slate-700/50 border-white/60 dark:border-slate-600/60 shadow-sm">
              <Tag className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.nome}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Limpar Filtros
            </button>
          )}
        </div>
      </motion.div>

      {/* ═══ Transaction Table ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-panel rounded-2xl overflow-hidden"
      >
        {/* Table header */}
        <div className="hidden lg:grid lg:grid-cols-[40px_2fr_1fr_1fr_1fr_0.8fr_1fr_50px] gap-4 items-center px-6 py-3.5 border-b border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <Checkbox
              checked={
                !!lancamentosData?.items?.length &&
                selectedIds.length === lancamentosData.items.length
              }
              onCheckedChange={(c: boolean) => toggleSelectAll(c)}
              aria-label="Selecionar todos"
            />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Descrição
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Data
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Categoria
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Forma Pgto.
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Origem
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">
            Valor
          </span>
          <span />
        </div>

        {loadingLancamentos ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando lançamentos...</p>
          </div>
        ) : lancamentosData && lancamentosData.items.length > 0 ? (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
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
                      className={cn(
                        "hidden lg:grid lg:grid-cols-[40px_2fr_1fr_1fr_1fr_0.8fr_1fr_50px] gap-4 items-center px-6 py-3.5 transition-all duration-200 cursor-pointer",
                        selectedIds.includes(l.id)
                          ? "bg-emerald-600/5 hover:bg-emerald-600/8"
                          : "hover:bg-white/40 dark:hover:bg-slate-800/30"
                      )}
                      onClick={() => setViewingItem(l)}
                    >
                      {/* Checkbox */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(l.id)}
                          onCheckedChange={(c: boolean) => toggleSelectRow(l.id, c)}
                          aria-label={`Selecionar ${l.descricao}`}
                        />
                      </div>

                      {/* Description */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
                            l.tipo === "receita"
                              ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                              : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                          )}
                        >
                          {l.tipo === "receita" ? (
                            <ArrowUpCircle className="h-4 w-4" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white truncate">
                            {l.descricao}
                          </p>
                          {l.parcelado && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                              {l.numeroParcelas}x de {formatCurrency(l.valor / l.numeroParcelas)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <span className="text-[13px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                        {formatDate(l.data)}
                      </span>

                      {/* Category */}
                      <div>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold",
                            getCategoryBadge(l.categoria)
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              getCategoryColor(l.categoria)
                            )}
                          />
                          {l.categoria}
                        </span>
                      </div>

                      {/* Payment method */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-700/50">
                          <PaymentIcon
                            method={l.formaPagamento}
                            className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[12px] text-slate-600 dark:text-slate-300 font-medium">
                            {formatFormaPagamento(l.formaPagamento)}
                          </span>
                          {l.parcelado && (
                            <span className="ml-1.5 text-[10px] bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md font-medium">
                              {l.numeroParcelas}x
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Origem */}
                      <div className="flex items-center gap-1.5">
                        {l.origem === "Imagem" ? (
                          <ImageIcon className="h-3.5 w-3.5 text-violet-500" />
                        ) : l.origem === "Audio" ? (
                          <MessageSquare className="h-3.5 w-3.5 text-sky-500" />
                        ) : (
                          <Globe className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                          {l.origem === "Imagem"
                            ? "Imagem"
                            : l.origem === "Audio"
                              ? "Áudio"
                              : "Texto"}
                        </span>
                      </div>

                      {/* Value */}
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums text-right whitespace-nowrap",
                          l.tipo === "receita"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {l.tipo === "receita" ? "+" : "\u2212"} {formatCurrency(l.valor)}
                      </span>

                      {/* Actions dropdown */}
                      <div
                        className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEdit(l)}
                              className="gap-2 cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingId(l.id)}
                              className="gap-2 text-red-600 dark:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div
                      className={cn(
                        "lg:hidden flex flex-col gap-3 p-4 sm:p-5 transition-colors cursor-pointer active:scale-[0.99]",
                        selectedIds.includes(l.id)
                          ? "bg-emerald-600/5"
                          : "hover:bg-white/30 dark:hover:bg-slate-800/20"
                      )}
                      onClick={() => setViewingItem(l)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 w-full min-w-0">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.includes(l.id)}
                              onCheckedChange={(c: boolean) => toggleSelectRow(l.id, c)}
                              className="w-5 h-5 rounded-md"
                            />
                          </div>
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
                              l.tipo === "receita"
                                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                                : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                            )}
                          >
                            {l.tipo === "receita" ? (
                              <ArrowUpCircle className="h-5 w-5" />
                            ) : (
                              <ArrowDownCircle className="h-5 w-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-slate-800 dark:text-white truncate">
                              {l.descricao}
                            </p>
                            <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                              {l.categoria}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={cn(
                              "block text-[15px] font-extrabold tabular-nums tracking-tight",
                              l.tipo === "receita"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            )}
                          >
                            {l.tipo === "receita" ? "+" : "−"} {formatCurrency(l.valor)}
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                            {formatDate(l.data)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {lancamentosData.totalPaginas > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200/60 dark:border-slate-700/40 bg-slate-50/30 dark:bg-slate-800/20">
                <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                  Mostrando {startIdx}-{endIdx} de {lancamentosData.total}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-xl text-xs gap-1.5 bg-white/60 dark:bg-slate-700/50 border-white/60 dark:border-slate-600/50"
                    disabled={pagina <= 1}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Anterior
                  </Button>
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(lancamentosData.totalPaginas, 5) }, (_, i) => {
                    let pageNum: number;
                    if (lancamentosData.totalPaginas <= 5) {
                      pageNum = i + 1;
                    } else if (pagina <= 3) {
                      pageNum = i + 1;
                    } else if (pagina >= lancamentosData.totalPaginas - 2) {
                      pageNum = lancamentosData.totalPaginas - 4 + i;
                    } else {
                      pageNum = pagina - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPagina(pageNum)}
                        className={cn(
                          "h-8 w-8 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                          pageNum === pagina
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                            : "text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/50"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 rounded-xl text-xs gap-1.5 bg-white/60 dark:bg-slate-700/50 border-white/60 dark:border-slate-600/50"
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
          <div className="p-12">
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="Nenhum lançamento encontrado"
              description={
                activeFilters > 0
                  ? "Tente remover os filtros para ver mais resultados"
                  : "Registre seu primeiro lançamento para começar a controlar suas finanças"
              }
              action={
                activeFilters > 0 ? (
                  <Button variant="outline" onClick={clearFilters} className="gap-2 rounded-xl">
                    <X className="h-4 w-4" />
                    Limpar filtros
                  </Button>
                ) : (
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-emerald-600 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Registrar lançamento
                  </button>
                )
              }
            />
          </div>
        )}
      </motion.div>

      {/* ═══ New Transaction Dialog ═══ */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div
              className={cn(
                "flex items-center gap-3 sm:gap-4 rounded-2xl border p-3.5 sm:p-4 transition-all duration-500",
                tipoSelecionado === "receita"
                  ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-500/10 dark:border-emerald-400/20"
                  : "bg-red-50/60 dark:bg-red-950/40 border-red-500/10 dark:border-red-400/20"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-500 shadow-sm",
                  tipoSelecionado === "receita"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-red-500/15 text-red-600"
                )}
              >
                <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-semibold">
                  Novo Lançamento
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">
                  Registre uma nova movimentação financeira
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="px-5 sm:px-7 pb-8 space-y-4 sm:space-y-5"
            >
              {/* Type selector */}
              <div className="relative flex p-1 rounded-xl bg-muted/40">
                <div
                  className={cn(
                    "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out",
                    tipoSelecionado === "receita"
                      ? "left-1 bg-emerald-500 shadow-lg shadow-emerald-500/25"
                      : "left-[calc(50%+3px)] bg-red-500 shadow-lg shadow-red-500/25"
                  )}
                />
                <button
                  type="button"
                  onClick={() => {
                    form.setValue("tipo", "receita");
                    form.setValue("cartaoId", "");
                    form.setValue("formaPagamento", "");
                    form.setValue("numeroParcelas", "");
                  }}
                  className={cn(
                    "relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 cursor-pointer",
                    tipoSelecionado === "receita"
                      ? "text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ArrowUpCircle className="h-4 w-4" /> Receita
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("tipo", "despesa")}
                  className={cn(
                    "relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-300 cursor-pointer",
                    tipoSelecionado === "despesa"
                      ? "text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ArrowDownCircle className="h-4 w-4" /> Despesa
                </button>
              </div>

              {/* Main fields */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/[0.08] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Descrição
                  </Label>
                  <Input
                    placeholder="Ex: Supermercado, Salário..."
                    className="h-11 rounded-xl border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                    {...form.register("descricao")}
                  />
                  {form.formState.errors.descricao && (
                    <p className="text-xs text-red-500 font-medium">
                      {form.formState.errors.descricao.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Valor
                  </Label>
                  <div className="relative">
                    <div
                      className={cn(
                        "absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold transition-colors duration-300",
                        tipoSelecionado === "receita"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-red-500/10 text-red-500"
                      )}
                    >
                      R$
                    </div>
                    <CurrencyInput
                      value={form.watch("valor")}
                      onValueChange={(v) =>
                        form.setValue("valor", v, { shouldValidate: form.formState.isSubmitted })
                      }
                      placeholder="0,00"
                      className="h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                    />
                  </div>
                  {form.formState.errors.valor && (
                    <p className="text-xs text-red-500 font-medium">
                      {form.formState.errors.valor.message}
                    </p>
                  )}
                </div>

                <div className="border-t border-border/20" />

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Categoria
                  </Label>
                  <Select
                    value={categoriaSelecionada}
                    onValueChange={(v) => form.setValue("categoria", v)}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background focus:ring-1 focus:ring-primary/30">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>
                          <span className="flex items-center gap-2.5">
                            <div className={cn("h-2 w-2 rounded-full", getCategoryColor(c.nome))} />
                            {c.nome}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Data <span className="normal-case text-muted-foreground/60">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                      type="date"
                      className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                      {...form.register("data")}
                    />
                  </div>
                </div>
              </div>

              {/* Payment method (expenses only) */}
              {tipoSelecionado === "despesa" && (
                <div className="space-y-3">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Forma de Pagamento
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("formaPagamento", "debito");
                        form.setValue("cartaoId", "");
                        form.setValue("numeroParcelas", "");
                      }}
                      className={cn(
                        "group relative flex flex-col items-center gap-1.5 sm:gap-2.5 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer border",
                        formaPagamentoSelecionada === "debito"
                          ? "bg-emerald-600/5 text-emerald-600 border-emerald-600/20 shadow-sm shadow-emerald-500/5"
                          : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40 hover:border-border/50 hover:text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl transition-all",
                          formaPagamentoSelecionada === "debito"
                            ? "bg-emerald-600/10"
                            : "bg-muted/40 group-hover:bg-muted/60"
                        )}
                      >
                        <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      Débito
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("formaPagamento", "credito");
                        form.setValue("contaId", "");
                      }}
                      className={cn(
                        "group relative flex flex-col items-center gap-1.5 sm:gap-2.5 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer border",
                        formaPagamentoSelecionada === "credito"
                          ? "bg-emerald-600/5 text-emerald-600 border-emerald-600/20 shadow-sm shadow-emerald-500/5"
                          : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40 hover:border-border/50 hover:text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl transition-all",
                          formaPagamentoSelecionada === "credito"
                            ? "bg-emerald-600/10"
                            : "bg-muted/40 group-hover:bg-muted/60"
                        )}
                      >
                        <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      Crédito
                    </button>
                  </div>
                </div>
              )}

              {/* Conta Bancária (pix / débito) */}
              {tipoSelecionado === "despesa" &&
                formaPagamentoSelecionada !== "" &&
                formaPagamentoSelecionada !== "credito" && (
                  <div className="space-y-4 rounded-2xl border border-emerald-600/8 dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-5">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-muted-foreground/50" />
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Conta Bancária
                      </span>
                    </div>
                    {contasBancarias.length === 0 ? (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                          Nenhuma conta cadastrada.
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cadastre uma conta na página <span className="font-semibold">Contas</span>
                          .
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-foreground/70">
                          Conta{" "}
                          <span className="text-muted-foreground font-normal">(opcional)</span>
                        </Label>
                        <Select
                          value={contaSelecionada ?? ""}
                          onValueChange={(v) => form.setValue("contaId", v === "__none" ? "" : v)}
                        >
                          <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background">
                            <SelectValue placeholder="Selecionar conta" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Nenhuma</SelectItem>
                            {contasBancarias.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

              {/* Card + Installments (credit only) */}
              {tipoSelecionado === "despesa" &&
                formaPagamentoSelecionada === "credito" &&
                cartoes.length === 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                      Nenhum cartão cadastrado.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cadastre um cartão na página <span className="font-semibold">Cartões</span>{" "}
                      para usar crédito.
                    </p>
                  </div>
                )}
              {tipoSelecionado === "despesa" &&
                formaPagamentoSelecionada === "credito" &&
                cartoes.length > 0 && (
                  <div className="space-y-4 rounded-2xl border border-emerald-600/[0.08] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-5">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground/50" />
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Dados do Cartão
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground/70">Cartão</Label>
                      <Select
                        value={cartaoSelecionado}
                        onValueChange={(v) => form.setValue("cartaoId", v)}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background">
                          <SelectValue placeholder="Selecione o cartão" />
                        </SelectTrigger>
                        <SelectContent>
                          {cartoes.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground/70">Parcelas</Label>
                      <Select
                        value={parcelasSelecionadas ?? ""}
                        onValueChange={(v) => form.setValue("numeroParcelas", v)}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background">
                          <SelectValue placeholder="À vista (1x)" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                            const valorNum = parseFloat((valorDigitado || "").replace(",", "."));
                            const valorParcela = !isNaN(valorNum) && valorNum > 0 ? valorNum / n : 0;
                            return (
                              <SelectItem key={n} value={n.toString()}>
                                {n}x{n === 1 ? " (à vista)" : ""}{valorParcela > 0 && n > 1 ? ` — ${formatCurrency(valorParcela)}/mês` : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {(() => {
                        const nParcelas = parseInt(parcelasSelecionadas || "1");
                        const valorNum = parseFloat((valorDigitado || "").replace(",", "."));
                        if (nParcelas > 1 && !isNaN(valorNum) && valorNum > 0) {
                          return (
                            <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/15 dark:border-emerald-400/20 bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-2">
                              <CreditCard className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                {nParcelas}x de <strong>{formatCurrency(valorNum / nParcelas)}</strong>
                                <span className="text-emerald-600/60 dark:text-emerald-400/60 ml-1">
                                  (total: {formatCurrency(valorNum)})
                                </span>
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}

              {/* Submit */}
              <div className="pt-2 sm:pt-3 pb-safe">
                <Button
                  type="submit"
                  className={cn(
                    "w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-semibold text-sm sm:text-[15px] transition-all duration-300 cursor-pointer active:scale-[0.98]",
                    tipoSelecionado === "receita"
                      ? "bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-white"
                      : "bg-linear-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/20 hover:shadow-red-500/30 text-white"
                  )}
                  loading={criarLancamento.isPending}
                >
                  <Receipt className="h-5 w-5" />
                  Registrar Lançamento
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Dialog ═══ */}
      <Dialog open={editingItem !== null} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Lançamento</DialogTitle>
            <DialogDescription>Altere os dados do lançamento</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-5">
            {editingItem && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    editingItem.tipo === "receita"
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                  )}
                >
                  {editingItem.tipo === "receita" ? (
                    <ArrowUpCircle className="h-4.5 w-4.5" />
                  ) : (
                    <ArrowDownCircle className="h-4.5 w-4.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {editingItem.tipo}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    · {formatFormaPagamento(editingItem.formaPagamento)}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Descrição
              </Label>
              <Input className="h-11 rounded-xl" {...editForm.register("descricao")} />
              {editForm.formState.errors.descricao && (
                <p className="text-xs text-red-500 font-medium">
                  {editForm.formState.errors.descricao.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Valor (R$)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  className="h-11 rounded-xl pl-9 text-lg tabular-nums font-semibold"
                  {...editForm.register("valor")}
                />
              </div>
              {editForm.formState.errors.valor && (
                <p className="text-xs text-red-500 font-medium">
                  {editForm.formState.errors.valor.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Categoria
              </Label>
              <Select
                value={editForm.watch("categoria") ?? ""}
                onValueChange={(v) => editForm.setValue("categoria", v)}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.nome}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  type="date"
                  className="h-11 rounded-xl pl-9"
                  {...editForm.register("data")}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              loading={atualizarLancamento.isPending}
            >
              Salvar alterações
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ View Detail Dialog ═══ */}
      <Dialog open={viewingItem !== null} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Detalhes do Lançamento</DialogTitle>
            <DialogDescription>Informações completas</DialogDescription>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl bg-muted/20 border border-border/30">
                <div
                  className={cn(
                    "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl shrink-0",
                    viewingItem.tipo === "receita"
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                  )}
                >
                  {viewingItem.tipo === "receita" ? (
                    <ArrowUpCircle className="h-5 w-5" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-sm sm:text-base">{viewingItem.descricao}</p>
                  <Badge
                    variant={viewingItem.tipo === "receita" ? "default" : "destructive"}
                    className="text-[11px] mt-1 capitalize"
                  >
                    {viewingItem.tipo}
                  </Badge>
                </div>
                <span
                  className={cn(
                    "text-base sm:text-xl font-extrabold tabular-nums shrink-0",
                    viewingItem.tipo === "receita"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {viewingItem.tipo === "receita" ? "+" : "−"} {formatCurrency(viewingItem.valor)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                      Categoria
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{viewingItem.categoria}</p>
                </div>

                <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <PaymentIcon
                      method={viewingItem.formaPagamento}
                      className="h-3.5 w-3.5 text-muted-foreground/60"
                    />
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                      Pagamento
                    </span>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatFormaPagamento(viewingItem.formaPagamento)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                      Data
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{formatDate(viewingItem.data)}</p>
                </div>

                {viewingItem.parcelado && (
                  <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                        Parcelas
                      </span>
                    </div>
                    <p className="text-sm font-semibold">
                      {viewingItem.numeroParcelas}x de{" "}
                      {formatCurrency(viewingItem.valor / viewingItem.numeroParcelas)}
                    </p>
                  </div>
                )}

                {viewingItem.criadoEm && (
                  <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                        Criado em
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{formatDate(viewingItem.criadoEm)}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 h-10 rounded-xl font-semibold"
                  onClick={() => {
                    setViewingItem(null);
                    openEdit(viewingItem);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2 h-10 rounded-xl font-semibold"
                  onClick={() => {
                    setViewingItem(null);
                    setDeletingId(viewingItem.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Confirmation ═══ */}
      <AlertDialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lançamento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
              loading={removerLancamento.isPending}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Bulk Delete Confirmation ═══ */}
      <AlertDialog open={deletingMany} onOpenChange={setDeletingMany}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vários lançamentos?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover os <strong>{selectedIds.length}</strong> lançamentos
              selecionados? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteMany}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
              loading={removerVariosLancamentos.isPending}
            >
              Remover {selectedIds.length} lançamentos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
