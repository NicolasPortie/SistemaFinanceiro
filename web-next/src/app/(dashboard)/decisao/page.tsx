"use client";

import { useState } from "react";
import { useAvaliarGasto, useCategorias } from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/format";
import { decisaoGastoSchema, type DecisaoGastoData } from "@/lib/schemas";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Brain,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  DollarSign,
  Calendar,
  TrendingDown,
  TrendingUp,
  Target,
  ShieldAlert,
  Info,
  RotateCcw,
  Calculator,
  BarChart3,
  Activity,
  Heart,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  StatCard,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import type { DecisaoGastoResult, DecisaoCompletaResult } from "@/lib/api";

function isDecisaoRapida(result: DecisaoGastoResult | DecisaoCompletaResult): result is DecisaoGastoResult {
  return "podeGastar" in result;
}

function parecerConfig(parecer: string) {
  switch (parecer) {
    case "pode":
      return {
        icon: <CheckCircle2 className="h-6 w-6" />,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        border: "border-emerald-200 dark:border-emerald-800",
        badgeCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
        label: "Pode gastar",
      };
    case "cautela":
      return {
        icon: <AlertTriangle className="h-6 w-6" />,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
        badgeCls: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
        label: "Com cautela",
      };
    case "segurar":
      return {
        icon: <XCircle className="h-6 w-6" />,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-950/30",
        border: "border-red-200 dark:border-red-800",
        badgeCls: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
        label: "Melhor segurar",
      };
    default:
      return {
        icon: <Info className="h-6 w-6" />,
        color: "text-muted-foreground",
        bg: "bg-muted",
        border: "border-border",
        badgeCls: "bg-muted text-muted-foreground",
        label: parecer,
      };
  }
}

export default function DecisaoPage() {
  const avaliarGasto = useAvaliarGasto();
  const { data: categorias = [] } = useCategorias();

  const form = useForm<DecisaoGastoData>({
    resolver: zodResolver(decisaoGastoSchema),
    defaultValues: { valor: "", descricao: "", categoria: "", parcelado: false, parcelas: "1" },
  });

  const parcelado = form.watch("parcelado");
  const [resultado, setResultado] = useState<DecisaoGastoResult | DecisaoCompletaResult | null>(null);

  const handleAvaliar = (data: DecisaoGastoData) => {
    const valorNum = parseFloat(data.valor.replace(",", "."));
    avaliarGasto.mutate(
      {
        valor: valorNum,
        descricao: data.descricao?.trim() || undefined,
        categoria: data.categoria || undefined,
        parcelado: data.parcelado,
        parcelas: data.parcelado ? parseInt(data.parcelas || "1") || 1 : 1,
      },
      {
        onSuccess: (res) => setResultado(res),
      }
    );
  };

  const handleReset = () => {
    setResultado(null);
    form.reset();
  };

  return (
    <PageShell>
      <PageHeader
        title="Consultor de Gastos"
        description="Informe o valor e receba uma recomendação imediata: pode gastar, com cautela ou melhor segurar — baseado no seu orçamento real."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <form onSubmit={form.handleSubmit(handleAvaliar)} className="card-premium p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-primary/15 to-primary/5 text-primary shadow-sm">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold tracking-tight text-base">Avaliar Gasto</h3>
                <p className="text-xs text-muted-foreground/60">Preencha os dados da compra</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  placeholder="0,00"
                  className={`h-11 rounded-xl pl-9 tabular-nums text-lg font-semibold ${form.formState.errors.valor ? 'border-red-500' : ''}`}
                  {...form.register("valor")}
                />
              </div>
              {form.formState.errors.valor && <p className="text-xs text-red-500 font-medium">{form.formState.errors.valor.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Input
                placeholder="Ex: Notebook, Tênis, Jantar..."
                className="h-11 rounded-xl"
                {...form.register("descricao")}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...form.register("categoria")}
              >
                <option value="">Selecione (opcional)</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border/30">
              <Label className="cursor-pointer text-sm font-semibold">Parcelado</Label>
              <Switch checked={parcelado} onCheckedChange={(v) => form.setValue("parcelado", v)} />
            </div>

            {parcelado && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Número de parcelas</Label>
                <Input
                  type="number"
                  min={2}
                  max={48}
                  className="h-11 rounded-xl"
                  {...form.register("parcelas")}
                />
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <Button
                type="submit"
                disabled={avaliarGasto.isPending}
                className="flex-1 gap-2 h-12 rounded-xl font-bold shadow-premium btn-premium"
              >
                {avaliarGasto.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Avaliar
                  </>
                )}
              </Button>
              {resultado && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="gap-2 h-12 rounded-xl font-semibold"
                >
                  <RotateCcw className="h-4 w-4" />
                  Nova avaliação
                </Button>
              )}
            </div>
          </form>
        </motion.div>

        {/* Result */}
        <AnimatePresence mode="wait">
          {resultado && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {isDecisaoRapida(resultado) ? (
                <RapidaResult data={resultado} />
              ) : (
                <CompletaResult data={resultado} />
              )}
            </motion.div>
          )}

          {!resultado && !avaliarGasto.isPending && (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card-premium p-10 flex flex-col items-center justify-center text-center min-h-75"
            >
              <div className="flex h-18 w-18 items-center justify-center rounded-3xl bg-linear-to-br from-primary/15 to-primary/5 text-primary mb-5 shadow-sm">
                <Brain className="h-9 w-9" />
              </div>
              <h3 className="font-extrabold text-lg mb-2">Análise Inteligente</h3>
              <p className="text-sm text-muted-foreground/60 max-w-sm leading-relaxed mb-6">
                Informe o valor e os detalhes da compra. O sistema analisará seu orçamento e
                indicará se é seguro realizar o gasto.
              </p>
              <div className="text-left w-full max-w-md space-y-3">
                <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Como funciona?</p>
                <div className="grid gap-2">
                  <div className="flex items-start gap-2.5 text-xs text-muted-foreground/60">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">1</span>
                    <span><strong className="text-muted-foreground/80">Orçamento</strong> — Verifica se o valor cabe no seu saldo livre do mês</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-muted-foreground/60">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">2</span>
                    <span><strong className="text-muted-foreground/80">Histórico</strong> — Compara com sua média de gastos dos últimos 3 meses</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-muted-foreground/60">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">3</span>
                    <span><strong className="text-muted-foreground/80">Tendência</strong> — Analisa se seus gastos estão subindo ou caindo</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-muted-foreground/60">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">4</span>
                    <span><strong className="text-muted-foreground/80">Saúde Financeira</strong> — Gera um score de 0 a 100 avaliando sua situação geral</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/40 italic">Quanto mais dados você cadastrar, mais precisa fica a análise.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  );
}

const camadaIconMap: Record<string, React.ReactNode> = {
  matematica: <Calculator className="h-4 w-4" />,
  historico: <BarChart3 className="h-4 w-4" />,
  tendencia: <Activity className="h-4 w-4" />,
  comportamental: <Heart className="h-4 w-4" />,
};

const camadaLabelMap: Record<string, string> = {
  matematica: "Orçamento",
  historico: "Histórico",
  tendencia: "Tendência",
  comportamental: "Saúde Financeira",
};

const camadaDescMap: Record<string, string> = {
  matematica: "Verifica se o valor cabe no saldo livre do mês",
  historico: "Compara com a média dos últimos 3 meses",
  tendencia: "Analisa se seus gastos estão subindo ou caindo",
  comportamental: "Avalia sua saúde financeira geral (score 0-100)",
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500";
  const bgColor = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  const label = score >= 70 ? "Saudável" : score >= 40 ? "Atenção" : "Crítico";

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
          <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3" strokeDasharray={`${(score / 100) * 88} 88`} strokeLinecap="round" className={color} />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${color}`}>{score}</span>
      </div>
      <div>
        <span className={`text-xs font-semibold ${color}`}>{label}</span>
        <div className="flex items-center gap-1 mt-0.5">
          <div className={`h-1.5 w-1.5 rounded-full ${bgColor}`} />
          <span className="text-[10px] text-muted-foreground/60">Saúde Financeira</span>
        </div>
      </div>
    </div>
  );
}

function RapidaResult({ data }: { data: DecisaoGastoResult }) {
  const [layersOpen, setLayersOpen] = useState(false);
  const config = parecerConfig(data.parecer);
  const percentualUsado = data.receitaPrevistoMes > 0
    ? ((data.gastoAcumuladoMes / data.receitaPrevistoMes) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Verdict Card */}
      <div className={`card-premium p-6 border-2 ${config.border}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${config.bg} ${config.color}`}>
            {config.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge className={config.badgeCls}>{config.label}</Badge>
              {data.scoreSaudeFinanceira != null && (
                <ScoreGauge score={data.scoreSaudeFinanceira} />
              )}
            </div>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {data.podeGastar ? "Este gasto está ok para seu orçamento" : "Cuidado com este gasto"}
            </p>
          </div>
        </div>
        {data.resumoTexto && (
          <p className="text-sm leading-relaxed">{data.resumoTexto}</p>
        )}
      </div>

      {/* 4-Layer Analysis */}
      {data.camadas && data.camadas.length > 0 && (
        <div className="card-premium overflow-hidden">
          <button
            onClick={() => setLayersOpen(!layersOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Como analisamos</span>
              <span className="text-xs text-muted-foreground/60">
                ({data.camadas.length} camadas de análise)
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground/60 transition-transform ${layersOpen ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {layersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  {data.camadas.map((camada, i) => {
                    const layerConfig = parecerConfig(camada.parecer);
                    return (
                      <motion.div
                        key={camada.camada}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/40"
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${layerConfig.bg} ${layerConfig.color}`}>
                          {camadaIconMap[camada.camada] ?? <Info className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">
                              {camadaLabelMap[camada.camada] ?? camada.camada}
                            </span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${layerConfig.badgeCls}`}>
                              {layerConfig.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground/70 mb-1">
                            {camadaDescMap[camada.camada] ?? ""}
                          </p>
                          <p className="text-xs leading-relaxed">
                            {camada.justificativa}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          title="Valor da Compra"
          value={formatCurrency(data.valorCompra)}
          icon={<DollarSign className="h-5 w-5" />}
          delay={0}
        />
        <StatCard
          title="Receita do Mês"
          value={formatCurrency(data.receitaPrevistoMes)}
          icon={<TrendingUp className="h-5 w-5" />}
          trend="up"
          delay={1}
        />
        <StatCard
          title="Gasto Acumulado"
          value={formatCurrency(data.gastoAcumuladoMes)}
          icon={<TrendingDown className="h-5 w-5" />}
          trend="down"
          delay={2}
        />
        <StatCard
          title="Saldo Livre"
          value={formatCurrency(data.saldoLivreMes)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          trend="up"
          delay={3}
        />
      </div>

      {/* Progress */}
      <div className="card-premium p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground/70">Orçamento utilizado</span>
          <span className="font-bold tabular-nums">{percentualUsado.toFixed(0)}%</span>
        </div>
        <Progress value={Math.min(percentualUsado, 100)} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground/70">
          <span>{formatCurrency(data.gastoAcumuladoMes)} gastos</span>
          <span>{formatCurrency(data.receitaPrevistoMes)} receita</span>
        </div>
      </div>

      {/* Goal Impact */}
      {data.impactoMetas && data.impactoMetas.length > 0 && (
        <div className="card-premium p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Impacto nas Metas</span>
          </div>
          {data.impactoMetas.map((meta) => (
            <div key={meta.nomeMeta} className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{meta.nomeMeta}</span>
                {meta.mesesAtraso > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    +{meta.mesesAtraso} {meta.mesesAtraso === 1 ? "mês" : "meses"} de atraso
                  </Badge>
                )}
              </div>
              {meta.descricao && (
                <p className="text-xs text-muted-foreground/70">{meta.descricao}</p>
              )}
              {meta.valorMensalNecessarioAntes > 0 && meta.valorMensalNecessarioDepois > meta.valorMensalNecessarioAntes && (
                <p className="text-xs">
                  Parcela mensal: {formatCurrency(meta.valorMensalNecessarioAntes)} → {formatCurrency(meta.valorMensalNecessarioDepois)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Additional Info */}
      <div className="flex flex-wrap gap-3">
        <div className="card-premium px-4 py-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground/70" />
          <span className="text-sm">
            <strong>{data.diasRestantesMes}</strong> dias restantes no mês
          </span>
        </div>
        {data.variacaoVsMediaHistorica != null && (
          <div className="card-premium px-4 py-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm">
              {data.variacaoVsMediaHistorica > 0 ? "+" : ""}{data.variacaoVsMediaHistorica.toFixed(0)}% vs média histórica
            </span>
          </div>
        )}
        {data.reservaMetas > 0 && (
          <div className="card-premium px-4 py-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm">
              <strong>{formatCurrency(data.reservaMetas)}</strong> reservado para metas
            </span>
          </div>
        )}
        {data.alertaLimite && (
          <div className="card-premium px-4 py-3 flex items-center gap-2 border-amber-200 dark:border-amber-800">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-amber-700 dark:text-amber-400">{data.alertaLimite}</span>
          </div>
        )}
      </div>

      {/* Confidence / Data Quality */}
      <div className="card-premium p-4 flex items-start gap-3 bg-primary/3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            <strong className="text-foreground/80">Dica:</strong> Quanto mais lançamentos você cadastrar (receitas, despesas, metas), mais precisa fica a análise.
            O sistema usa seus dados reais dos últimos 3 meses para calcular tendências e padrões de gasto.
          </p>
        </div>
      </div>
    </div>
  );
}

function CompletaResult({ data }: { data: DecisaoCompletaResult }) {
  return (
    <div className="card-premium p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold tracking-tight">Análise Completa</h3>
          <p className="text-xs text-muted-foreground/70">Avaliação detalhada da compra</p>
        </div>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{data.analise}</div>
      </div>
    </div>
  );
}
