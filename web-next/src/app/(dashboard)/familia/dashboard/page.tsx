"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Crown,
  DollarSign,
  PieChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

import { formatCurrency } from "@/lib/format";
import {
  useFamiliaDashboard,
  useFamiliaDashboardCategorias,
  useFamiliaEvolucao,
} from "@/hooks/use-queries";
import {
  FamilyHero,
  FamilyMetricCard,
  FamilyPanel,
  FamilyShell,
} from "@/components/familia/family-layout";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";

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

export default function FamiliaDashboardPage() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const {
    data: resumo,
    isLoading,
    isError,
    error,
    refetch,
  } = useFamiliaDashboard(mes, ano);
  const { data: categorias = [] } = useFamiliaDashboardCategorias(mes, ano);
  const { data: evolucao = [] } = useFamiliaEvolucao(6);

  const handlePrev = () => {
    if (mes === 1) {
      setMes(12);
      setAno((current) => current - 1);
      return;
    }
    setMes((current) => current - 1);
  };

  const handleNext = () => {
    if (mes === 12) {
      setMes(1);
      setAno((current) => current + 1);
      return;
    }
    setMes((current) => current + 1);
  };

  const maxCategoria = categorias.length > 0 ? Math.max(...categorias.map((item) => item.total)) : 0;

  return (
    <FamilyShell>
      <FamilyHero
        icon={<Users className="h-6 w-6" />}
        title="Dashboard Familiar"
        description="Acompanhe receitas, despesas e distribuição de gastos em uma única visão compartilhada."
        eyebrow="Módulo Família"
        backHref="/familia"
        backLabel="Família"
        tone="emerald"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200/70 bg-white/70 p-1 dark:border-white/8 dark:bg-white/4">
              <Button variant="ghost" size="icon-sm" onClick={handlePrev} aria-label="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[132px] px-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                {meses[mes - 1]} {ano}
              </span>
              <Button variant="ghost" size="icon-sm" onClick={handleNext} aria-label="Próximo mês">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 rounded-xl">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message ?? "Erro ao carregar dashboard"} onRetry={refetch} />
      ) : !resumo ? (
        <FamilyPanel tone="slate" className="p-10 lg:p-12">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Sem dados para o período"
            description="Ainda não há movimentação suficiente para montar o dashboard familiar deste mês."
          />
        </FamilyPanel>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FamilyMetricCard
              title="Receitas"
              value={formatCurrency(resumo.receitaTotal)}
              subtitle="Entradas somadas da família"
              icon={<TrendingUp className="h-5 w-5" />}
              tone="emerald"
            />
            <FamilyMetricCard
              title="Despesas"
              value={formatCurrency(resumo.gastoTotal)}
              subtitle="Saídas consolidadas"
              icon={<TrendingDown className="h-5 w-5" />}
              tone="rose"
              delay={0.05}
            />
            <FamilyMetricCard
              title="Saldo"
              value={formatCurrency(resumo.saldoFamiliar)}
              subtitle="Resultado do período"
              icon={<DollarSign className="h-5 w-5" />}
              tone={resumo.saldoFamiliar >= 0 ? "emerald" : "rose"}
              delay={0.1}
            />
            <FamilyMetricCard
              title="Referência"
              value={resumo.mesReferencia}
              subtitle="Período analisado"
              icon={<BarChart3 className="h-5 w-5" />}
              tone="blue"
              delay={0.15}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <FamilyPanel
              title="Contribuição por pessoa"
              description="Quanto cada membro representa no gasto familiar do período."
              icon={<Users className="h-5 w-5" />}
              tone="blue"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <ContributionCard
                  label="Titular"
                  value={formatCurrency(resumo.contribuicaoTitular)}
                  percent={resumo.gastoTotal > 0 ? (resumo.contribuicaoTitular / resumo.gastoTotal) * 100 : 0}
                  icon={<Crown className="h-4 w-4" />}
                  accent="amber"
                />
                <ContributionCard
                  label="Membro"
                  value={formatCurrency(resumo.contribuicaoMembro)}
                  percent={resumo.gastoTotal > 0 ? (resumo.contribuicaoMembro / resumo.gastoTotal) * 100 : 0}
                  icon={<User className="h-4 w-4" />}
                  accent="blue"
                />
              </div>
            </FamilyPanel>

            <FamilyPanel
              title="Gastos por categoria"
              description="Distribuição do total familiar por categoria no mês selecionado."
              icon={<PieChart className="h-5 w-5" />}
              tone="emerald"
            >
              <div className="space-y-4">
                {categorias.length > 0 ? (
                  categorias.map((cat, index) => {
                    const pct = maxCategoria > 0 ? (cat.total / maxCategoria) * 100 : 0;
                    return (
                      <motion.div
                        key={cat.categoriaNome}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.3 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {cat.categoriaNome}
                          </span>
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                            {formatCurrency(cat.total)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.1 + index * 0.05, duration: 0.45 }}
                            className="h-full rounded-full bg-emerald-500"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            T: {formatCurrency(cat.gastoTitular)} / M: {formatCurrency(cat.gastoMembro)}
                          </span>
                          <span>
                            {resumo.gastoTotal > 0 ? ((cat.total / resumo.gastoTotal) * 100).toFixed(1) : "0.0"}%
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <EmptyState
                    icon={<PieChart className="h-5 w-5" />}
                    title="Sem categorias relevantes"
                    description="O período selecionado ainda não possui categorias suficientes para comparação."
                  />
                )}
              </div>
            </FamilyPanel>
          </div>

          <FamilyPanel
            title="Evolução mensal"
            description="Comparativo de receitas e despesas da família nos últimos meses."
            icon={<BarChart3 className="h-5 w-5" />}
            tone="slate"
          >
            <div className="space-y-4">
              {evolucao.length > 0 ? (
                evolucao.map((item, index) => (
                  <EvolutionRow key={item.mes} label={item.mes} receita={item.receitaTotal} gasto={item.gastoTotal} delay={index * 0.04} />
                ))
              ) : (
                <EmptyState
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="Sem histórico suficiente"
                  description="Ainda não há meses suficientes para renderizar a evolução familiar."
                />
              )}
            </div>
          </FamilyPanel>
        </>
      )}
    </FamilyShell>
  );
}

function ContributionCard({
  label,
  value,
  percent,
  icon,
  accent,
}: {
  label: string;
  value: string;
  percent: number;
  icon: React.ReactNode;
  accent: "amber" | "blue";
}) {
  const iconClass =
    accent === "amber"
      ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
      : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300";
  const barClass = accent === "amber" ? "bg-amber-500" : "bg-blue-500";

  return (
    <div className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/70 p-5 dark:border-white/8 dark:bg-slate-900/35">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconClass}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function EvolutionRow({
  label,
  receita,
  gasto,
  delay,
}: {
  label: string;
  receita: number;
  gasto: number;
  delay: number;
}) {
  const maxValue = Math.max(receita, gasto, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/8 dark:bg-slate-900/35"
    >
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
        <div className="flex gap-4 text-xs font-semibold">
          <span className="text-emerald-600 dark:text-emerald-300">{formatCurrency(receita)}</span>
          <span className="text-red-600 dark:text-red-300">{formatCurrency(gasto)}</span>
        </div>
      </div>
      <div className="flex gap-1">
        <div
          className="h-2 rounded-full bg-emerald-500"
          style={{ width: `${(receita / maxValue) * 50}%` }}
        />
        <div
          className="h-2 rounded-full bg-red-400"
          style={{ width: `${(gasto / maxValue) * 50}%` }}
        />
      </div>
    </motion.div>
  );
}
