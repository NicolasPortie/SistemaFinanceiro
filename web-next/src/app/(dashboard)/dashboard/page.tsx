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
import { AnimatedCurrency } from "@/components/ui/animated-value";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  TrendingUp,
  TrendingDown,
  Target,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/page-components";
import { useQueryClient } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";

/* ─── Constants ─────────────────────────────────────────── */
const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const mesNamesAbrev = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const categoryColors = [
  "#10b981", "#6366f1", "#94a3b8", "#e2e8f0", "#f59e0b",
  "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899",
];

/* ─── Hooks ─────────────────────────────────────────────── */
function useMonthSelector() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const mesParam = isCurrentMonth ? undefined : `${year}-${String(month + 1).padStart(2, "0")}`;
  const label = `${meses[month]} ${year}`;

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  };
  const next = () => {
    if (isCurrentMonth) return;
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  };
  const reset = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  return { mesParam, label, isCurrentMonth, prev, next, reset };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Dashboard Page — Executive Design
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function DashboardPage() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const { mesParam, label, isCurrentMonth, prev, next, reset } = useMonthSelector();

  const { data: resumo, isLoading: loadingResumo, isError: errorResumo, error: resumoError } = useResumo(mesParam);
  const { data: cartoes = [], isLoading: loadingCartoes } = useCartoes();
  const { data: lancamentos } = useLancamentos({ pagina: 1, tamanhoPagina: 8 });
  const { data: metas = [] } = useMetas();
  const { data: limites = [] } = useLimites();
  const [periodoMeses, setPeriodoMeses] = useState<1 | 6 | 12 | 24>(6);
  const { data: historicoData, isLoading: loadingHistorico } = useResumoHistorico(periodoMeses);

  const loading = loadingResumo || loadingCartoes;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.resumo(mesParam) });
    queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
  };

  const metasAtivas = metas.filter((m) => m.status === "ativa");

  // Category donut data
  const categoryTotal = resumo?.gastosPorCategoria?.reduce((s, g) => s + g.total, 0) ?? 0;
  const categorySegments = (resumo?.gastosPorCategoria ?? []).map((g, i) => ({
    ...g,
    pctNum: categoryTotal > 0 ? (g.total / categoryTotal) * 100 : 0,
    color: categoryColors[i % categoryColors.length],
  }));

  // SVG donut constants
  const R = 40;
  const C = 2 * Math.PI * R; // circumference

  // Bar chart max
  const maxHistorico = historicoData
    ? Math.max(...historicoData.map((d) => Math.max(d.receitas, d.gastos)), 1)
    : 1;
  const saldoHistoricoAtual = historicoData?.[historicoData.length - 1]
    ? historicoData[historicoData.length - 1].receitas - historicoData[historicoData.length - 1].gastos
    : 0;
  const melhorMesHistorico = historicoData?.reduce((melhor, atual) => {
    const saldoMelhor = melhor.receitas - melhor.gastos;
    const saldoAtual = atual.receitas - atual.gastos;
    return saldoAtual > saldoMelhor ? atual : melhor;
  }, historicoData[0]);

  // Chart Data preparation
  const chartData = historicoData?.map((d) => {
    const saldo = d.receitas - d.gastos;
    return {
      ...d,
      nomeMes: mesNamesAbrev[parseInt(d.mes.split("-")[1]) - 1],
      saldo,
      saldoAbs: Math.abs(saldo),
    };
  }) || [];

  // Relevant limits
  const limitesRelevantes = limites.filter((l) => l.percentualConsumido >= 0);

  return (
    <>
      {/* ═══ Main Content ═══ */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : errorResumo ? (
        <ErrorState message={resumoError?.message} onRetry={handleRefresh} />
      ) : resumo ? (
        <div className="grid grid-cols-12 gap-6 xl:gap-8">

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              LEFT COLUMN — Saldo + Receita/Saídas + Metas
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="col-span-12 lg:col-span-3 space-y-6 flex flex-col">

            {/* Hero: Saldo Atual */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="exec-card relative flex min-h-35 flex-col justify-center overflow-hidden rounded-2xl p-5 group sm:min-h-45 sm:rounded-[2.5rem] sm:p-8 lg:p-10"
            >
              <div className="absolute -right-4 -top-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                <svg className="w-24 h-24 text-slate-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 18v1c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14c1.1 0 2 .9 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
              </div>
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.3em] mb-4">
                Saldo Atual
              </p>
              <div className="flex flex-col gap-1.5">
                <span className={cn(
                  "text-2xl sm:text-3xl xl:text-4xl font-bold tracking-tight",
                  resumo.saldo >= 0 ? "text-slate-900 dark:text-white" : "text-rose-500"
                )}>
                  <AnimatedCurrency value={resumo.saldo} />
                </span>
                {resumo.totalReceitas > 0 && (
                  <span className={cn(
                    "text-[10px] mono-data font-bold",
                    resumo.saldo >= 0 ? "text-emerald-600" : "text-rose-500"
                  )}>
                    {resumo.saldo >= 0 ? "+" : ""}
                    {Math.round(((resumo.totalReceitas - resumo.totalGastos) / resumo.totalReceitas) * 100)}
                    % da receita livre
                  </span>
                )}
              </div>
            </motion.div>

            {/* Receita + Saídas */}
            <div className="grid grid-cols-1 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="exec-card flex min-h-25 flex-col justify-center rounded-2xl p-5 sm:min-h-28 sm:rounded-[2rem] sm:p-6 lg:p-8"
              >
                <p className="text-[8px] text-slate-400 font-medium uppercase tracking-[0.2em] mb-2">
                  Receita Mensal
                </p>
                <span className="text-xl xl:text-2xl font-bold text-slate-900 dark:text-white">
                  <AnimatedCurrency value={resumo.totalReceitas} />
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="exec-card flex min-h-25 flex-col justify-center rounded-2xl p-5 sm:min-h-28 sm:rounded-[2rem] sm:p-6 lg:p-8"
              >
                <p className="text-[8px] text-slate-400 font-medium uppercase tracking-[0.2em] mb-2">
                  Saídas Totais
                </p>
                <span className="text-xl xl:text-2xl font-bold text-rose-500">
                  <AnimatedCurrency value={resumo.totalGastos} />
                </span>
              </motion.div>
            </div>

            {/* Metas Estratégicas */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="exec-card min-h-50 flex-1 rounded-2xl p-5 sm:min-h-60 sm:rounded-[2.5rem] sm:p-8 lg:p-10"
            >
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em]">
                  Metas Estratégicas
                </h4>
                <Link href="/metas" className="text-slate-300 dark:text-slate-600 hover:text-emerald-500 transition-colors">
                  <Target className="h-4 w-4" />
                </Link>
              </div>

              {metasAtivas.length > 0 ? (
                <div className="space-y-6">
                  {metasAtivas.slice(0, 3).map((meta) => (
                    <div key={meta.id}>
                      <div className="flex justify-between text-[10px] mb-2.5 items-end">
                        <span className="text-slate-500 font-medium uppercase tracking-widest truncate max-w-[60%]">
                          {meta.nome}
                        </span>
                        <span className="text-slate-900 dark:text-white mono-data font-bold">
                          {meta.percentualConcluido}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            meta.percentualConcluido >= 80
                              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                              : meta.percentualConcluido >= 50
                                ? "bg-emerald-400"
                                : "bg-slate-300 dark:bg-slate-500"
                          )}
                          style={{ width: `${Math.min(meta.percentualConcluido, 100)}%` }}
                        />
                      </div>
                      <p className="text-[8px] text-slate-400 mt-1.5 mono-data">
                        Meta: {formatCurrency(meta.valorAlvo)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Target className="h-7 w-7 text-slate-200 dark:text-slate-600 mb-3" />
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">Nenhuma meta ativa</p>
                  <Link href="/metas" className="text-[9px] text-emerald-600 font-bold hover:underline mt-2 uppercase tracking-wider">
                    Criar meta
                  </Link>
                </div>
              )}
            </motion.div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              CENTER COLUMN — Chart + Donut + Limits
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="col-span-12 lg:col-span-5 space-y-6">

            {/* Monthly Flow Chart */}
            {!loadingHistorico && historicoData && historicoData.length >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="exec-card relative flex h-65 flex-col overflow-hidden rounded-2xl p-5 sm:h-85 sm:rounded-[2.5rem] sm:p-8 lg:p-10"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em]">
                      Fluxo Mensal
                    </h4>
                    <div className="flex items-center gap-2 mt-2">
                      {([1, 6, 12, 24] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setPeriodoMeses(m)}
                          className={cn(
                            "text-[8px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer",
                            periodoMeses === m
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-slate-200 dark:border-slate-600 text-slate-400 hover:text-emerald-600 hover:border-emerald-400"
                          )}
                        >
                          {m}M
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-right">
                    <div>
                      <span className="block text-[7px] text-slate-400 uppercase tracking-widest font-bold">
                        Receitas
                      </span>
                      <span className="text-[12px] mono-data font-bold text-emerald-600">
                        {formatCurrency(historicoData[historicoData.length - 1]?.receitas ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[7px] text-slate-400 uppercase tracking-widest font-bold">
                        Saídas
                      </span>
                      <span className="text-[12px] mono-data font-bold text-rose-500">
                        {formatCurrency(historicoData[historicoData.length - 1]?.gastos ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[7px] text-slate-400 uppercase tracking-widest font-bold">
                        Saldo
                      </span>
                      <span className={cn(
                        "text-[12px] mono-data font-bold",
                        saldoHistoricoAtual >= 0 ? "text-emerald-600" : "text-rose-500"
                      )}>
                        {formatCurrency(saldoHistoricoAtual)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-5 flex flex-wrap items-center gap-2 text-[8px] uppercase tracking-[0.22em]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Receita
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-2.5 py-1 font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Saídas
                  </span>
                  {melhorMesHistorico && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Melhor mês: {mesNamesAbrev[parseInt(melhorMesHistorico.mes.split("-")[1]) - 1]}
                    </span>
                  )}
                </div>

                {/* Comparative line chart area */}
                <div className="flex-1 min-h-0 w-full mt-4 -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                      <XAxis 
                        dataKey="nomeMes" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                      />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                        itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                        labelStyle={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}
                        formatter={(value: number | undefined) => [formatCurrency(value || 0)]}
                      />
                      <Line type="monotone" dataKey="receitas" name="Receita" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                      <Line type="monotone" dataKey="gastos" name="Saída" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#f43f5e' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Evolução do Saldo Chart */}
            {!loadingHistorico && historicoData && historicoData.length >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="exec-card relative flex h-65 flex-col overflow-hidden rounded-2xl p-5 sm:h-85 sm:rounded-[2.5rem] sm:p-8 lg:p-10"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em]">
                      Evolução do Saldo
                    </h4>
                  </div>
                </div>

                <div className="flex-1 min-h-0 w-full -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                      <XAxis 
                        dataKey="nomeMes" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(value) => `R$ ${Math.abs(value) >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                      />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                        itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                        labelStyle={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 600 }}
                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                        formatter={(_value, _name, props) => [formatCurrency((props.payload as Record<string, number>)?.saldo ?? 0), 'Saldo']}
                      />
                      <Bar dataKey="saldoAbs" radius={[6, 6, 6, 6]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.saldo >= 0 ? '#10b981' : '#f43f5e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Category Donut + Legend */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="exec-card flex min-h-50 flex-col items-center gap-6 rounded-2xl p-5 sm:min-h-56 sm:flex-row sm:gap-8 sm:rounded-[2.5rem] sm:p-8 xl:gap-12 lg:p-10"
            >
              {/* SVG Donut */}
              <div className="relative flex h-32 w-32 shrink-0 items-center justify-center xl:h-40 xl:w-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={R} fill="transparent" stroke="#f1f5f9" strokeWidth="8" className="dark:stroke-slate-700" />
                  {(() => {
                    let cum = 0;
                    return categorySegments.slice(0, 4).map((seg) => {
                      const dash = (seg.pctNum / 100) * C;
                      const rot = (cum / 100) * 360;
                      cum += seg.pctNum;
                      return (
                        <circle
                          key={seg.categoria}
                          cx="50" cy="50" r={R}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="8"
                          strokeDasharray={`${dash} ${C - dash}`}
                          strokeLinecap="round"
                          transform={`rotate(${rot} 50 50)`}
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute text-center">
                  {categoryTotal > 0 ? (
                    <>
                      <p className="text-lg xl:text-xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(categoryTotal)}
                      </p>
                      <p className="text-[7px] text-slate-400 uppercase tracking-widest font-bold">Total Gastos</p>
                    </>
                  ) : (
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">Sem dados</p>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-3">
                <h4 className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em] mb-4">
                  Gastos por Categoria
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {categorySegments.length > 0 ? (
                    categorySegments.slice(0, 4).map((seg) => (
                      <div key={seg.categoria} className="flex items-center justify-between text-[10px] px-1.5 py-0.5">
                        <span className="flex items-center gap-2.5 text-slate-500 font-medium uppercase tracking-wider truncate">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                          {seg.categoria}
                        </span>
                        <span className="text-slate-900 dark:text-white mono-data font-bold">
                          {Math.round(seg.pctNum)}%
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Sem gastos no período</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Limit Tracking */}
            {limitesRelevantes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem]"
              >
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em]">
                    Acompanhamento de Limites
                  </h4>
                  <Link href="/limites" className="text-[8px] text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors">
                    Gasto vs Limite
                  </Link>
                </div>
                <div className="space-y-5">
                  {limitesRelevantes.slice(0, 4).map((l) => {
                    const pct = Math.min(l.percentualConsumido, 100);
                    const isOver = l.percentualConsumido > 80;
                    return (
                      <div key={l.id} className="flex items-center gap-4 xl:gap-6">
                        <span className="text-[9px] font-bold text-slate-500 w-20 xl:w-24 uppercase tracking-tighter truncate">
                          {l.categoriaNome}
                        </span>
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              isOver ? "bg-rose-400" : pct > 50 ? "bg-indigo-400" : "bg-emerald-500"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={cn(
                          "text-[10px] mono-data w-28 xl:w-32 text-right truncate",
                          isOver ? "text-rose-500 font-bold" : "text-slate-900 dark:text-white"
                        )}>
                          {formatCurrency(l.gastoAtual)} / {formatCurrency(l.valorLimite)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              RIGHT COLUMN — Toolbar + Últimas Transações
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 lg:gap-5">

            {/* Toolbar */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-end gap-2 sm:gap-3 flex-wrap"
            >
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800/80 px-3 py-1.5 rounded-full border border-[rgba(15,23,42,0.06)] dark:border-slate-700/60 shadow-sm">
                <button onClick={prev} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer">
                  <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 min-w-24 justify-center select-none cursor-pointer uppercase tracking-[0.2em] hover:text-emerald-600 transition-colors"
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  {label}
                </button>
                <button
                  onClick={next}
                  disabled={isCurrentMonth}
                  className="p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

              <button
                onClick={handleRefresh}
                className="p-2 text-slate-400 hover:text-emerald-500 transition-colors rounded-full hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              <Link href="/lancamentos">
                <button className="bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-lg">
                  <Plus className="h-3.5 w-3.5" />
                  Novo Lançamento
                </button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="exec-card flex flex-col overflow-hidden rounded-2xl sm:rounded-[2.5rem] lg:h-[calc(100vh-18rem)] lg:min-h-140"
            >
              {/* Header */}
              <div className="p-5 sm:p-8 lg:p-10 border-b border-slate-50 dark:border-slate-700/50 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30">
                <h4 className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em]">
                  Últimas Transações
                </h4>
                <Link
                  href="/lancamentos"
                  className="text-[8px] text-emerald-600 font-bold tracking-[0.2em] uppercase cursor-pointer hover:underline flex items-center gap-1"
                >
                  Ver Histórico <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Transaction List */}
              <div className="flex-1 overflow-y-auto hide-scrollbar bg-white dark:bg-transparent">
                {(lancamentos?.items ?? []).length > 0 ? (
                  <table className="w-full border-collapse">
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/30">
                      {(lancamentos?.items ?? []).slice(0, 8).map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 sm:px-6 xl:px-8 py-3 sm:py-4 xl:py-5">
                            <p className="mb-0.5 max-w-35 truncate text-[12px] font-semibold text-slate-900 dark:text-white sm:max-w-45">
                              {l.descricao}
                            </p>
                            <p className="text-[9px] text-slate-400 mono-data uppercase">
                              {formatDate(l.data)}
                            </p>
                          </td>
                          <td className="px-4 sm:px-6 xl:px-8 py-3 sm:py-4 xl:py-5 text-right whitespace-nowrap">
                            <p className={cn(
                              "text-[12px] mono-data font-bold",
                              l.tipo === "receita" ? "text-emerald-600" : "text-rose-500"
                            )}>
                              {l.tipo === "receita" ? "+" : "−"} {formatCurrency(l.valor)}
                            </p>
                            <p className={cn(
                              "text-[9px] uppercase font-medium",
                              l.tipo === "receita" ? "text-emerald-500 font-bold opacity-80" : "text-slate-400"
                            )}>
                              {l.categoria}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <TrendingDown className="h-8 w-8 text-slate-200 dark:text-slate-600 mb-3" />
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Nenhuma transação</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 lg:p-8 border-t border-slate-50 dark:border-slate-700/50 bg-slate-50/20 dark:bg-slate-800/20">
                <Link href="/lancamentos" className="block">
                  <button className="w-full py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm cursor-pointer">
                    Ver Todos os Lançamentos
                  </button>
                </Link>
              </div>
            </motion.div>
          </div>

        </div>
      ) : (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="Sem dados ainda"
          description="Comece registrando seus lançamentos pelo Telegram ou pela aba Lançamentos"
          action={
            <Link href="/lancamentos">
              <button className="bg-slate-900 dark:bg-emerald-600 text-white px-6 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2 cursor-pointer shadow-lg">
                <Plus className="h-3.5 w-3.5" />
                Registrar lançamento
              </button>
            </Link>
          }
        />
      )}
    </>
  );
}
