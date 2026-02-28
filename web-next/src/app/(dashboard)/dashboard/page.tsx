"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import {
  useResumo,
  useCartoes,
  useLancamentos,
  useMetas,
  useLimites,
  useResumoHistorico,
  queryKeys,
} from "@/hooks/use-queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { AnimatedCurrency, AnimatedPercent } from "@/components/ui/animated-value";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Activity,
  Target,
  CreditCard,
  Send,
  Lightbulb,
  ArrowRight,
  Percent,
} from "lucide-react";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/page-components";
import { EvolutionChart } from "@/components/charts";
import { useQueryClient } from "@tanstack/react-query";
import { TelegramOnboarding } from "@/components/dashboard";

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

const categoryColors = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#f97316",
  "#6366f1",
  "#14b8a6",
];

function getFinancialHealth(receitas: number, gastos: number) {
  if (receitas <= 0)
    return { label: "Sem dados", color: "text-slate-500", bg: "bg-slate-500", pct: 0 };
  const taxa = ((receitas - gastos) / receitas) * 100;
  if (taxa >= 30)
    return {
      label: "Excelente",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500",
      pct: Math.min(taxa, 100),
    };
  if (taxa >= 15)
    return {
      label: "Boa",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500",
      pct: taxa,
    };
  if (taxa >= 5)
    return {
      label: "Regular",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500",
      pct: taxa,
    };
  if (taxa >= 0)
    return {
      label: "Apertada",
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500",
      pct: taxa,
    };
  return { label: "Crítica", color: "text-red-600 dark:text-red-400", bg: "bg-red-500", pct: 0 };
}

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

  return { mesParam, label, isCurrentMonth, prev, next, reset };
}

export default function DashboardPage() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const { mesParam, label, isCurrentMonth, prev, next, reset } = useMonthSelector();

  const {
    data: resumo,
    isLoading: loadingResumo,
    isError: errorResumo,
    error: resumoError,
  } = useResumo(mesParam);
  const { data: cartoes = [], isLoading: loadingCartoes } = useCartoes();
  const { data: lancamentos } = useLancamentos({ pagina: 1, tamanhoPagina: 5 });
  const { data: metas = [] } = useMetas();
  const { data: limites = [] } = useLimites();
  const { data: historicoData, isLoading: loadingHistorico } = useResumoHistorico(6);

  const loading = loadingResumo || loadingCartoes;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.resumo(mesParam) });
    queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
  };

  const health = resumo ? getFinancialHealth(resumo.totalReceitas, resumo.totalGastos) : null;
  const comprometimentoReceita =
    resumo && resumo.totalReceitas > 0
      ? Math.round((resumo.totalGastos / resumo.totalReceitas) * 100)
      : null; // null = sem receita
  const metasAtivas = metas.filter((m) => m.status === "ativa");

  // Category donut
  const categoryTotal =
    resumo?.gastosPorCategoria?.reduce((s: number, g: { total: number }) => s + g.total, 0) ?? 0;
  const categorySegments = (resumo?.gastosPorCategoria ?? []).map((g, i) => ({
    ...g,
    percent: categoryTotal > 0 ? (g.total / categoryTotal) * 100 : 0,
    color: categoryColors[i % categoryColors.length],
  }));
  let conicGradient = "conic-gradient(";
  let cumPercent = 0;
  categorySegments.forEach((seg, i) => {
    conicGradient += `${seg.color} ${cumPercent}% ${cumPercent + seg.percent}%`;
    cumPercent += seg.percent;
    if (i < categorySegments.length - 1) conicGradient += ", ";
  });
  conicGradient += ")";
  if (categorySegments.length === 0) conicGradient = "conic-gradient(#e2e8f0 0% 100%)";

  // Card data
  const firstCard = cartoes.length > 0 ? cartoes[0] : null;
  const cardUsedPercent =
    firstCard && firstCard.limite > 0
      ? Math.round((firstCard.limiteUsado / firstCard.limite) * 100)
      : 0;

  return (
    <>
      <TelegramOnboarding />

      {/* ═══ Action Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-4 lg:p-5 mb-6 lg:mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <h2 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            Visão Geral
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
          {health && health.label !== "Sem dados" && (
            <div
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border shadow-sm",
                health.label === "Excelente" || health.label === "Boa"
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"
                  : health.label === "Regular"
                    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-500/20"
                    : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-100 dark:border-red-500/20"
              )}
            >
              <Activity className="h-4 w-4" />
              Saúde: {health.label}
            </div>
          )}
          <Link href="/lancamentos">
            <button className="bg-emerald-600 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer text-sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Lançamento</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </Link>
        </div>
      </motion.div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : errorResumo ? (
        <ErrorState message={resumoError?.message} onRetry={handleRefresh} />
      ) : resumo ? (
        <div className="grid grid-cols-12 gap-6 xl:gap-8">
          {/* ═══ Main Content ═══ */}
          <div className="col-span-12 xl:col-span-9 space-y-6 xl:space-y-8">
            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
              {/* Receitas */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
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
                    <AnimatedCurrency value={resumo.totalReceitas} />
                  </h3>
                </div>
              </motion.div>

              {/* Gastos */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
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
                    <AnimatedCurrency value={resumo.totalGastos} />
                  </h3>
                </div>
              </motion.div>

              {/* Saldo */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
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
                    Saldo Atual
                  </p>
                  <h3
                    className={cn(
                      "text-2xl font-bold tracking-tight",
                      resumo.saldo >= 0
                        ? "text-slate-800 dark:text-white"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    <AnimatedCurrency value={resumo.saldo} />
                  </h3>
                </div>
              </motion.div>

              {/* % Comprometido */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-36 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
              >
                <div className="absolute -right-6 -bottom-6 bg-amber-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-amber-500/15 transition-all" />
                <div className="flex justify-between items-start z-10">
                  <div className="size-10 flex items-center justify-center bg-amber-100 dark:bg-amber-500/15 rounded-xl text-amber-600 dark:text-amber-400">
                    <Percent className="h-5 w-5" />
                  </div>
                </div>
                <div className="z-10 mt-auto space-y-2">
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
                    % Comprometido
                  </p>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                    {comprometimentoReceita !== null ? (
                      <AnimatedPercent value={comprometimentoReceita} decimals={0} />
                    ) : (
                      "—"
                    )}
                  </h3>
                  {comprometimentoReceita !== null && (
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-700",
                          comprometimentoReceita <= 50
                            ? "bg-emerald-500"
                            : comprometimentoReceita <= 80
                              ? "bg-amber-500"
                              : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(comprometimentoReceita, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* ── Charts Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Evolution Chart (2/3) */}
              {!loadingHistorico && historicoData && historicoData.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="lg:col-span-2 glass-panel p-6 rounded-2xl"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                        Evolução Semestral
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Receitas vs Gastos
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Receitas
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-400" /> Gastos
                      </span>
                    </div>
                  </div>
                  <EvolutionChart data={historicoData} />
                </motion.div>
              )}

              {/* Category Donut (1/3) */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="glass-panel p-6 rounded-2xl flex flex-col"
              >
                <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-6">
                  Gastos por Categoria
                </h3>
                {categorySegments.length > 0 ? (
                  <>
                    <div className="flex-1 flex items-center justify-center mb-6">
                      <div className="relative size-40">
                        <div
                          className="size-40 rounded-full shadow-inner"
                          style={{ background: conicGradient }}
                        />
                        <div className="absolute inset-5 bg-white/95 dark:bg-slate-800/95 rounded-full flex flex-col items-center justify-center shadow-inner">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider">
                            Total
                          </span>
                          <span className="text-lg font-bold text-slate-800 dark:text-white">
                            {formatCurrency(categoryTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2.5 mt-auto">
                      {categorySegments.slice(0, 5).map((seg) => (
                        <div
                          key={seg.categoria}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: seg.color }}
                            />
                            <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-24">
                              {seg.categoria}
                            </span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-white tabular-nums">
                            {seg.percentual}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                    Sem gastos no período
                  </div>
                )}
              </motion.div>
            </div>
            {/* ── Bottom Row: Transactions + Goals ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Transactions */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-panel p-6 rounded-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                    Últimas Transações
                  </h3>
                  <Link
                    href="/lancamentos"
                    className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                  >
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {(lancamentos?.items ?? []).length > 0 ? (
                  <div className="space-y-3">
                    {(lancamentos?.items ?? []).slice(0, 5).map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
                      >
                        <div
                          className={cn(
                            "size-10 rounded-xl flex items-center justify-center shrink-0",
                            l.tipo === "receita"
                              ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400"
                          )}
                        >
                          {l.tipo === "receita" ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                            {l.descricao}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {l.categoria} · {formatDate(l.data)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums shrink-0",
                            l.tipo === "receita"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {l.tipo === "receita" ? "+" : "-"}
                          {formatCurrency(l.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">
                    Nenhuma transação encontrada
                  </p>
                )}
              </motion.div>

              {/* Active Goals */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="glass-panel p-6 rounded-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Metas Ativas</h3>
                  <Link
                    href="/metas"
                    className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                  >
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {metasAtivas.length > 0 ? (
                  <div className="space-y-5">
                    {metasAtivas.slice(0, 4).map((meta) => (
                      <div key={meta.id} className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "size-8 rounded-lg flex items-center justify-center text-white text-xs font-bold",
                                meta.percentualConcluido >= 80
                                  ? "bg-emerald-500"
                                  : meta.percentualConcluido >= 50
                                    ? "bg-sky-500"
                                    : "bg-amber-500"
                              )}
                            >
                              <Target className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                {meta.nome}
                              </p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                {formatCurrency(meta.valorAtual)} / {formatCurrency(meta.valorAlvo)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "text-xs font-bold px-2.5 py-1 rounded-full border",
                              meta.percentualConcluido >= 80
                                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"
                                : meta.percentualConcluido >= 50
                                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"
                                  : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20"
                            )}
                          >
                            {meta.percentualConcluido}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full transition-all duration-700",
                              meta.percentualConcluido >= 80
                                ? "bg-emerald-500"
                                : meta.percentualConcluido >= 50
                                  ? "bg-sky-500"
                                  : "bg-amber-500"
                            )}
                            style={{ width: `${Math.min(meta.percentualConcluido, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Target className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma meta ativa</p>
                    <Link
                      href="/metas"
                      className="text-xs text-emerald-600 font-bold hover:underline mt-2 inline-block"
                    >
                      Criar meta
                    </Link>
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          {/* ═══ Right Sidebar ═══ */}
          <aside className="col-span-12 xl:col-span-3 space-y-6">
            {/* Credit Card */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel p-6 rounded-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Meus Cartões</h3>
                <Link
                  href="/cartoes"
                  className="text-xs text-emerald-600 font-bold hover:underline"
                >
                  Gerenciar
                </Link>
              </div>
              {firstCard ? (
                <>
                  {/* Physical card */}
                  <div className="w-full aspect-[1.586] rounded-2xl bg-linear-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 p-5 text-white shadow-xl relative overflow-hidden mb-6 group cursor-pointer hover:scale-[1.02] transition-transform duration-300">
                    <div className="absolute top-4 right-4 size-20 rounded-full border border-white/10" />
                    <div className="absolute top-8 right-0 size-32 rounded-full border border-white/5" />
                    <div className="flex justify-between items-start relative z-10">
                      <span className="text-xs font-bold tracking-wider opacity-80">
                        {firstCard.nome}
                      </span>
                      <CreditCard className="h-5 w-5 opacity-60" />
                    </div>
                    <div className="absolute bottom-5 left-5 right-5 z-10">
                      <p className="text-sm font-mono tracking-[.2em] mb-3 opacity-90">
                        •••• •••• •••• ••••
                      </p>
                      <div className="flex justify-between items-end text-[10px] opacity-70">
                        <span className="uppercase tracking-wider">
                          {usuario?.nome ?? "TITULAR"}
                        </span>
                        <span>Venc. dia {firstCard.diaVencimento}</span>
                      </div>
                    </div>
                  </div>
                  {/* Limit bar */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-2 font-medium">
                      <span className="text-slate-500 dark:text-slate-400">Limite Utilizado</span>
                      <span className="font-bold text-slate-800 dark:text-white">
                        {formatCurrency(firstCard.limiteUsado)} / {formatCurrency(firstCard.limite)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all duration-700",
                          cardUsedPercent <= 50
                            ? "bg-emerald-500"
                            : cardUsedPercent <= 80
                              ? "bg-amber-500"
                              : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(cardUsedPercent, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                      {cardUsedPercent}% utilizado
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <CreditCard className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Nenhum cartão</p>
                  <Link
                    href="/cartoes"
                    className="text-xs text-emerald-600 font-bold hover:underline mt-2 inline-block"
                  >
                    Adicionar cartão
                  </Link>
                </div>
              )}
            </motion.div>

            {/* Telegram */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-6 rounded-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-linear-to-r from-[#2AABEE] to-teal-500" />
              <div className="flex flex-col items-center text-center mt-2">
                <div className="size-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 text-[#2AABEE]">
                  <Send className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white mb-2 text-sm">
                  Telegram Alertas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed px-2">
                  Receba notificações instantâneas de cada compra e movimentação.
                </p>
                {usuario?.telegramVinculado ? (
                  <div className="w-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold py-3 rounded-xl text-center border border-emerald-100 dark:border-emerald-500/20">
                    ✓ Telegram Vinculado
                  </div>
                ) : (
                  <Link href="/perfil" className="w-full">
                    <button className="w-full bg-[#2AABEE] hover:bg-[#229ED9] text-white text-xs font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-400/20 active:scale-95 cursor-pointer">
                      Vincular Agora
                    </button>
                  </Link>
                )}
              </div>
            </motion.div>

            {/* Tip of the Day */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-panel p-6 rounded-2xl"
            >
              <h3 className="font-bold mb-3 text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Dica do Dia
              </h3>
              <div className="flex gap-4">
                <div className="bg-yellow-50 dark:bg-yellow-500/10 p-2.5 rounded-xl h-fit text-yellow-500 shrink-0">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed font-medium">
                  &ldquo;Pagar à vista com desconto é sempre melhor do que investir e parcelar, a
                  menos que o desconto seja muito baixo.&rdquo;
                </p>
              </div>
            </motion.div>
          </aside>
        </div>
      ) : (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="Sem dados ainda"
          description="Comece registrando seus lançamentos pelo Telegram ou pela aba Lançamentos"
          action={
            <Link href="/lancamentos">
              <button className="bg-emerald-600 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer">
                <Plus className="h-4 w-4" />
                Registrar lançamento
              </button>
            </Link>
          }
        />
      )}
    </>
  );
}
