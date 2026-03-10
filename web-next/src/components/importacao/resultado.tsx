"use client";

import {
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  RotateCcw,
  Copy,
  Ban,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ImportacaoResultado } from "@/lib/api";
import { motion } from "framer-motion";

interface ResultadoProps {
  resultado: ImportacaoResultado;
  onNovaImportacao: () => void;
  onVerLancamentos: () => void;
}

export function Resultado({ resultado, onNovaImportacao, onVerLancamentos }: ResultadoProps) {
  const hasErrors = resultado.totalErros > 0;
  const success = resultado.totalImportadas > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Main Status */}
      <div className="flex flex-col items-center gap-4 py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
        >
          {success ? (
            <div className="rounded-full bg-emerald-100 p-5 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-14 w-14 text-emerald-600 dark:text-emerald-400" />
            </div>
          ) : (
            <div className="rounded-full bg-red-100 p-5 dark:bg-red-900/30">
              <AlertCircle className="h-14 w-14 text-red-600 dark:text-red-400" />
            </div>
          )}
        </motion.div>

        <div className="text-center">
          <h3 className="text-2xl font-semibold">
            {success ? "Importação concluída!" : "Falha na importação"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            {success
              ? `${resultado.totalImportadas} lançamento${resultado.totalImportadas !== 1 ? "s" : ""} importado${resultado.totalImportadas !== 1 ? "s" : ""} com sucesso`
              : "Nenhum lançamento foi importado"}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Importados"
          value={resultado.totalImportadas}
          color="emerald"
          icon={CheckCircle2}
          delay={0.15}
        />
        <StatCard
          label="Duplicatas ignoradas"
          value={resultado.totalDuplicatasIgnoradas}
          color="orange"
          icon={Copy}
          delay={0.2}
        />
        <StatCard
          label="Ignorados"
          value={resultado.totalIgnoradas}
          color="neutral"
          icon={Ban}
          delay={0.25}
        />
        <StatCard
          label="Erros"
          value={resultado.totalErros}
          color="red"
          icon={XCircle}
          delay={0.3}
        />
      </div>

      {/* Errors */}
      {hasErrors && resultado.erros.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ delay: 0.35 }}
        >
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Erros encontrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {resultado.erros.map((erro, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    {erro}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4"
      >
        <Button variant="outline" onClick={onNovaImportacao} size="lg">
          <RotateCcw className="mr-2 h-4 w-4" />
          Nova Importação
        </Button>
        {success && (
          <Button onClick={onVerLancamentos} size="lg">
            <FileText className="mr-2 h-4 w-4" />
            Ver Lançamentos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon: Icon,
  delay,
}: {
  label: string;
  value: number;
  color: "emerald" | "orange" | "neutral" | "red";
  icon: React.ElementType;
  delay: number;
}) {
  const colorMap = {
    emerald: {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/40",
      border: value > 0 ? "border-emerald-200 dark:border-emerald-800" : "",
    },
    orange: {
      text: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/40",
      border: value > 0 ? "border-orange-200 dark:border-orange-800" : "",
    },
    neutral: {
      text: "text-neutral-500 dark:text-neutral-400",
      bg: "bg-neutral-200 dark:bg-neutral-700/40",
      border: "",
    },
    red: {
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/40",
      border: value > 0 ? "border-red-200 dark:border-red-800" : "",
    },
  };

  const cfg = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className={cn("transition-all", cfg.border)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", cfg.bg)}>
              <Icon className={cn("h-4.5 w-4.5", cfg.text)} />
            </div>
            <div>
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  value > 0 ? cfg.text : "text-muted-foreground"
                )}
              >
                {value}
              </p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
