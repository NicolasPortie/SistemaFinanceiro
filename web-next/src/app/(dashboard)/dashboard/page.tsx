"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import {
  useResumo,
  useCartoes,
  useCategorias,
  useLancamentos,
  useMetas,
  useLimites,
  useResumoHistorico,
  queryKeys,
} from "@/hooks/use-queries";
import { formatCurrency, formatDate, getGreeting, getFirstName, statusColor } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Tag,
  MessageCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Receipt,
  ShoppingCart,
  Target,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRight,
  PiggyBank,
  Gauge,
  Activity,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  PageShell,
  StatCard,
  CardSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/shared/page-components";
import { CategoryPieChart, EvolutionChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";

const categoryColors = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-orange-500",
];

const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getFinancialHealth(receitas: number, gastos: number) {
  if (receitas <= 0) return { label: "Sem dados", color: "text-muted-foreground", bg: "bg-muted", pct: 0, emoji: "📊" };
  const taxa = ((receitas - gastos) / receitas) * 100;
  if (taxa >= 30) return { label: "Excelente", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", pct: Math.min(taxa, 100), emoji: "🏆" };
  if (taxa >= 15) return { label: "Boa", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", pct: taxa, emoji: "✅" };
  if (taxa >= 5) return { label: "Regular", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", pct: taxa, emoji: "⚠️" };
  if (taxa >= 0) return { label: "Apertada", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500", pct: taxa, emoji: "🔶" };
  return { label: "Crítica", color: "text-red-600 dark:text-red-400", bg: "bg-red-500", pct: 0, emoji: "🔴" };
}

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
    if (isCurrentMonth) return;
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const reset = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  return { mesParam, label, isCurrentMonth, prev, next, reset };
}

export default function DashboardPage() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const { mesParam, label, isCurrentMonth, prev, next, reset } = useMonthSelector();

  const { data: resumo, isLoading: loadingResumo, isError: errorResumo, error: resumoError } = useResumo(mesParam);
  const { data: cartoes = [], isLoading: loadingCartoes } = useCartoes();
  const { data: categorias = [] } = useCategorias();
  const { data: lancamentos } = useLancamentos({ pagina: 1, tamanhoPagina: 5 });
  const { data: metas = [] } = useMetas();
  const { data: limites = [] } = useLimites();
  const { data: historicoData, isLoading: loadingHistorico } = useResumoHistorico(6);

  const loading = loadingResumo || loadingCartoes;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.resumo(mesParam) });
    queryClient.invalidateQueries({ queryKey: queryKeys.cartoes });
    queryClient.invalidateQueries({ queryKey: queryKeys.categorias });
  };

  const health = resumo ? getFinancialHealth(resumo.totalReceitas, resumo.totalGastos) : null;
  const taxaEconomia = resumo && resumo.totalReceitas > 0
    ? Math.round(((resumo.totalReceitas - resumo.totalGastos) / resumo.totalReceitas) * 100)
    : 0;
  const metasAtivas = metas.filter((m) => m.status === "ativa");
  const limitesAlerta = limites.filter((l) => l.status !== "ok");

  return (
    <PageShell>
      {/* ── Hero Welcome ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white noise-overlay"
      >
        {/* Multi-layer gradient background */}
        <div className="absolute inset-0 gradient-hero dark:gradient-hero-dark" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/5 to-transparent" />

        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Geometric shapes */}
          <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/[0.04] animate-float" />
          <div className="absolute right-24 top-6 h-20 w-20 rounded-full bg-white/[0.03]" style={{ animationDelay: "2s" }} />
          <div className="absolute -left-6 -bottom-6 h-40 w-40 rounded-full bg-white/[0.04] animate-float" style={{ animationDelay: "4s" }} />
          <div className="absolute left-1/3 bottom-3 h-10 w-10 rounded-full bg-white/[0.03]" />

          {/* Accent lines */}
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="absolute bottom-0 left-1/3 w-32 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {getGreeting()}, {getFirstName(usuario?.nome ?? "")} 👋
              </h1>
              {usuario?.telegramVinculado && (
                <Badge className="bg-white/15 text-white border-0 text-[10px] gap-1 hidden sm:flex backdrop-blur-sm font-semibold">
                  <MessageCircle className="h-3 w-3" />
                  Bot ativo
                </Badge>
              )}
            </div>
            <p className="text-white/60 text-sm max-w-md leading-relaxed">
              {health
                ? <>
                    Saúde financeira: {health.emoji}{" "}
                    <span className="text-white/90 font-semibold">{health.label}</span>
                    {" · "}Economia de{" "}
                    <span className="text-white font-bold">{taxaEconomia}%</span>
                    {" "}este mês
                  </>
                : "Aqui está o resumo das suas finanças"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/lancamentos">
              <Button size="sm" className="bg-white/12 hover:bg-white/20 text-white border border-white/10 gap-1.5 h-9 backdrop-blur-md shadow-lg shadow-black/10 font-semibold transition-all duration-300">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lançamento</span>
              </Button>
            </Link>
            <Link href="/simulacao">
              <Button size="sm" className="bg-white/12 hover:bg-white/20 text-white border border-white/10 gap-1.5 h-9 backdrop-blur-md shadow-lg shadow-black/10 font-semibold transition-all duration-300">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Simular</span>
              </Button>
            </Link>
            <Button
              size="sm"
              className="bg-white/12 hover:bg-white/20 text-white border border-white/10 h-9 w-9 p-0 backdrop-blur-md shadow-lg shadow-black/10 transition-all duration-300"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Month Selector ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="flex items-center justify-center gap-3"
      >
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/40 shadow-sm hover:shadow-md transition-all duration-300" onClick={prev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button
          onClick={reset}
          className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl bg-card border border-border/40 hover:border-primary/30 hover:shadow-lg transition-all duration-300 min-w-45 justify-center shadow-sm group"
        >
          <CalendarDays className="h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110" />
          <span className="text-sm font-bold tracking-tight">{label}</span>
          {!isCurrentMonth && (
            <span className="text-[10px] text-primary ml-0.5 font-semibold">(atual)</span>
          )}
        </button>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/40 shadow-sm hover:shadow-md transition-all duration-300" onClick={next} disabled={isCurrentMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </motion.div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : errorResumo ? (
        <ErrorState message={resumoError?.message} onRetry={handleRefresh} />
      ) : resumo ? (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Receitas"
              value={formatCurrency(resumo.totalReceitas)}
              icon={<TrendingUp className="h-5 w-5" />}
              trend="up"
              delay={0}
            />
            <StatCard
              title="Gastos"
              value={formatCurrency(resumo.totalGastos)}
              icon={<TrendingDown className="h-5 w-5" />}
              trend="down"
              delay={1}
            />
            <StatCard
              title="Saldo"
              value={formatCurrency(resumo.saldo)}
              icon={<Wallet className="h-5 w-5" />}
              trend={resumo.saldo >= 0 ? "up" : "down"}
              delay={2}
            />
            <StatCard
              title="Economia"
              value={`${taxaEconomia}%`}
              subtitle={health?.label}
              icon={<PiggyBank className="h-5 w-5" />}
              trend={taxaEconomia > 0 ? "up" : taxaEconomia < 0 ? "down" : "neutral"}
              delay={3}
            />
          </div>

          {/* ── Evolution Chart ── */}
          {!loadingHistorico && historicoData.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="card-premium p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="section-header">
                  <div className="section-header-icon bg-gradient-to-br from-primary/10 to-primary/20 text-primary">
                    <Activity className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Evolução Financeira</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Receitas vs Gastos dos últimos meses</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs font-medium">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40 ring-2 ring-emerald-500/20" />
                    Receitas
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/40 ring-2 ring-red-500/20" />
                    Gastos
                  </span>
                </div>
              </div>
              <EvolutionChart data={historicoData} />
            </motion.div>
          )}

          {/* ── Category Spending + Recent Transactions ── */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Pie Chart + Bar List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="card-premium p-6 space-y-5"
            >
              <div className="section-header">
                <div className="section-header-icon bg-gradient-to-br from-violet-500/10 to-violet-500/20 text-violet-600 dark:text-violet-400">
                  <Tag className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-bold tracking-tight">Gastos por Categoria</h3>
              </div>
              {resumo.gastosPorCategoria.length > 0 ? (
                <>
                  <CategoryPieChart data={resumo.gastosPorCategoria} />
                  <div className="divider-premium" />
                  <div className="space-y-3">
                    <AnimatePresence>
                      {resumo.gastosPorCategoria.slice(0, 5).map((g, i) => (
                        <motion.div
                          key={g.categoria}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.04 * i }}
                          className="space-y-2 group"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-3 w-3 rounded-full ${categoryColors[i % categoryColors.length]} shadow-sm ring-2 ring-offset-1 ring-offset-card`} />
                              <span className="font-semibold text-[13px]">{g.categoria}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="tabular-nums text-muted-foreground/80 font-medium">{formatCurrency(g.total)}</span>
                              <span className="text-[11px] tabular-nums text-muted-foreground/60 w-10 text-right font-bold">{g.percentual.toFixed(0)}%</span>
                            </div>
                          </div>
                          <Progress value={g.percentual} className="h-1.5" />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {resumo.gastosPorCategoria.length > 5 && (
                      <p className="text-[11px] text-muted-foreground/60 text-center pt-1 font-medium">
                        +{resumo.gastosPorCategoria.length - 5} categorias
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum gasto registrado neste período
                </div>
              )}
            </motion.div>

            {/* Recent Transactions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="card-premium overflow-hidden flex flex-col"
            >
              <div className="p-6 pb-4 flex items-center justify-between">
                <div className="section-header">
                  <div className="section-header-icon bg-gradient-to-br from-blue-500/10 to-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Receipt className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-sm font-bold tracking-tight">Últimos Lançamentos</h3>
                </div>
                <Link href="/lancamentos">
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-primary hover:text-primary font-semibold">
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              <div className="flex-1 overflow-hidden">
                {lancamentos && lancamentos.items.length > 0 ? (
                  <div className="divide-y divide-border/30">
                    {lancamentos.items.slice(0, 6).map((l) => (
                      <div key={l.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/20 transition-all duration-300 group">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105 ${
                          l.tipo === "receita"
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-400 group-hover:shadow-md group-hover:shadow-emerald-500/10"
                            : "bg-red-100 text-red-600 dark:bg-red-500/12 dark:text-red-400 group-hover:shadow-md group-hover:shadow-red-500/10"
                        }`}>
                          {l.tipo === "receita" ? <ArrowUpCircle className="h-4.5 w-4.5" /> : <ArrowDownCircle className="h-4.5 w-4.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate">{l.descricao}</p>
                          <p className="text-[11px] text-muted-foreground/60 font-medium">{l.categoria} · {formatDate(l.data)}</p>
                        </div>
                        <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                          l.tipo === "receita"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          {l.tipo === "receita" ? "+" : "-"}{formatCurrency(l.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full py-12">
                    <EmptyState
                      icon={<Receipt className="h-6 w-6" />}
                      title="Nenhum lançamento"
                      description="Registre seu primeiro lançamento para ver aqui"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Bottom Row: Alerts + Cards + Metas ── */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="card-premium p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="section-header">
                  <div className="section-header-icon bg-gradient-to-br from-amber-500/10 to-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Zap className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-sm font-bold tracking-tight">Alertas</h3>
                </div>
              </div>
              {limitesAlerta.length > 0 ? (
                <div className="space-y-3">
                  {limitesAlerta.slice(0, 4).map((l) => (
                    <div key={l.id} className="flex items-center gap-3 rounded-xl bg-muted/20 p-3.5 border border-border/20 transition-all duration-300 hover:bg-muted/40 hover:border-border/40">
                      <Gauge className={`h-4 w-4 shrink-0 ${
                        l.status === "excedido" || l.status === "critico" ? "text-red-500" : "text-amber-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{l.categoriaNome}</p>
                        <p className="text-[11px] text-muted-foreground/60 font-medium">
                          {formatCurrency(l.gastoAtual)} de {formatCurrency(l.valorLimite)}
                        </p>
                      </div>
                      <Badge variant="secondary" className={statusColor(l.status).badge}>
                        {l.percentualConsumido.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                  <Link href="/limites">
                    <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-primary hover:text-primary font-semibold mt-1">
                      Ver limites <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/12 mb-3 shadow-sm">
                    <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold">Tudo em ordem!</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1 font-medium">Nenhum limite ultrapassado</p>
                </div>
              )}
            </motion.div>

            {/* Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="card-premium p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="section-header">
                  <div className="section-header-icon bg-gradient-to-br from-violet-500/10 to-violet-500/20 text-violet-600 dark:text-violet-400">
                    <CreditCard className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-sm font-bold tracking-tight">Cartões</h3>
                </div>
                <Link href="/cartoes">
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-primary hover:text-primary font-semibold">
                    Gerenciar <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {cartoes.length > 0 ? (
                <div className="space-y-3">
                  {cartoes.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl bg-muted/20 p-3.5 border border-border/20 transition-all duration-300 hover:bg-muted/40 hover:border-border/40 group">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-card-purple text-white shadow-md shadow-violet-500/20 transition-transform duration-300 group-hover:scale-105">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{c.nome}</p>
                        <p className="text-[11px] text-muted-foreground/60 font-medium">Venc. dia {c.diaVencimento}</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums">{formatCurrency(c.limite)}</p>
                    </div>
                  ))}
                  {cartoes.length > 3 && (
                    <p className="text-[11px] text-muted-foreground/60 text-center font-medium">+{cartoes.length - 3} cartões</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-3 shadow-sm">
                    <CreditCard className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-bold">Nenhum cartão</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1 font-medium">Adicione via Perfil ou Telegram</p>
                </div>
              )}
            </motion.div>

            {/* Active Metas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card-premium p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="section-header">
                  <div className="section-header-icon bg-gradient-to-br from-cyan-500/10 to-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                    <Target className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-sm font-bold tracking-tight">Metas Ativas</h3>
                </div>
                <Link href="/metas">
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-primary hover:text-primary font-semibold">
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {metasAtivas.length > 0 ? (
                <div className="space-y-4">
                  {metasAtivas.slice(0, 3).map((meta) => (
                    <div key={meta.id} className="space-y-2.5 rounded-xl bg-muted/20 p-3.5 border border-border/20 transition-all duration-300 hover:bg-muted/40 hover:border-border/40">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold truncate">{meta.nome}</p>
                        <span className="text-xs font-extrabold tabular-nums text-primary">{meta.percentualConcluido.toFixed(0)}%</span>
                      </div>
                      <Progress value={Math.min(meta.percentualConcluido, 100)} className="h-2" />
                      <p className="text-[11px] text-muted-foreground/60 tabular-nums font-medium">
                        {formatCurrency(meta.valorAtual)} de {formatCurrency(meta.valorAlvo)}
                      </p>
                    </div>
                  ))}
                  {metasAtivas.length > 3 && (
                    <p className="text-[11px] text-muted-foreground/60 text-center font-medium">
                      +{metasAtivas.length - 3} metas ativas
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-3 shadow-sm">
                    <Target className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-bold">Sem metas ativas</p>
                  <Link href="/metas">
                    <Button variant="ghost" size="sm" className="text-xs text-primary mt-1.5 hover:text-primary font-semibold">
                      Criar meta
                    </Button>
                  </Link>
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Categories Tags ── */}
          {categorias.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="card-premium p-6"
            >
              <div className="section-header mb-5">
                <div className="section-header-icon bg-gradient-to-br from-pink-500/10 to-pink-500/20 text-pink-600 dark:text-pink-400">
                  <Tag className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-bold tracking-tight">Suas Categorias</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {categorias.map((cat, i) => (
                  <Badge
                    key={cat.id}
                    variant="secondary"
                    className="gap-2 py-2 px-3.5 text-xs border border-border/30 hover:border-primary/20 hover:shadow-sm transition-all duration-300 font-semibold"
                  >
                    <div className={`h-2.5 w-2.5 rounded-full ${categoryColors[i % categoryColors.length]} shadow-sm`} />
                    {cat.nome}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="Sem dados ainda"
          description="Comece registrando seus lançamentos pelo Telegram ou pela aba Lançamentos"
          action={
            <Link href="/lancamentos">
              <Button className="gap-2 shadow-premium">
                <Plus className="h-4 w-4" />
                Registrar lançamento
              </Button>
            </Link>
          }
        />
      )}
    </PageShell>
  );
}
