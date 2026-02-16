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
import { formatCurrency } from "@/lib/format";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  PiggyBank,
  Activity,
  Tag,
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
  HeroSection,
  CategorySpendingCard,
  RecentTransactionsCard,
  AlertsCard,
  CardsOverviewCard,
  ActiveMetasCard,
} from "@/components/dashboard";

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
      <HeroSection
        usuario={usuario}
        healthLabel={health?.label ?? null}
        taxaEconomia={taxaEconomia}
        loading={loading}
        onRefresh={handleRefresh}
      />

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
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.5 }}
              className="card-premium p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                <div className="section-header">
                  <div className="section-header-icon bg-gradient-to-br from-primary/10 to-primary/20 text-primary">
                    <Activity className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Evolução Financeira</h3>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">Receitas vs Gastos dos últimos meses</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs font-medium">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/15" />
                    Receitas
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-500/15" />
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

          {/* ── Categories Tags ── */}
          {categorias.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="card-premium p-4 sm:p-6"
            >
              <div className="section-header mb-4 sm:mb-5">
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
                    className="gap-2 py-1.5 px-3 text-xs border border-border/20 hover:border-primary/15 hover:shadow-sm transition-all duration-300 font-semibold"
                  >
                    <div className={`h-2 w-2 rounded-full ${categoryColors[i % categoryColors.length]}`} />
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
