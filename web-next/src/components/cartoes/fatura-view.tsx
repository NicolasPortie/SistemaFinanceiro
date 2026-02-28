"use client";

import { useState } from "react";
import { useFaturas } from "@/hooks/use-queries";
import { formatCurrency, formatDate } from "@/lib/format";
import type { FaturaResumo } from "@/lib/api";
import { Loader2, ChevronDown, ChevronUp, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FaturaSectionProps {
  fatura: FaturaResumo;
  defaultOpen: boolean;
}

export function FaturaSection({ fatura, defaultOpen }: FaturaSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const vencida = new Date(fatura.dataVencimento) < new Date() && fatura.status !== "Paga";
  const statusLabel = vencida ? "Vencida" : fatura.status;
  const statusClass = vencida
    ? "text-red-600 dark:text-red-400 font-bold"
    : fatura.status === "Aberta"
      ? "text-amber-600 dark:text-amber-400 font-medium"
      : "text-emerald-600 dark:text-emerald-400 font-medium";
  const iconBg = vencida ? "bg-red-100 dark:bg-red-900/30" : "bg-violet-100 dark:bg-violet-900/30";
  const iconColor = vencida
    ? "text-red-600 dark:text-red-400"
    : "text-violet-600 dark:text-violet-400";

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-sm ${vencida ? "border-red-300 dark:border-red-800" : "border-border/40"}`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-all duration-300 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-8 w-8 rounded-full ${iconBg} flex items-center justify-center shrink-0`}
          >
            <Receipt className={`h-3.5 w-3.5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{fatura.mesReferencia}</p>
            <p className="text-[11px] text-muted-foreground">
              Venc. {formatDate(fatura.dataVencimento)} ·{" "}
              <span className={statusClass}>{statusLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums">{formatCurrency(fatura.total)}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && fatura.parcelas.length > 0 && (
        <div className="border-t border-border/40 overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/30">
                <th className="text-left font-medium px-4 py-2">Lançamento</th>
                <th className="text-right font-medium px-4 py-2 w-24">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {fatura.parcelas.map((p, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate max-w-[200px]">{p.descricao}</span>
                      {p.totalParcelas > 1 && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 font-medium shrink-0"
                        >
                          {p.numeroParcela}/{p.totalParcelas}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(p.dataCompra)}
                      </span>
                      {p.categoria && (
                        <span className="text-[11px] text-muted-foreground">· {p.categoria}</span>
                      )}
                      {p.totalParcelas > 1 && (
                        <span className="text-[11px] text-muted-foreground">
                          · Total {formatCurrency(p.valorTotal)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-semibold tabular-nums">{formatCurrency(p.valor)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && fatura.parcelas.length === 0 && (
        <div className="border-t border-border/40 px-4 py-3">
          <p className="text-xs text-muted-foreground text-center">
            Nenhum lançamento nesta fatura.
          </p>
        </div>
      )}
    </div>
  );
}

interface FaturaViewProps {
  cartaoId: number;
}

export function FaturaView({ cartaoId }: FaturaViewProps) {
  const { data: faturas, isLoading, isError } = useFaturas(cartaoId);

  if (isLoading)
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (isError || !faturas || faturas.length === 0)
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sem faturas pendentes para este cartão.
      </p>
    );

  const totalGeral = faturas.reduce((s, f) => s + f.total, 0);
  const totalLancamentos = faturas.reduce((s, f) => s + f.parcelas.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Total pendente</p>
          <p className="text-xl font-bold tracking-tight">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="text-right space-y-0.5">
          <p className="text-xs text-muted-foreground">
            {faturas.length} {faturas.length === 1 ? "fatura" : "faturas"}
          </p>
          <p className="text-xs text-muted-foreground">
            {totalLancamentos} {totalLancamentos === 1 ? "lançamento" : "lançamentos"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {faturas.map((fatura, i) => (
          <FaturaSection key={fatura.faturaId} fatura={fatura} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
