"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  Receipt,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CategoryPieChart } from "@/components/charts";
import { EmptyState } from "@/components/shared/page-components";
import { formatCurrency, formatDate } from "@/lib/format";
import type { GastoCategoria, Lancamento } from "@/lib/api";

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

interface CategorySpendingCardProps {
  gastosPorCategoria: GastoCategoria[];
}

export function CategorySpendingCard({ gastosPorCategoria }: CategorySpendingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="card-premium p-4 sm:p-6 space-y-4 sm:space-y-5"
    >
      <div className="section-header">
        <div className="section-header-icon bg-gradient-to-br from-violet-500/10 to-violet-500/20 text-violet-600 dark:text-violet-400">
          <Tag className="h-4.5 w-4.5" />
        </div>
        <h3 className="text-sm font-bold tracking-tight">Gastos por Categoria</h3>
      </div>
      {gastosPorCategoria.length > 0 ? (
        <>
          <CategoryPieChart data={gastosPorCategoria} />
          <div className="divider-premium" />
          <div className="space-y-3">
            <AnimatePresence>
              {gastosPorCategoria.slice(0, 5).map((g, i) => (
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
            {gastosPorCategoria.length > 5 && (
              <p className="text-[11px] text-muted-foreground/60 text-center pt-1 font-medium">
                +{gastosPorCategoria.length - 5} categorias
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
  );
}

interface RecentTransactionsCardProps {
  lancamentos: Lancamento[];
}

export function RecentTransactionsCard({ lancamentos }: RecentTransactionsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="card-premium overflow-hidden flex flex-col"
    >
      <div className="p-4 sm:p-6 pb-3 sm:pb-4 flex items-center justify-between">
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
        {lancamentos.length > 0 ? (
          <div className="divide-y divide-border/30">
            {lancamentos.slice(0, 6).map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-3.5 hover:bg-muted/20 transition-all duration-300 group">
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
  );
}
