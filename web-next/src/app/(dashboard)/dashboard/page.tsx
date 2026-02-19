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
import { formatCurrency, getGreeting, getFirstName } from "@/lib/format";
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
  Scale,
  Percent,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import {
  PageShell,
  StatCard,
  CardSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/shared/page-components";
import { EvolutionChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  CategorySpendingCard,
  RecentTransactionsCard,
  AlertsCard,
  CardsOverviewCard,
  ActiveMetasCard,
  TelegramOnboarding,
} from "@/components/dashboard";

const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getFinancialHealth(receitas: number, gastos: number) {
  if (receitas <= 0) return { label: "Sem dados", color: "text-muted-foreground", bg: "bg-muted", pct: 0 };
  const taxa = ((receitas - gastos) / receitas) * 100;
  if (taxa >= 30) return { label: "Excelente", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", pct: Math.min(taxa, 100) };
  if (taxa >= 15) return { label: "Boa", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", pct: taxa };
  if (taxa >= 5) return { label: "Regular", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", pct: taxa };
  if (taxa >= 0) return { label: "Apertada", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500", pct: taxa };
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
  const comprometimentoReceita = resumo && resumo.totalReceitas > 0
    ? Math.round((resumo.totalGastos / resumo.totalReceitas) * 100)
    : null; // null = sem receita
  const metasAtivas = metas.filter((m) => m.status === "ativa");
  const limitesAlerta = limites.filter((l) => l.status !== "ok");

  return (
    <PageShell>
      {/* ── Telegram Floating Pill ── */}
      <TelegramOnboarding />

      {/* ── Clean Greeting Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {getGreeting()}, {getFirstName(usuario?.nome ?? "")}
          </h1>
          <p className="text-sm text-muted-foreground/60 mt-0.5">
            {health ? (
              <>
                Saúde financeira{" "}
                <span className={`font-semibold ${health.color}`}>{health.label}</span>
                {" · "}{comprometimentoReceita !== null ? `${comprometimentoReceita}% comprometido` : "sem dados de receita"}
              </>
            ) : (
              "Aqui está o resumo das suas finanças"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {usuario?.telegramVinculado && (
            <Badge variant="secondary" className="gap-1.5 text-xs hidden sm:flex">
              <MessageCircle className="h-3 w-3" />
              Bot ativo
            </Badge>
          )}
          <Link href="/lancamentos">
            <Button size="sm" className="gap-1.5 h-9 rounded-xl shadow-sm font-semibold">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lançamento</span>
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0 rounded-xl shadow-sm"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </motion.div>

      {/* ── Month Selector ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4 }}
        className="flex items-center justify-center gap-2.5"
      >
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/30 shadow-sm hover:shadow-md transition-all duration-300" onClick={prev} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border/30 hover:border-primary/25 hover:shadow-md transition-all duration-300 min-w-45 justify-center shadow-sm group"
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
              tooltip="Total de dinheiro que entrou neste mês (salário, freelance, etc)."
              icon={<TrendingUp className="h-5 w-5" />}
              trend="up"
              delay={0}
            />
            <StatCard
              title="Gastos"
              value={formatCurrency(resumo.totalGastos)}
              tooltip="Total de despesas registradas neste mês."
              icon={<TrendingDown className="h-5 w-5" />}
              trend="down"
              delay={1}
            />
            <StatCard
              title="Resultado do Mês"
              value={formatCurrency(resumo.saldo)}
              subtitle={
                resumo.saldo > 0 ? "Sobrou dinheiro" :
                  resumo.saldo < 0 ? "Gastou mais do que ganhou" :
                    "Equilibrado"
              }
              tooltip="Diferença entre o que você recebeu e o que gastou neste mês."
              icon={<Scale className="h-5 w-5" />}
              trend={resumo.saldo > 0 ? "up" : resumo.saldo < 0 ? "down" : "neutral"}
              delay={2}
            />
            <StatCard
              title="Comprometimento"
              value={
                comprometimentoReceita !== null
                  ? `${comprometimentoReceita}%`
                  : "—"
              }
              subtitle={
                comprometimentoReceita === null
                  ? "Sem receita no período"
                  : comprometimentoReceita <= 70
                    ? "Dentro do ideal (até 70%)"
                    : comprometimentoReceita <= 100
                      ? "Atenção — acima de 70%"
                      : "Gastando mais do que ganha"
              }
              tooltip="Quanto da sua renda está sendo gasto. Até 70% é considerado saudável — sobram 30% para poupar."
              icon={<Percent className="h-5 w-5" />}
              trend={
                comprometimentoReceita === null
                  ? "neutral"
                  : comprometimentoReceita <= 70
                    ? "up"
                    : "down"
              }
              delay={3}
            />
          </div>

          {/* ── Financial Health Overview Strip ── */}
          {comprometimentoReceita !== null && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.45 }}
              className="card-premium p-4 sm:p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                {/* Health indicator */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="relative h-12 w-12">
                    <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3" className="text-muted/20" stroke="currentColor" />
                      <circle
                        cx="18" cy="18" r="14" fill="none" strokeWidth="3"
                        strokeDasharray={`${Math.min(comprometimentoReceita, 100) * 88 / 100} 88`}
                        strokeLinecap="round"
                        className={comprometimentoReceita <= 70 ? "text-emerald-500" : comprometimentoReceita <= 100 ? "text-amber-500" : "text-red-500"}
                        stroke="currentColor"
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-extrabold tabular-nums ${comprometimentoReceita <= 70 ? "text-emerald-600 dark:text-emerald-400" : comprometimentoReceita <= 100 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {comprometimentoReceita}%
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold">Saúde financeira</p>
                    <p className={`text-sm font-extrabold ${health?.color ?? "text-muted-foreground"}`}>{health?.label ?? "—"}</p>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2.5">
                  {/* Budget bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground/70 font-medium">Orçamento utilizado</span>
                      <span className="font-bold tabular-nums">{formatCurrency(resumo.totalGastos)} / {formatCurrency(resumo.totalReceitas)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${comprometimentoReceita <= 70 ? "bg-emerald-500" : comprometimentoReceita <= 100 ? "bg-amber-500" : "bg-red-500"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(comprometimentoReceita, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* Savings */}
                  {resumo.saldo !== 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground/60 font-medium">
                        {resumo.saldo > 0 ? "Poupança do mês:" : "Déficit do mês:"}
                      </span>
                      <span className={`font-extrabold tabular-nums ${resumo.saldo > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatCurrency(Math.abs(resumo.saldo))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Evolution Chart ── */}
          {!loadingHistorico && historicoData.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.5 }}
              className="card-premium p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                <div className="section-header">
                  <div className="section-header-icon bg-linear-to-br from-primary/10 to-primary/20 text-primary">
                    <Activity className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Evolução Financeira</h3>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">Receitas vs Gastos dos últimos meses</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs font-medium">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Receitas
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Gastos
                  </span>
                </div>
              </div>
              <EvolutionChart data={historicoData} />
            </motion.div>
          )}

          {/* ── Category Spending + Recent Transactions ── */}
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <CategorySpendingCard gastosPorCategoria={resumo.gastosPorCategoria} />
            <RecentTransactionsCard lancamentos={lancamentos?.items ?? []} />
          </div>

          {/* ── Bottom Row: Alerts + Cards + Metas ── */}
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            <AlertsCard limitesAlerta={limitesAlerta} />
            <CardsOverviewCard cartoes={cartoes} />
            <ActiveMetasCard metasAtivas={metasAtivas} />
          </div>
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
