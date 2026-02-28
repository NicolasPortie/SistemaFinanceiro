"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Receipt, ArrowUpCircle, ArrowDownCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryPieChart } from "@/components/charts";
import { EmptyState } from "@/components/shared/page-components";
import { formatCurrency, formatDate } from "@/lib/format";
import type { GastoCategoria, Lancamento } from "@/lib/api";

const categoryColors = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
];

interface CategorySpendingCardProps {
  gastosPorCategoria: GastoCategoria[];
}

export function CategorySpendingCard({ gastosPorCategoria }: CategorySpendingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="card-premium p-4 sm:p-6 space-y-4 sm:space-y-5"
    >
      <div className="section-header">
        <div className="section-header-icon bg-linear-to-br from-violet-500/10 to-violet-500/20 text-violet-600 dark:text-violet-400">
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
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.4 }}
                  className="space-y-2 group"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: categoryColors[i % categoryColors.length] }}
                      />
                      <span className="font-semibold text-[13px]">{g.categoria}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-muted-foreground/70 font-medium text-[13px]">
                        {formatCurrency(g.total)}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground/50 w-10 text-right font-bold">
                        {g.percentual.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${g.percentual}%`,
                        backgroundColor: categoryColors[i % categoryColors.length],
                      }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {gastosPorCategoria.length > 5 && (
              <p className="text-[11px] text-muted-foreground/50 text-center pt-1 font-medium">
                +{gastosPorCategoria.length - 5} categorias
              </p>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Tag className="h-5 w-5" />}
          title="Nenhum gasto registrado"
          description="Registre suas despesas para ver a distribuição por categoria"
        />
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="card-premium overflow-hidden flex flex-col"
    >
      <div className="p-4 sm:p-6 pb-3 sm:pb-4 flex items-center justify-between">
        <div className="section-header">
          <div className="section-header-icon bg-linear-to-br from-emerald-500/10 to-teal-500/20 text-emerald-600 dark:text-emerald-400">
            <Receipt className="h-4.5 w-4.5" />
          </div>
          <h3 className="text-sm font-bold tracking-tight">Últimos Lançamentos</h3>
        </div>
        <Link href="/lancamentos">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs text-primary hover:text-primary font-semibold"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        {lancamentos.length > 0 ? (
          <div className="divide-y divide-border/20">
            {lancamentos.slice(0, 6).map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-3.5 hover:bg-muted/15 transition-all duration-300 group"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105 ${
                    l.tipo === "receita"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  }`}
                >
                  {l.tipo === "receita" ? (
                    <ArrowUpCircle className="h-4 w-4" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{l.descricao}</p>
                  <p className="text-[11px] text-muted-foreground/50 font-medium">
                    {l.categoria} · {formatDate(l.data)}
                  </p>
                </div>
                <span
                  className={`text-[13px] font-bold tabular-nums whitespace-nowrap ${
                    l.tipo === "receita"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {l.tipo === "receita" ? "+" : "-"}
                  {formatCurrency(l.valor)}
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
