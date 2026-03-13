"use client";

import { useEffect, useMemo, useState } from "react";
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
  RefreshCw,
  MessageSquare,
  Globe,
  Image as ImageIcon,
  FileUp,
} from "lucide-react";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
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

function getCategoryColor(cat: string) {
  return categoryColorMap[cat] || "bg-primary";
}

function getOrigemLabel(origem?: string) {
  if (origem === "Imagem") return "Foto";
  if (origem === "Audio") return "Áudio";
  if (origem === "Documento") return "Documento";
  if (origem === "Importacao") return "Importação";
  return "Manual";
}

function SourceIcon({
  origem,
  className = "h-3.5 w-3.5",
}: {
  origem?: string;
  className?: string;
}) {
  if (origem === "Imagem") return <ImageIcon className={className} />;
  if (origem === "Audio") return <MessageSquare className={className} />;
  if (origem === "Documento") return <FileUp className={className} />;
  if (origem === "Importacao") return <FileUp className={className} />;
  return <Globe className={className} />;
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
    if (isCurrentMonth) return;
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
  // Use o primeiro dia do mês seguinte para que o filtro "< ate" inclua o último dia inteiro
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const lastDay = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { label, prev, next, reset, firstDay, lastDay, mesParam, isCurrentMonth } =
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

  useEffect(() => {
    setPagina(1);
    setSelectedIds([]);
  }, [filtroTipo, filtroCategoria, busca, firstDay, lastDay]);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resumo"] }),
        queryClient.invalidateQueries({ queryKey: ["lancamentos"] }),
      ]);
      setSelectedIds([]);
    } finally {
      setIsRefreshing(false);
    }
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

  const deletingLancamento = useMemo(
    () => lancamentosData?.items.find((item) => item.id === deletingId) ?? null,
    [deletingId, lancamentosData]
  );

  const selectedLancamentos = useMemo(
    () => lancamentosData?.items.filter((item) => selectedIds.includes(item.id)) ?? [],
    [lancamentosData, selectedIds]
  );

  const selectedContaFixaCount = selectedLancamentos.filter(
    (item) => item.geradoPorContaFixa
  ).length;

  const startIdx = lancamentosData ? (lancamentosData.pagina - 1) * 20 + 1 : 0;
  const endIdx = lancamentosData ? Math.min(lancamentosData.pagina * 20, lancamentosData.total) : 0;

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* ═══ Page Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl serif-italic text-slate-900 dark:text-white tracking-tight">
            Lançamentos
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold mt-2">
            Gestão de Fluxo de Caixa
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-nowrap">
          <div className="flex w-full items-center justify-between gap-1.5 rounded-full border border-[rgba(15,23,42,0.06)] bg-white px-3 py-1.5 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80 sm:w-auto sm:justify-start">
            <button
              onClick={prev}
              aria-label="Exibir mês anterior"
              className="p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              onClick={reset}
              aria-label={`Voltar para ${label}`}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 min-w-24 justify-center select-none cursor-pointer uppercase tracking-[0.2em] hover:text-emerald-600 transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              {label}
            </button>
            <button
              onClick={next}
              disabled={isCurrentMonth}
              aria-label="Exibir mês seguinte"
              className="p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
          <button
            onClick={handleRefresh}
            type="button"
            aria-label="Atualizar resumo e lista de lançamentos"
            aria-busy={isRefreshing}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-emerald-500 transition-colors rounded-full hover:bg-white dark:hover:bg-slate-800 cursor-pointer disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex-1 justify-center bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-lg sm:flex-none"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Lançamento
          </button>
        </div>
      </motion.div>

      {/* ═══ Bulk Actions Bar ═══ */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center justify-between px-6 py-3 rounded-[2rem] bg-emerald-600/10 border border-emerald-600/20 text-emerald-600 dark:text-emerald-400">
              <span className="text-[11px] font-bold uppercase tracking-widest">
                {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "lançamento selecionado" : "lançamentos selecionados"}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-emerald-700 hover:bg-emerald-600/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setDeletingMany(true)}
                  className="px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 xl:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] flex items-center justify-between"
          >
            <div>
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mb-4">
                Receita Mensal
              </p>
              <span className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(resumo.totalReceitas)}
              </span>
            </div>
            <TrendingUp className="h-8 w-8 text-emerald-500 opacity-20" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] flex items-center justify-between"
          >
            <div>
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mb-4">
                Despesa Mensal
              </p>
              <span className="text-lg sm:text-2xl font-bold text-rose-500">
                {formatCurrency(resumo.totalGastos)}
              </span>
            </div>
            <TrendingDown className="h-8 w-8 text-rose-500 opacity-20" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] flex items-center justify-between"
          >
            <div>
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mb-4">
                Saldo do Período
              </p>
              <span
                className={cn(
                  "text-lg sm:text-2xl font-bold",
                  resumo.saldo >= 0 ? "text-emerald-600" : "text-rose-500"
                )}
              >
                {formatCurrency(resumo.saldo)}
              </span>
            </div>
            <Wallet className="h-8 w-8 text-emerald-600 opacity-20" />
          </motion.div>
        </div>
      ) : null}

      {/* ═══ Filter Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="exec-card rounded-2xl p-4 sm:rounded-[2rem] sm:px-6 sm:py-3 lg:px-8"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="relative min-w-0 flex-1 sm:min-w-[16rem]">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 dark:text-slate-600" />
            <input
              id="lancamentos-busca"
              name="busca"
              aria-label="Pesquisar lançamentos por descrição"
              placeholder="Pesquisar por descrição..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              className="w-full bg-transparent border-none text-[12px] pl-6 pr-6 focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:italic text-slate-700 dark:text-slate-200 outline-none"
            />
            {busca && (
              <button
                onClick={() => {
                  setBusca("");
                  setPagina(1);
                }}
                aria-label="Limpar busca"
                className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="h-px w-full bg-slate-100 dark:bg-slate-700 sm:h-8 sm:w-px" />

          <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
            {(["todos", "receita", "gasto"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setFiltroTipo(t);
                  setPagina(1);
                }}
                aria-pressed={filtroTipo === t}
                className={cn(
                  "flex-1 px-3 py-2 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer whitespace-nowrap sm:flex-none sm:px-4 sm:py-1.5",
                  filtroTipo === t
                    ? t === "gasto"
                      ? "bg-rose-500 text-white shadow-sm"
                      : "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                {t === "todos" ? "Todas" : t === "receita" ? "Receitas" : "Despesas"}
              </button>
            ))}
          </div>

          <div className="h-px w-full bg-slate-100 dark:bg-slate-700 sm:h-8 sm:w-px" />

          <label htmlFor="lancamentos-categoria-filter" className="sr-only">
            Filtrar por categoria
          </label>
          <select
            id="lancamentos-categoria-filter"
            name="categoria"
            aria-label="Filtrar lançamentos por categoria"
            value={filtroCategoria}
            onChange={(e) => {
              setFiltroCategoria(e.target.value);
              setPagina(1);
            }}
            className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 outline-none transition-colors focus:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 sm:w-auto sm:border-none sm:bg-transparent sm:px-0 sm:py-0 sm:focus:border-none"
          >
            <option value="todas">Categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>

          {activeFilters > 0 && (
            <>
              <div className="h-px w-full bg-slate-100 dark:bg-slate-700 sm:h-8 sm:w-px" />
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 self-start text-[9px] font-bold uppercase tracking-widest text-rose-400 hover:text-rose-600 transition-colors cursor-pointer sm:self-auto"
              >
                <X className="h-3 w-3" />
                Limpar
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* ═══ Transaction Table ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="exec-card rounded-2xl sm:rounded-[2.5rem] overflow-hidden flex flex-col"
      >
        {/* Table header */}
        <div className="hidden lg:flex items-center border-b border-slate-50 dark:border-slate-700/50">
          <div className="px-8 py-6 flex-shrink-0">
            <Checkbox
              checked={
                !!lancamentosData?.items?.length &&
                selectedIds.length === lancamentosData.items.length
              }
              onCheckedChange={(c: boolean) => toggleSelectAll(c)}
              aria-label="Selecionar todos"
            />
          </div>
          <div className="grid grid-cols-[0.7fr_1.4fr_0.8fr_0.8fr_0.9fr] flex-1 pr-8">
            <span className="py-6 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
              Data
            </span>
            <span className="py-6 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
              Descrição
            </span>
            <span className="py-6 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
              Categoria
            </span>
            <span className="py-6 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
              Origem
            </span>
            <span className="py-6 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-right">
              Valor
            </span>
          </div>
          <div className="w-24 flex-shrink-0" />
        </div>

        {loadingLancamentos ? (
          <div className="p-6 sm:p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">
              Carregando...
            </p>
          </div>
        ) : lancamentosData && lancamentosData.items.length > 0 ? (
          <>
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
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
                      className="hidden lg:flex items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => setViewingItem(l)}
                    >
                      <div className="px-8 py-7 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(l.id)}
                          onCheckedChange={(c: boolean) => toggleSelectRow(l.id, c)}
                          aria-label={`Selecionar lançamento ${l.descricao}`}
                        />
                      </div>
                      <div className="grid grid-cols-[0.7fr_1.4fr_0.8fr_0.8fr_0.9fr] flex-1 pr-0 py-7 gap-4">
                        {/* Data */}
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 self-center">
                          {formatDate(l.data)}
                        </span>
                        {/* Descrição */}
                        <div className="flex flex-col self-center min-w-0 pr-4">
                          <span className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                            {l.descricao}
                          </span>
                          <span
                            className={cn(
                              "text-[9px] font-bold uppercase tracking-tighter mt-0.5",
                              l.tipo === "receita"
                                ? "text-emerald-500 opacity-70"
                                : "text-slate-400"
                            )}
                          >
                            {l.origem === "Importacao"
                              ? "Extrato bancário"
                              : getOrigemLabel(l.origem)}
                            {l.parcelado && ` · ${l.numeroParcelas}x`}
                            {l.geradoPorContaFixa && " · Conta fixa"}
                          </span>
                        </div>
                        {/* Categoria */}
                        <div className="self-center">
                          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">
                            {l.categoria}
                          </span>
                        </div>
                        {/* Origem */}
                        <div className="flex items-center gap-2 self-center">
                          <SourceIcon
                            origem={l.origem}
                            className={cn(
                              "h-3.5 w-3.5",
                              l.origem === "Imagem"
                                ? "text-violet-400"
                                : l.origem === "Audio"
                                  ? "text-sky-400"
                                  : l.origem === "Documento"
                                    ? "text-amber-400"
                                    : l.origem === "Importacao"
                                      ? "text-emerald-400"
                                      : "text-slate-400"
                            )}
                          />
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
                            {getOrigemLabel(l.origem)}
                          </span>
                        </div>
                        {/* Valor */}
                        <span
                          className={cn(
                            "text-[13px] font-mono font-bold text-right self-center whitespace-nowrap",
                            l.tipo === "receita"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-500"
                          )}
                        >
                          {l.tipo === "receita" ? "+" : "−"} {formatCurrency(l.valor)}
                        </span>
                      </div>
                      {/* Actions (revealed on hover) */}
                      <div
                        className="w-24 flex-shrink-0 py-7 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEdit(l)}
                          className="text-slate-300 hover:text-emerald-500 transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(l.id)}
                          className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="lg:hidden px-4 py-4 sm:px-6" onClick={() => setViewingItem(l)}>
                      <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white/80 p-4 transition-colors hover:bg-slate-50/70 dark:border-slate-700/50 dark:bg-slate-900/40 dark:hover:bg-slate-800/40">
                        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(l.id)}
                            onCheckedChange={(c: boolean) => toggleSelectRow(l.id, c)}
                            aria-label={`Selecionar lançamento ${l.descricao}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-white">
                                {l.descricao}
                              </p>
                              <p className="mt-1 text-[10px] font-medium text-slate-400">
                                {formatDate(l.data)}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 text-[13px] font-mono font-bold whitespace-nowrap",
                                l.tipo === "receita" ? "text-emerald-600" : "text-rose-500"
                              )}
                            >
                              {l.tipo === "receita" ? "+" : "−"} {formatCurrency(l.valor)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-700/50 dark:text-slate-300">
                              {l.categoria}
                            </span>
                            {l.geradoPorContaFixa && (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                                Conta fixa
                              </span>
                            )}
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.18em]",
                                l.tipo === "receita"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-rose-50 text-rose-500"
                              )}
                            >
                              {l.tipo === "receita" ? "Receita" : "Despesa"}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:bg-slate-800 dark:text-slate-400">
                              <SourceIcon
                                origem={l.origem}
                                className={cn(
                                  "h-3 w-3",
                                  l.origem === "Imagem"
                                    ? "text-violet-400"
                                    : l.origem === "Audio"
                                      ? "text-sky-400"
                                      : l.origem === "Documento"
                                        ? "text-amber-400"
                                        : l.origem === "Importacao"
                                          ? "text-emerald-400"
                                          : "text-slate-400"
                                )}
                              />
                              {getOrigemLabel(l.origem)}
                            </span>
                            {l.parcelado && (
                              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:bg-slate-800 dark:text-slate-400">
                                {l.numeroParcelas}x
                              </span>
                            )}
                          </div>
                          <div
                            className="flex items-center justify-end gap-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openEdit(l)}
                              aria-label={`Editar lançamento ${l.descricao}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:border-emerald-200 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(l.id)}
                              aria-label={`Excluir lançamento ${l.descricao}`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-500/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {lancamentosData.totalPaginas > 1 && (
              <div className="flex flex-col gap-3 border-t border-slate-50 bg-slate-50/20 px-4 py-4 dark:border-slate-700/50 dark:bg-slate-800/20 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 lg:px-10">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                  {startIdx}–{endIdx} de {lancamentosData.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={pagina <= 1}
                    onClick={() => setPagina((p) => p - 1)}
                    aria-label="Ir para a página anterior"
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-4 py-2 text-[10px] font-bold text-slate-900 dark:text-white font-mono">
                    Página {pagina}
                  </span>
                  <button
                    disabled={pagina >= lancamentosData.totalPaginas}
                    onClick={() => setPagina((p) => p + 1)}
                    aria-label="Ir para a próxima página"
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-6 sm:p-12">
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
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpar filtros
                  </button>
                ) : (
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-slate-900 dark:bg-emerald-600 text-white px-6 py-3 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Plus className="h-3.5 w-3.5" />
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
                            const valorParcela =
                              !isNaN(valorNum) && valorNum > 0 ? valorNum / n : 0;
                            return (
                              <SelectItem key={n} value={n.toString()}>
                                {n}x{n === 1 ? " (à vista)" : ""}
                                {valorParcela > 0 && n > 1
                                  ? ` — ${formatCurrency(valorParcela)}/mês`
                                  : ""}
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
                                {nParcelas}x de{" "}
                                <strong>{formatCurrency(valorNum / nParcelas)}</strong>
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
            <DialogTitle className="sr-only">Editar Lançamento</DialogTitle>
            <DialogDescription className="sr-only">
              Altere os dados do lançamento.
            </DialogDescription>
            <DialogShellHeader
              icon={<Pencil className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Editar lançamento"
              description="Ajuste descrição, valor, categoria e data sem sair da visão principal."
              tone="emerald"
            />
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
            <DialogTitle className="sr-only">Detalhes do Lançamento</DialogTitle>
            <DialogDescription className="sr-only">
              Informações completas do lançamento selecionado.
            </DialogDescription>
            <DialogShellHeader
              icon={<Receipt className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Detalhes do lançamento"
              description="Revise categoria, pagamento, data e ações disponíveis para este registro."
              tone="blue"
            />
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
                  {viewingItem.geradoPorContaFixa && (
                    <Badge className="ml-2 text-[11px] mt-1 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                      Conta fixa
                    </Badge>
                  )}
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

                {viewingItem.geradoPorContaFixa && (
                  <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10 sm:col-span-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Receipt className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                        Origem vinculada
                      </span>
                    </div>
                    <p className="text-sm font-semibold">
                      {viewingItem.contaFixaOrigemDescricao ?? "Conta fixa"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Se este lançamento for excluído, a conta fixa voltará a ficar pendente.
                    </p>
                  </div>
                )}

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
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              {deletingLancamento?.geradoPorContaFixa
                ? "Este lançamento foi gerado a partir de uma conta fixa. Ao excluí-lo, a conta fixa voltará a ficar pendente. Deseja continuar?"
                : "Esta ação não pode ser desfeita. O lançamento será removido permanentemente."}
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Remover lançamento?"
              description={
                deletingLancamento?.geradoPorContaFixa
                  ? "Este lançamento foi gerado a partir de uma conta fixa. Ao excluí-lo, a conta fixa voltará a ficar pendente. Deseja continuar?"
                  : "Esta ação não pode ser desfeita. O lançamento será removido permanentemente."
              }
              tone="rose"
            />
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
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">Remover vários lançamentos?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              {selectedContaFixaCount > 0
                ? `${selectedContaFixaCount} lançamento(s) selecionado(s) foram gerados por conta fixa. Ao excluí-los, as respectivas contas voltarão a ficar pendentes.`
                : "Tem certeza que deseja remover os lançamentos selecionados? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Remover vários lançamentos?"
              description={
                selectedContaFixaCount > 0
                  ? `${selectedContaFixaCount} lançamento(s) selecionado(s) foram gerados por conta fixa. Ao excluí-los, as respectivas contas voltarão a ficar pendentes.`
                  : `Os ${selectedIds.length} lançamentos selecionados serão removidos de forma permanente.`
              }
              tone="rose"
            />
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
