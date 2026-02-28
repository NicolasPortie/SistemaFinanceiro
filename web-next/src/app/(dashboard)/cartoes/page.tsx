"use client";

import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  useCartoes,
  useCriarCartao,
  useAtualizarCartao,
  useDesativarCartao,
  useAdicionarLimiteExtra,
  useResgatarLimiteExtra,
} from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/format";
import { cartaoSchema, type CartaoData } from "@/lib/schemas";
import type { Cartao } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Calendar,
  Wifi,
  TrendingUp,
  DollarSign,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Shield,
  Info,
  RefreshCw,
  MoreVertical,
  CheckCircle,
  Receipt,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
// Dialog components (except AlertDialog) removed in favor of Sheet
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
import { FaturaView } from "@/components/cartoes/fatura-view";
import { FaturaMesSection } from "@/components/cartoes/fatura-mes-section";
import { cn } from "@/lib/utils";

const cardStyles = [
  {
    bg: "bg-gradient-to-br from-[#1e3a8a] to-[#172554]",
    accent: "text-blue-200",
    titleClass: "text-white",
    numberClass: "text-blue-100",
  },
  {
    bg: "bg-gradient-to-br from-[#94a3b8] to-[#475569]",
    accent: "text-slate-300",
    titleClass: "text-slate-100",
    numberClass: "text-slate-200",
  },
  {
    bg: "bg-gradient-to-br from-[#18181b] to-[#09090b]",
    accent: "text-gray-400",
    titleClass: "text-gray-200",
    numberClass: "text-gray-400",
  },
];

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
  // Default to next month: we spend in the current month and pay next month's bill
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [year, setYear] = useState(nextMonth.getFullYear());
  const [month, setMonth] = useState(nextMonth.getMonth());

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const mesParam = `${year}-${String(month + 1).padStart(2, "0")}`;
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
    setYear(nextMonth.getFullYear());
    setMonth(nextMonth.getMonth());
  };

  return { mesParam, label, isCurrentMonth, prev, next, reset };
}

export default function CartoesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Cartao | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingFaturaId, setViewingFaturaId] = useState<{ id: number; nome: string } | null>(null);
  const [garantiaCard, setGarantiaCard] = useState<Cartao | null>(null);
  const [garantiaTab, setGarantiaTab] = useState<string>("adicionar");

  const { mesParam, label: mesLabel, isCurrentMonth, prev, next, reset } = useMonthSelector();

  const { data: cartoes = [], isLoading, isError, error, refetch } = useCartoes();
  const criarCartao = useCriarCartao();
  const atualizarCartao = useAtualizarCartao();
  const desativarCartao = useDesativarCartao();
  const adicionarLimiteExtra = useAdicionarLimiteExtra();
  const resgatarLimiteExtra = useResgatarLimiteExtra();

  const form = useForm<CartaoData>({
    resolver: zodResolver(cartaoSchema),
    defaultValues: { nome: "", limite: "", diaFechamento: "", diaVencimento: "" },
  });

  const editFormState = useForm<CartaoData>({
    resolver: zodResolver(cartaoSchema),
  });

  const ajusteForm = useForm<{ valorAdicional: string; percentualExtra: string }>({
    defaultValues: { valorAdicional: "", percentualExtra: "40" },
  });

  const valorAdicionalWatch = parseFloat(
    ajusteForm.watch("valorAdicional")?.replace(",", ".") || "0"
  );
  const percentualExtraWatch = parseFloat(
    ajusteForm.watch("percentualExtra")?.replace(",", ".") || "0"
  );
  const valorExtraCalculado = valorAdicionalWatch * (percentualExtraWatch / 100);
  const novoLimiteCalculado =
    (garantiaCard?.limite || 0) + valorAdicionalWatch + valorExtraCalculado;

  const resgateForm = useForm<{ valorResgate: string }>({ defaultValues: { valorResgate: "" } });
  const PERCENTUAL_BONUS_FIXO = 40;
  const valorResgateRaw = parseFloat(resgateForm.watch("valorResgate")?.replace(",", ".") || "0");
  const valorResgateBase = Math.floor(valorResgateRaw);
  const garantiaDisponivel = garantiaCard?.garantia || 0;
  const resgateExcedeGarantia = valorResgateBase > garantiaDisponivel;
  const reducaoLimite = valorResgateBase * (1 + PERCENTUAL_BONUS_FIXO / 100);
  const novoLimiteResgate = (garantiaCard?.limite || 0) - reducaoLimite;
  const maxResgatePermitido = Math.min(
    garantiaDisponivel,
    Math.floor((garantiaCard?.limite || 0) / (1 + PERCENTUAL_BONUS_FIXO / 100))
  );

  const onSubmitCreate = (data: CartaoData) => {
    criarCartao.mutate(
      {
        nome: data.nome,
        limite: parseFloat(data.limite.replace(",", ".")),
        diaFechamento: parseInt(data.diaFechamento),
        diaVencimento: parseInt(data.diaVencimento),
      },
      {
        onSuccess: () => {
          form.reset();
          setShowForm(false);
        },
      }
    );
  };

  const onSubmitEdit = (data: CartaoData) => {
    if (!editingCard) return;
    atualizarCartao.mutate(
      {
        id: editingCard.id,
        data: {
          nome: data.nome,
          limite: parseFloat(data.limite.replace(",", ".")),
          diaFechamento: parseInt(data.diaFechamento),
          diaVencimento: parseInt(data.diaVencimento),
        },
      },
      { onSuccess: () => setEditingCard(null) }
    );
  };

  const onDelete = () => {
    if (deletingId === null) return;
    desativarCartao.mutate(deletingId, { onSuccess: () => setDeletingId(null) });
  };

  const openEdit = (cartao: Cartao) => {
    editFormState.reset({
      nome: cartao.nome,
      limite: cartao.limiteBase.toFixed(2).replace(".", ","),
      diaFechamento: cartao.diaFechamento.toString(),
      diaVencimento: cartao.diaVencimento.toString(),
    });
    setEditingCard(cartao);
  };

  const openGarantia = (cartao: Cartao, tab: string = "adicionar") => {
    ajusteForm.reset({ valorAdicional: "", percentualExtra: "40" });
    resgateForm.reset({ valorResgate: "" });
    setGarantiaTab(tab);
    setGarantiaCard(cartao);
  };

  const onSubmitAjuste = (data: { valorAdicional: string; percentualExtra: string }) => {
    if (!garantiaCard) return;
    adicionarLimiteExtra.mutate(
      {
        id: garantiaCard.id,
        data: {
          valorAdicional: parseFloat(data.valorAdicional.replace(",", ".")),
          percentualExtra: parseFloat(data.percentualExtra.replace(",", ".")),
        },
      },
      { onSuccess: () => setGarantiaCard(null) }
    );
  };

  const onSubmitResgate = (data: { valorResgate: string }) => {
    if (!garantiaCard) return;
    if (resgateExcedeGarantia || novoLimiteResgate < 0) return;
    resgatarLimiteExtra.mutate(
      {
        id: garantiaCard.id,
        data: {
          valorResgate: parseFloat(data.valorResgate.replace(",", ".")),
          percentualBonus: PERCENTUAL_BONUS_FIXO,
        },
      },
      { onSuccess: () => setGarantiaCard(null) }
    );
  };

  const totalLimite = cartoes.reduce((s, c) => s + c.limite, 0);
  const totalUsado = cartoes.reduce((s, c) => s + c.limiteUsado, 0);
  const totalDisponivel = cartoes.reduce((s, c) => s + (c.limiteDisponivel ?? c.limite), 0);
  const usagePercent = totalLimite > 0 ? Math.round((totalUsado / totalLimite) * 100) : 0;

  // Fetch faturas for all cards to show monthly total in stat card
  const faturaQueries = useQueries({
    queries: cartoes.map((c) => ({
      queryKey: ["fatura", c.id, mesParam] as const,
      queryFn: () => api.cartoes.faturas(c.id, mesParam),
      staleTime: 2 * 60 * 1000,
      retry: false,
    })),
  });

  const faturaTotalMes = useMemo(() => {
    let total = 0;
    faturaQueries.forEach((q) => {
      if (!q.data) return;
      const fatura = q.data[0];
      if (fatura) total += fatura.total;
    });
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faturaQueries.map((q) => q.dataUpdatedAt).join(",")]);

  const faturaPercent = totalLimite > 0 ? Math.round((faturaTotalMes / totalLimite) * 100) : 0;

  if (isError) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 rounded-2xl p-4 lg:p-5 shadow-sm"
        >
          <h2 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            Cartões
          </h2>
        </motion.div>
        <ErrorState message={error?.message ?? "Erro ao carregar cartões"} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ Action Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 rounded-2xl p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 flex items-center justify-center bg-emerald-600/10 rounded-xl">
              <CreditCard className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                Cartões
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Gerencie seus cartões e visualize faturas
              </p>
            </div>
          </div>
          <div className="hidden sm:block h-8 w-px bg-slate-300 dark:bg-slate-600" />
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
              {mesLabel}
            </button>
            <button
              onClick={next}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
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
                  onClick={() => refetch()}
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
            <span className="hidden sm:inline">Adicionar Cartão</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </motion.div>

      {/* ═══ Stat Cards ═══ */}
      {isLoading ? (
        <CardSkeleton count={3} />
      ) : cartoes.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
            {/* Total de Cartões */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
            >
              <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
              <div className="flex justify-between items-start z-10">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                    Total de Cartões
                  </p>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                    {cartoes.length} {cartoes.length === 1 ? "Ativo" : "Ativos"}
                  </h3>
                </div>
                <div className="size-10 flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/15 rounded-xl text-emerald-600">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </motion.div>

            {/* Limite Disponível Total */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
            >
              <div className="absolute -right-6 -bottom-6 bg-green-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-green-500/15 transition-all" />
              <div className="flex justify-between items-start z-10">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                    Limite Disponível Total
                  </p>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                    {formatCurrency(totalDisponivel)}
                  </h3>
                </div>
                <div className="size-10 flex items-center justify-center bg-green-100 dark:bg-green-500/15 rounded-xl text-green-600 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700/40 rounded-full h-1.5 mt-auto z-10">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${totalLimite > 0 ? Math.round((totalDisponivel / totalLimite) * 100) : 0}%`,
                  }}
                />
              </div>
            </motion.div>

            {/* Fatura Total do Mês */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300 ring-1 ring-emerald-600/20 bg-white/90 dark:bg-slate-800/90"
            >
              <div className="absolute -right-6 -bottom-6 bg-emerald-600/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-600/15 transition-all" />
              <div className="flex justify-between items-start z-10">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                    Fatura Total do Mês
                  </p>
                  <h3 className="text-2xl font-bold text-emerald-600 tracking-tight">
                    {formatCurrency(faturaTotalMes)}
                  </h3>
                </div>
                <div className="size-10 flex items-center justify-center bg-red-100 dark:bg-red-500/15 rounded-xl text-red-600 dark:text-red-400">
                  <Receipt className="h-5 w-5" />
                </div>
              </div>
              {faturaPercent > 0 && (
                <div className="flex items-center gap-1 text-xs font-medium mt-auto z-10 text-red-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {faturaPercent}% do limite utilizado
                </div>
              )}
            </motion.div>
          </div>

          {/* ═══ Card Grid ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {cartoes.map((cartao, i) => {
                const style = cardStyles[i % cardStyles.length];
                return (
                  <motion.div
                    key={cartao.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="glass-panel p-6 rounded-3xl flex flex-col gap-6 hover:shadow-lg transition-all duration-300"
                  >
                    {/* ── Credit Card Visual ── */}
                    <div
                      className={cn(
                        style.bg,
                        "rounded-2xl p-6 text-white relative overflow-hidden shadow-lg h-52 flex flex-col justify-between group"
                      )}
                    >
                      <div className="absolute -right-10 -top-10 bg-white/10 w-40 h-40 rounded-full blur-3xl" />
                      <div className="absolute -left-10 -bottom-10 bg-black/20 w-40 h-40 rounded-full blur-3xl" />

                      {/* Top: brand + actions */}
                      <div className="flex justify-between items-start z-10">
                        <span className={cn("font-bold text-lg tracking-wider", style.titleClass)}>
                          Control Finance
                        </span>
                        <div className="flex items-center gap-1">
                          <Wifi className="h-4 w-4 text-white/40 rotate-90" />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="size-8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-40">
                              <DropdownMenuItem
                                onClick={() => openEdit(cartao)}
                                className="gap-2 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeletingId(cartao.id)}
                                className="gap-2 text-red-600 focus:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Desativar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Chip + contactless */}
                      <div className="z-10 flex items-center gap-3">
                        <div className="w-10 h-7 bg-linear-to-br from-yellow-400 to-yellow-600 rounded-md border border-yellow-600/50 shadow-inner" />
                      </div>

                      {/* Bottom: titular + number */}
                      <div className="z-10">
                        <div className="flex justify-between items-end">
                          <div>
                            <p
                              className={cn("text-xs uppercase tracking-wider mb-1", style.accent)}
                            >
                              Titular
                            </p>
                            <p className={cn("font-medium tracking-wide", style.titleClass)}>
                              {cartao.nome.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "mt-2 text-sm tracking-[0.15em] font-mono",
                            style.numberClass
                          )}
                        >
                          •••• •••• •••• ••••
                        </div>
                      </div>
                    </div>

                    {/* ── Card Info ── */}
                    <div className="space-y-4">
                      {/* Limite + Garantia */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700/30">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">
                            Limite Disponível
                          </p>
                          <p className="text-lg font-bold text-slate-800 dark:text-white">
                            {formatCurrency(cartao.limiteDisponivel ?? cartao.limite)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase">
                            Garantia
                          </p>
                          <p
                            className={cn(
                              "text-sm font-bold",
                              cartao.garantia > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-slate-400 dark:text-slate-500"
                            )}
                          >
                            {cartao.garantia > 0
                              ? `+ ${formatCurrency(cartao.garantia)}`
                              : formatCurrency(0)}
                          </p>
                        </div>
                      </div>

                      {/* Fechamento / Vencimento */}
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex flex-col">
                          <span className="text-slate-500 dark:text-slate-400 text-xs">
                            Fechamento
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            Dia {cartao.diaFechamento}
                          </span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-slate-500 dark:text-slate-400 text-xs">
                            Vencimento
                          </span>
                          <span className="font-semibold text-red-500">
                            Dia {cartao.diaVencimento}
                          </span>
                        </div>
                      </div>

                      {/* Usage bar */}
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                          <span>Usado: {formatCurrency(cartao.limiteUsado)}</span>
                          <span>de {formatCurrency(cartao.limite)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/40 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              cartao.limiteUsado / cartao.limite > 0.8
                                ? "bg-red-500"
                                : cartao.limiteUsado / cartao.limite > 0.5
                                  ? "bg-amber-500"
                                  : "bg-emerald-600"
                            )}
                            style={{
                              width: `${Math.min((cartao.limiteUsado / cartao.limite) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setViewingFaturaId({ id: cartao.id, nome: cartao.nome })}
                          className="flex-1 py-2 text-xs font-semibold bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Fatura
                        </button>
                        <button
                          onClick={() => openGarantia(cartao, "adicionar")}
                          className="flex-1 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ArrowUpFromLine className="h-3.5 w-3.5" />
                          Garantia
                        </button>
                        <button
                          onClick={() => openGarantia(cartao, "resgatar")}
                          disabled={cartao.garantia <= 0}
                          className="py-2 px-3 text-xs font-semibold bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Resgatar Garantia"
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* ═══ Fatura do Mês (inline) ═══ */}
          <FaturaMesSection cartoes={cartoes} mesParam={mesParam} mesLabel={mesLabel} />
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-12"
        >
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Nenhum cartão"
            description="Adicione um cartão de crédito para começar a rastrear suas faturas"
            action={
              <button
                onClick={() => setShowForm(true)}
                className="bg-emerald-600 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer text-sm"
              >
                <Plus className="h-4 w-4" />
                Adicionar cartão
              </button>
            }
          />
        </motion.div>
      )}

      {/* ═══ Create Sheet ═══ */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="w-full sm:w-125 sm:max-w-125 overflow-hidden">
          <div className="h-1.5 w-full shrink-0 bg-linear-to-r from-emerald-600 via-emerald-400 to-teal-500 shadow-[0_2px_8px_rgba(16,185,129,0.3)]" />

          <SheetHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/[0.08] bg-emerald-600/[0.03] p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 transition-all duration-500">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg sm:text-xl font-semibold">Novo Cartão</SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">
                  Adicione um cartão de crédito à sua conta
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form
              onSubmit={form.handleSubmit(onSubmitCreate)}
              className="px-5 sm:px-7 pb-8 space-y-4 sm:space-y-5"
            >
              <div className="space-y-4 rounded-2xl border border-emerald-600/[0.08] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Nome do cartão
                  </Label>
                  <Input
                    placeholder="Ex: Nubank, Inter..."
                    className="h-11 rounded-xl border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                    {...form.register("nome")}
                  />
                  {form.formState.errors.nome && (
                    <p className="text-xs text-red-500 font-medium">
                      {form.formState.errors.nome.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Limite (R$)
                  </Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-emerald-600/10 text-emerald-600">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className="h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                      value={form.watch("limite")}
                      onValueChange={(v) =>
                        form.setValue("limite", v, { shouldValidate: form.formState.isSubmitted })
                      }
                    />
                  </div>
                  {form.formState.errors.limite && (
                    <p className="text-xs text-red-500 font-medium">
                      {form.formState.errors.limite.message}
                    </p>
                  )}
                </div>

                <div className="border-t border-border/20" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Dia de fechamento
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                      <Input
                        placeholder="Ex: 15"
                        className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                        {...form.register("diaFechamento")}
                      />
                    </div>
                    {form.formState.errors.diaFechamento && (
                      <p className="text-xs text-red-500 font-medium">
                        {form.formState.errors.diaFechamento.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Dia de vencimento
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                      <Input
                        placeholder="Ex: 25"
                        className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                        {...form.register("diaVencimento")}
                      />
                    </div>
                    {form.formState.errors.diaVencimento && (
                      <p className="text-xs text-red-500 font-medium">
                        {form.formState.errors.diaVencimento.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-600/[0.08] bg-emerald-600/[0.03] p-4 sm:p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-600/50" />
                  <span>
                    <strong>Fechamento:</strong> dia em que a fatura fecha. Compras após essa data
                    entram na fatura seguinte.
                  </span>
                </p>
              </div>

              <div className="pt-2 sm:pt-3 pb-safe">
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-semibold text-sm sm:text-[15px] bg-emerald-600 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-white transition-all duration-300 cursor-pointer active:scale-[0.98]"
                  loading={criarCartao.isPending}
                >
                  <CreditCard className="h-5 w-5" />
                  Criar Cartão
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Edit Sheet ═══ */}
      <Sheet open={editingCard !== null} onOpenChange={() => setEditingCard(null)}>
        <SheetContent className="w-full sm:w-125 sm:max-w-125 overflow-hidden">
          <SheetHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <SheetTitle className="text-lg font-bold tracking-tight">Editar Cartão</SheetTitle>
            <SheetDescription>Altere os dados do cartão</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7 pb-8">
            <form onSubmit={editFormState.handleSubmit(onSubmitEdit)} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nome do cartão
                </Label>
                <Input className="h-11 rounded-xl" {...editFormState.register("nome")} />
                {editFormState.formState.errors.nome && (
                  <p className="text-xs text-red-500">
                    {editFormState.formState.errors.nome.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Limite (R$)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <CurrencyInput
                    className="h-11 rounded-xl pl-9 tabular-nums font-semibold"
                    value={editFormState.watch("limite") ?? ""}
                    onValueChange={(v) =>
                      editFormState.setValue("limite", v, {
                        shouldValidate: editFormState.formState.isSubmitted,
                      })
                    }
                  />
                </div>
                {editFormState.formState.errors.limite && (
                  <p className="text-xs text-red-500">
                    {editFormState.formState.errors.limite.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dia de fechamento
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      className="h-11 rounded-xl pl-9"
                      {...editFormState.register("diaFechamento")}
                    />
                  </div>
                  {editFormState.formState.errors.diaFechamento && (
                    <p className="text-xs text-red-500">
                      {editFormState.formState.errors.diaFechamento.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dia de vencimento
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      className="h-11 rounded-xl pl-9"
                      {...editFormState.register("diaVencimento")}
                    />
                  </div>
                  {editFormState.formState.errors.diaVencimento && (
                    <p className="text-xs text-red-500">
                      {editFormState.formState.errors.diaVencimento.message}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                loading={atualizarCartao.isPending}
              >
                Salvar alterações
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Fatura Sheet ═══ */}
      <Sheet open={viewingFaturaId !== null} onOpenChange={() => setViewingFaturaId(null)}>
        <SheetContent className="w-full sm:w-150 sm:max-w-150 overflow-hidden flex flex-col p-0">
          <SheetHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5 bg-muted/20">
            <SheetTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {viewingFaturaId?.nome}
            </SheetTitle>
            <SheetDescription>Faturas pendentes</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 px-5 sm:px-7 pb-5 pt-2">
            {viewingFaturaId && <FaturaView cartaoId={viewingFaturaId.id} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Garantia Sheet ═══ */}
      <Sheet open={garantiaCard !== null} onOpenChange={() => setGarantiaCard(null)}>
        <SheetContent className="w-full sm:w-125 sm:max-w-125 p-0 gap-0 overflow-hidden flex flex-col">
          <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 space-y-3">
            <SheetHeader className="space-y-1">
              <SheetTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-500" />
                Garantia — {garantiaCard?.nome}
              </SheetTitle>
              <SheetDescription>Adicione ou resgate a garantia deste cartão.</SheetDescription>
            </SheetHeader>

            <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/15 p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Como funciona?
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A garantia é um valor que você deposita para aumentar o limite do cartão. O banco
                concede um bônus de {PERCENTUAL_BONUS_FIXO}% sobre o valor depositado. Exemplo:
                depositar R$ 1.000 aumenta seu limite em R$ 1.400 (R$ 1.000 + 40% de bônus).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/20 border border-border/30 p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
                  Limite Atual
                </p>
                <p className="text-base font-extrabold tabular-nums mt-0.5">
                  {formatCurrency(garantiaCard?.limite || 0)}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-semibold">
                  Garantia Investida
                </p>
                <p className="text-base font-extrabold tabular-nums mt-0.5 text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(garantiaDisponivel)}
                </p>
              </div>
            </div>
          </div>

          <Tabs value={garantiaTab} onValueChange={(v) => setGarantiaTab(v)} className="gap-0">
            <div className="px-6">
              <TabsList className="w-full">
                <TabsTrigger value="adicionar" className="gap-1.5">
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                  Adicionar
                </TabsTrigger>
                <TabsTrigger value="resgatar" className="gap-1.5">
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  Resgatar
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="adicionar" className="px-6 pb-6 pt-4">
              <form onSubmit={ajusteForm.handleSubmit(onSubmitAjuste)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Valor da garantia (R$)
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <CurrencyInput
                      className="h-12 rounded-xl pl-9 tabular-nums font-bold text-lg"
                      placeholder="0,00"
                      value={ajusteForm.watch("valorAdicional")}
                      onValueChange={(v) => ajusteForm.setValue("valorAdicional", v)}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/60">
                    Bônus de {percentualExtraWatch}% será aplicado automaticamente (+
                    {formatCurrency(valorExtraCalculado)}).
                  </p>
                </div>

                <div className="rounded-xl bg-muted/20 p-4 space-y-2.5 border border-border/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground/70 font-medium">
                      Aumento no limite (×{(1 + percentualExtraWatch / 100).toFixed(1)}):
                    </span>
                    <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      + {formatCurrency(valorAdicionalWatch + valorExtraCalculado)}
                    </span>
                  </div>
                  <div className="h-px bg-border/30" />
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-foreground text-sm">Novo Limite:</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums text-base">
                      {formatCurrency(novoLimiteCalculado)}
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-2xl font-bold text-[15px] gap-2 bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                  disabled={valorAdicionalWatch <= 0}
                  loading={adicionarLimiteExtra.isPending}
                >
                  <ArrowUpFromLine className="h-4.5 w-4.5" /> Adicionar Garantia
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="resgatar" className="px-6 pb-6 pt-4">
              {garantiaDisponivel <= 0 ? (
                <div className="text-center py-8 space-y-3">
                  <div className="mx-auto h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nenhuma garantia investida para resgatar.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setGarantiaTab("adicionar")}
                  >
                    Adicionar garantia
                  </Button>
                </div>
              ) : (
                <form onSubmit={resgateForm.handleSubmit(onSubmitResgate)} className="space-y-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Valor a Resgatar (R$)
                      </Label>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        onClick={() =>
                          resgateForm.setValue(
                            "valorResgate",
                            maxResgatePermitido.toString().replace(".", ",")
                          )
                        }
                      >
                        Máx: {formatCurrency(maxResgatePermitido)}
                      </button>
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                      <CurrencyInput
                        className={cn(
                          "h-11 rounded-xl pl-9 tabular-nums font-semibold",
                          resgateExcedeGarantia &&
                            valorResgateBase > 0 &&
                            "border-red-500 focus-visible:ring-red-500/30"
                        )}
                        placeholder="0,00"
                        value={resgateForm.watch("valorResgate")}
                        onValueChange={(v) => resgateForm.setValue("valorResgate", v)}
                      />
                    </div>
                    {resgateExcedeGarantia && valorResgateBase > 0 && (
                      <p className="text-[11px] text-red-500 font-medium">
                        Valor excede a garantia disponível ({formatCurrency(garantiaDisponivel)})
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-muted/20 p-4 space-y-2.5 border border-border/30">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground/70 font-medium">Valor devolvido:</span>
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        + {formatCurrency(valorResgateBase)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground/70 font-medium">
                        Limite reduzido (×{(1 + PERCENTUAL_BONUS_FIXO / 100).toFixed(1)}):
                      </span>
                      <span className="font-bold tabular-nums text-red-500">
                        - {formatCurrency(reducaoLimite)}
                      </span>
                    </div>
                    <div className="h-px bg-border/30" />
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-foreground text-sm">Novo Limite:</span>
                      <span
                        className={cn(
                          "font-extrabold tabular-nums text-base",
                          novoLimiteResgate >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-500"
                        )}
                      >
                        {formatCurrency(novoLimiteResgate)}
                      </span>
                    </div>
                  </div>

                  {novoLimiteResgate < 0 && valorResgateBase > 0 && !resgateExcedeGarantia && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                      <p className="text-[11px] text-red-500 font-medium">
                        O limite ficaria negativo. Reduza o valor.
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-2xl font-bold text-[15px] gap-2 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/20"
                    disabled={
                      novoLimiteResgate < 0 || valorResgateBase < 1 || resgateExcedeGarantia
                    }
                    loading={resgatarLimiteExtra.isPending}
                  >
                    <ArrowDownToLine className="h-4.5 w-4.5" /> Resgatar Garantia
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* ═══ Delete Confirmation ═══ */}
      <AlertDialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              O cartão será desativado e não aparecerá mais na listagem. As faturas existentes serão
              mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2"
              loading={desativarCartao.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
