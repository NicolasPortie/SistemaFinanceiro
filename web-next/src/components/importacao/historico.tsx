"use client";

import { FileText, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/format";
import { useImportacaoHistorico } from "@/hooks/use-queries";
import type { FormatoArquivo, StatusImportacao, TipoImportacao } from "@/lib/api";
import { motion } from "framer-motion";

const FORMATO_LABEL: Record<FormatoArquivo, string> = {
  CSV: "CSV",
  XLSX: "XLSX",
  OFX: "OFX",
  PDF: "PDF",
};

const TIPO_LABEL: Record<TipoImportacao, string> = {
  Extrato: "Extrato Bancário",
  Fatura: "Fatura de Cartão",
};

const STATUS_CONFIG: Record<StatusImportacao, { label: string; color: string; icon: React.ElementType }> = {
  Processado: { label: "Processado", color: "text-amber-600 dark:text-amber-400", icon: Clock },
  Confirmado: { label: "Confirmado", color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  Falhou: { label: "Falhou", color: "text-red-600 dark:text-red-400", icon: XCircle },
};

export function HistoricoImportacao() {
  const { data: historico, isLoading, error } = useImportacaoHistorico();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive p-4">
        <AlertCircle className="h-4 w-4" />
        Erro ao carregar histórico
      </div>
    );
  }

  if (!historico || historico.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">Nenhuma importação realizada</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {historico.map((item, i) => {
        const statusCfg = STATUS_CONFIG[item.status];
        const StatusIcon = statusCfg.icon;

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="hover:bg-muted/30 transition-colors">
              <CardContent className="p-3 flex items-center gap-4">
                <div className="shrink-0">
                  <div className="rounded-lg bg-muted p-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.nomeArquivo}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {FORMATO_LABEL[item.formatoArquivo]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {TIPO_LABEL[item.tipoImportacao]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {item.bancoDetectado && <span>{item.bancoDetectado}</span>}
                    <span>
                      {item.qtdTransacoesImportadas}/{item.qtdTransacoesEncontradas} transações
                    </span>
                    <span>{formatShortDate(item.criadoEm)}</span>
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      statusCfg.color
                    )}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {statusCfg.label}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
