"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
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
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Wifi,
  DollarSign,
  Wallet,
  CheckCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Shield,
  Info,
  RefreshCw,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";

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

  return { mesParam, label, isCurrentMonth, prev, next };
}

export default function CartoesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Cartao | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingFaturaId, setViewingFaturaId] = useState<{ id: number; nome: string } | null>(null);
  const [garantiaCard, setGarantiaCard] = useState<Cartao | null>(null);
  const [selectedCartaoId, setSelectedCartaoId] = useState<number | null>(null);
  const [garantiaTab, setGarantiaTab] = useState<string>("adicionar");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canScrollCardsLeft, setCanScrollCardsLeft] = useState(false);
  const [canScrollCardsRight, setCanScrollCardsRight] = useState(false);
  const cardsStripRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const { mesParam, label: mesLabel, prev, next } = useMonthSelector();

  const { data: cartoes = [], isLoading, isError, error } = useCartoes();
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cartoes"] }),
        queryClient.invalidateQueries({ queryKey: ["fatura"] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const totalDisponivel = cartoes.reduce((s, c) => s + (c.limiteDisponivel ?? c.limite), 0);

  useEffect(() => {
    const element = cardsStripRef.current;

    if (!element) {
      setCanScrollCardsLeft(false);
      setCanScrollCardsRight(false);
      return;
    }

    const updateScrollState = () => {
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      setCanScrollCardsLeft(element.scrollLeft > 8);
      setCanScrollCardsRight(maxScrollLeft - element.scrollLeft > 8);
    };

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [cartoes.length]);

  const scrollCards = (direction: "left" | "right") => {
    const element = cardsStripRef.current;

    if (!element) return;

    const amount = Math.max(element.clientWidth * 0.82, 280);
    element.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

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

  if (isError) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl serif-italic text-slate-900 dark:text-white">
            Cartões de Crédito
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold mt-2">
            Gestão de Limites e Faturas
          </p>
        </div>
        <ErrorState
          message={error?.message ?? "Erro ao carregar cartões"}
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  const totalLimite = cartoes.reduce((s, c) => s + c.limite, 0);
  const cardBgStyles = [
    "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950",
    "bg-slate-800",
    "bg-emerald-900",
    "bg-gradient-to-br from-blue-900 to-blue-950",
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* ═══ Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl serif-italic text-slate-900 dark:text-white">
            Cartões de Crédito
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold mt-2">
            Gestão de Limites e Faturas
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            aria-label="Atualizar cartões e faturas"
            aria-busy={isRefreshing}
            disabled={isRefreshing}
            className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 text-slate-500 dark:text-slate-400",
                isRefreshing && "animate-spin"
              )}
            />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-emerald-600 text-white px-5 sm:px-8 py-3 sm:py-4 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-emerald-500/20 hover:brightness-105 transition-all cursor-pointer w-full sm:w-auto justify-center"
          >
            <Plus className="h-5 w-5" />
            Novo Cartão
          </button>
        </div>
      </motion.div>

      {/* ═══ Stat Cards ═══ */}
      {isLoading ? (
        <CardSkeleton count={3} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="exec-card p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex items-center justify-between border-l-4 border-emerald-500"
            >
              <div>
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mb-2">
                  Limite Total
                </p>
                <span className="text-xl mono-data text-slate-900 dark:text-white font-medium">
                  {formatCurrency(totalLimite)}
                </span>
              </div>
              <Wallet className="text-slate-300 h-8 w-8 shrink-0" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={cn(
                "exec-card p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex items-center justify-between border-l-4",
                totalDisponivel >= 0 ? "border-emerald-300" : "border-rose-400"
              )}
            >
              <div>
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mb-2">
                  Limite Disponível Total
                </p>
                <span
                  className={cn(
                    "text-xl mono-data font-medium",
                    totalDisponivel >= 0 ? "text-emerald-600" : "text-rose-500"
                  )}
                >
                  {formatCurrency(totalDisponivel)}
                </span>
              </div>
              <CheckCircle className="text-slate-300 h-8 w-8 shrink-0" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="exec-card p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex items-center justify-between border-l-4 border-rose-400"
            >
              <div>
                <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mb-2">
                  Fatura Global
                </p>
                <span className="text-xl mono-data text-rose-500 font-bold">
                  {formatCurrency(faturaTotalMes)}
                </span>
              </div>
              <Receipt className="text-slate-300 h-8 w-8 shrink-0" />
            </motion.div>
          </div>

          {/* ═══ Horizontal Card Strip ═══ */}
          {cartoes.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-6 sm:p-10 lg:p-12"
            >
              <EmptyState
                icon={<CreditCard className="h-6 w-6" />}
                title="Nenhum cartão"
                description="Adicione um cartão de crédito para começar a rastrear suas faturas"
                action={
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-5 sm:px-8 py-3 sm:py-4 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 cursor-pointer w-full sm:w-auto justify-center"
                  >
                    <Plus className="h-4 w-4" /> Novo Cartão
                  </button>
                }
              />
            </motion.div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-linear-to-r from-[rgba(248,250,252,0.96)] to-transparent dark:from-[rgba(2,6,23,0.92)] md:block" />
                <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-linear-to-l from-[rgba(248,250,252,0.96)] to-transparent dark:from-[rgba(2,6,23,0.92)] md:block" />
                <button
                  type="button"
                  onClick={() => scrollCards("left")}
                  aria-label="Ver cartões anteriores"
                  disabled={!canScrollCardsLeft}
                  className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-2 text-slate-500 shadow-lg shadow-slate-200/70 transition disabled:pointer-events-none disabled:opacity-0 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:shadow-black/30 md:flex"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCards("right")}
                  aria-label="Ver próximos cartões"
                  disabled={!canScrollCardsRight}
                  className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-2 text-slate-500 shadow-lg shadow-slate-200/70 transition disabled:pointer-events-none disabled:opacity-0 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:shadow-black/30 md:flex"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div
                  ref={cardsStripRef}
                  className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar snap-x snap-mandatory touch-pan-x md:px-8 sm:gap-6"
                >
                {cartoes.map((cartao, i) => {
                  const bgClass = cardBgStyles[i % cardBgStyles.length];
                  const isSelected = selectedCartaoId === cartao.id;
                  const disponivel = cartao.limiteDisponivel ?? cartao.limite;
                  const availablePct =
                    cartao.limite > 0 ? Math.min((disponivel / cartao.limite) * 100, 100) : 0;
                  return (
                    <div
                      key={cartao.id}
                      onClick={() =>
                        setSelectedCartaoId((prev) => (prev === cartao.id ? null : cartao.id))
                      }
                      className={cn(
                        "snap-start shrink-0 w-72 sm:w-80 h-40 sm:h-48 rounded-xl sm:rounded-[2rem] p-5 sm:p-8 text-white flex flex-col justify-between border border-slate-700 shadow-xl cursor-pointer transition-all hover:-translate-y-1",
                        bgClass,
                        isSelected && "ring-2 ring-emerald-500 ring-offset-4"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[8px] uppercase tracking-widest opacity-60 mb-1">
                            Instituição
                          </p>
                          <p className="text-xs font-bold tracking-widest uppercase">
                            {cartao.nome}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Wifi className="h-4 w-4 opacity-40 rotate-90" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(cartao);
                            }}
                            aria-label={`Editar cartão ${cartao.nome}`}
                            className="size-7 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(cartao.id);
                            }}
                            aria-label={`Excluir cartão ${cartao.nome}`}
                            className="size-7 flex items-center justify-center text-white/40 hover:text-red-300 hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[9px] mb-2">
                          <span
                            className={cn(
                              "opacity-60",
                              disponivel < 0 && "text-rose-200 opacity-100"
                            )}
                          >
                            Disponível: {formatCurrency(disponivel)}
                          </span>
                          <span className="font-bold">Total: {formatCurrency(cartao.limite)}</span>
                        </div>
                        <div className="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              availablePct < 20 ? "bg-rose-400" : "bg-emerald-400"
                            )}
                            style={{ width: `${availablePct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="mono-data text-sm tracking-widest">•••• ••••</span>
                        <div className="text-right">
                          <p className="text-[7px] uppercase opacity-50">Vencimento</p>
                          <p className="text-[10px] font-bold">DIA {cartao.diaVencimento}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
              <p className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Deslize para os lados ou use as setas para ver outros cartões. Toque em um cartão para focar a fatura e liberar ações.
              </p>
            </div>
          )}

          {/* ═══ Fatura Section ═══ */}
          <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden">
            <div className="px-5 sm:px-10 py-5 sm:py-8 border-b border-slate-50 dark:border-slate-700/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mb-2">
                    Fatura Atual
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={prev}
                        aria-label="Exibir fatura do mês anterior"
                        className="p-1 hover:text-slate-600 text-slate-400 cursor-pointer transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xl serif-italic text-slate-900 dark:text-white">
                        {mesLabel}
                      </span>
                      <button
                        onClick={next}
                        aria-label="Exibir fatura do mês seguinte"
                        className="p-1 hover:text-slate-600 text-slate-400 cursor-pointer transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-bold rounded-full uppercase tracking-widest">
                      Aberta
                    </span>
                  </div>
                </div>
                <div className="h-10 w-px bg-slate-100 dark:bg-slate-700" />
                <div>
                  <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mb-2">
                    Valor Total
                  </p>
                  <span className="text-xl mono-data font-bold text-slate-900 dark:text-white">
                    {formatCurrency(faturaTotalMes)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedCartaoId && (
                  <button
                    onClick={() => {
                      const c = cartoes.find((x) => x.id === selectedCartaoId);
                      if (c) openGarantia(c, "adicionar");
                    }}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    Garantia
                  </button>
                )}
                {selectedCartaoId && (
                  <button
                    onClick={() => {
                      const c = cartoes.find((x) => x.id === selectedCartaoId);
                      if (c) setViewingFaturaId({ id: c.id, nome: c.nome });
                    }}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-100 cursor-pointer hover:brightness-105 transition-all"
                  >
                    Ver Fatura
                  </button>
                )}
              </div>
            </div>
            <FaturaMesSection
              cartoes={
                selectedCartaoId ? cartoes.filter((c) => c.id === selectedCartaoId) : cartoes
              }
              mesParam={mesParam}
              mesLabel={mesLabel}
            />
          </div>
        </>
      )}
      {/* ═══ Create Dialog ═══ */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/[0.08] bg-emerald-600/[0.03] p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 transition-all duration-500">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-semibold">Novo Cartão</DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5">
                  Adicione um cartão de crédito à sua conta
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div>
            <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4 sm:space-y-5">
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
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Dialog ═══ */}
      <Dialog open={editingCard !== null} onOpenChange={() => setEditingCard(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Editar Cartão</DialogTitle>
            <DialogDescription className="sr-only">
              Altere os dados do cartão selecionado.
            </DialogDescription>
            <DialogShellHeader
              icon={<CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Editar cartão"
              description="Atualize limite e datas de fechamento e vencimento do cartão."
              tone="emerald"
            />
          </DialogHeader>
          <div className="pb-4">
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
        </DialogContent>
      </Dialog>

      {/* ═══ Fatura Dialog ═══ */}
      <Dialog open={viewingFaturaId !== null} onOpenChange={() => setViewingFaturaId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <DialogTitle className="sr-only">Faturas pendentes</DialogTitle>
            <DialogDescription className="sr-only">
              Faturas pendentes do cartão selecionado.
            </DialogDescription>
            <DialogShellHeader
              icon={<CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />}
              title={
                viewingFaturaId?.nome ? `Faturas de ${viewingFaturaId.nome}` : "Faturas pendentes"
              }
              description="Veja a lista de faturas abertas e acompanhe os lançamentos vinculados."
              tone="blue"
            />
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-5 sm:px-7 pb-5 pt-2">
            {viewingFaturaId && <FaturaView cartaoId={viewingFaturaId.id} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Garantia Dialog ═══ */}
      <Dialog open={garantiaCard !== null} onOpenChange={() => setGarantiaCard(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
          <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 space-y-3">
            <DialogHeader className="space-y-1">
              <DialogTitle className="sr-only">Garantia do cartão</DialogTitle>
              <DialogDescription className="sr-only">
                Adicione ou resgate a garantia deste cartão.
              </DialogDescription>
              <DialogShellHeader
                icon={<Shield className="h-5 w-5 sm:h-6 sm:w-6" />}
                title={
                  garantiaCard?.nome ? `Garantia de ${garantiaCard.nome}` : "Garantia do cartão"
                }
                description="Adicione ou resgate garantia e acompanhe o bônus aplicado ao limite."
                tone="emerald"
              />
            </DialogHeader>

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
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Confirmation ═══ */}
      <AlertDialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">Desativar cartão?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              O cartão será desativado e não aparecerá mais na listagem. As faturas existentes serão
              mantidas.
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Desativar cartão?"
              description="O cartão será desativado e não aparecerá mais na listagem. As faturas existentes serão mantidas."
              tone="rose"
            />
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
