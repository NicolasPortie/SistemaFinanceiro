"use client";

import { useState } from "react";
import { useAvaliarGasto, useCategorias } from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
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

  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [parcelado, setParcelado] = useState(false);
  const [parcelas, setParcelas] = useState("1");

  const [resultado, setResultado] = useState<DecisaoGastoResult | DecisaoCompletaResult | null>(null);

  const handleAvaliar = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(valor.replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error("Informe um valor válido maior que zero");
      return;
    }

    avaliarGasto.mutate(
      {
        valor: valorNum,
        descricao: descricao.trim() || undefined,
        categoria: categoria || undefined,
        parcelado,
        parcelas: parcelado ? parseInt(parcelas) || 1 : 1,
      },
      {
        onSuccess: (data) => setResultado(data),
      }
    );
  };

  const handleReset = () => {
    setResultado(null);
    setValor("");
    setDescricao("");
    setCategoria("");
    setParcelado(false);
    setParcelas("1");
  };

  return (
    <PageShell>
      <PageHeader
        title="Decisão de Gasto"
        description="Avalie se uma compra cabe no seu orçamento antes de realizá-la"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <form onSubmit={handleAvaliar} className="card-premium p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm">
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
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="h-11 rounded-xl pl-9 tabular-nums text-lg font-semibold"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Input
                placeholder="Ex: Notebook, Tênis, Jantar..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.nome}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border/30">
              <Label className="cursor-pointer text-sm font-semibold">Parcelado</Label>
              <Switch checked={parcelado} onCheckedChange={setParcelado} />
            </div>

            {parcelado && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Número de parcelas</Label>
                <Input
                  type="number"
                  min={2}
                  max={48}
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  className="h-11 rounded-xl"
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
              className="card-premium p-10 flex flex-col items-center justify-center text-center min-h-[300px]"
            >
              <div className="flex h-18 w-18 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary mb-5 shadow-sm">
                <Brain className="h-9 w-9" />
              </div>
              <h3 className="font-extrabold text-lg mb-2">Análise Inteligente</h3>
              <p className="text-sm text-muted-foreground/60 max-w-sm leading-relaxed">
                Informe o valor e os detalhes da compra. O sistema analisará seu orçamento e
                indicará se é seguro realizar o gasto.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  );
}

function RapidaResult({ data }: { data: DecisaoGastoResult }) {
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
          <div>
            <Badge className={config.badgeCls}>{config.label}</Badge>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {data.podeGastar ? "Este gasto está ok para seu orçamento" : "Cuidado com este gasto"}
            </p>
          </div>
        </div>
        {data.resumoTexto && (
          <p className="text-sm leading-relaxed">{data.resumoTexto}</p>
        )}
      </div>

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

      {/* Additional Info */}
      <div className="flex flex-wrap gap-3">
        <div className="card-premium px-4 py-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground/70" />
          <span className="text-sm">
            <strong>{data.diasRestantesMes}</strong> dias restantes no mês
          </span>
        </div>
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
