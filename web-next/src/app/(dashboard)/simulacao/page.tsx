"use client";

import { useState } from "react";
import {
  useCartoes,
  usePerfilFinanceiro,
  useHistoricoSimulacao,
  useSimularCompra,
} from "@/hooks/use-queries";
import type { SimularCompraRequest, SimulacaoResultado } from "@/lib/api";
import { formatCurrency, riskColor, formatMonth } from "@/lib/format";
import { simulacaoSchema, type SimulacaoData } from "@/lib/schemas";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
  Activity,
  Wallet,
  Calendar,
  History,
  Zap,
  DollarSign,
} from "lucide-react";
import { PageShell, PageHeader, StatCard, EmptyState } from "@/components/shared/page-components";
import { ProjectionChart } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const paymentMethods = [
  { value: "pix", label: "PIX", icon: Smartphone },
  { value: "debito", label: "Débito", icon: Banknote },
  { value: "credito", label: "Crédito", icon: CreditCard },
];

const parcelasOpcoes = [1, 2, 3, 4, 6, 8, 10, 12];

export default function SimulacaoPage() {
  const { data: cartoes = [] } = useCartoes();
  const { data: perfil } = usePerfilFinanceiro();
  const { data: historico = [], refetch: carregarHistorico } = useHistoricoSimulacao();
  const simularMutation = useSimularCompra();

  // Form
  const form = useForm<SimulacaoData>({
    resolver: zodResolver(simulacaoSchema),
    defaultValues: { descricao: "", valor: "", formaPagamento: "pix", parcelas: 1, cartaoId: "" },
  });

  const formaPagamento = form.watch("formaPagamento");
  const parcelas = form.watch("parcelas");
  const [resultado, setResultado] = useState<SimulacaoResultado | null>(null);
  const [showMeses, setShowMeses] = useState(false);

  const handleSimular = (data: SimulacaoData) => {
    const valorNum = parseFloat(data.valor.replace(",", "."));
    setResultado(null);
    const req: SimularCompraRequest = {
      descricao: data.descricao,
      valor: valorNum,
      formaPagamento: data.formaPagamento,
      numeroParcelas: data.formaPagamento === "credito" ? data.parcelas : 1,
      cartaoCreditoId: data.cartaoId ? parseInt(data.cartaoId) : undefined,
    };
    simularMutation.mutate(req, {
      onSuccess: (res) => setResultado(res),
    });
  };

  const riskIcon = (risk: string) => {
    switch (risk.toLowerCase()) {
      case "baixo":
        return <CheckCircle2 className="h-5 w-5" />;
      case "medio":
      case "médio":
        return <AlertTriangle className="h-5 w-5" />;
      case "alto":
        return <XCircle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Simulação de Compra"
        description="Projeta o impacto de uma compra nos próximos 12 meses, considerando suas receitas, despesas e metas"
      />

      <Tabs defaultValue="simular" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-12 rounded-xl">
          <TabsTrigger value="simular" className="gap-2 rounded-lg">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Simular</span>
          </TabsTrigger>
          <TabsTrigger value="perfil" className="gap-2 rounded-lg">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2 rounded-lg" onClick={() => carregarHistorico()}>
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Simular ── */}
        <TabsContent value="simular" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium p-6"
          >
            <form onSubmit={form.handleSubmit(handleSimular)} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
                  <Input
                    placeholder="Ex: iPhone 16 Pro Max"
                    className={`h-11 rounded-xl ${form.formState.errors.descricao ? 'border-red-500' : ''}`}
                    {...form.register("descricao")}
                  />
                  {form.formState.errors.descricao && <p className="text-xs text-red-500 font-medium">{form.formState.errors.descricao.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
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
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de Pagamento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {paymentMethods.map((pm) => (
                      <button
                        key={pm.value}
                        type="button"
                        className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${formaPagamento === pm.value ? "bg-primary/10 text-primary border-2 border-primary/30 shadow-md shadow-primary/5" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40"}`}
                        onClick={() => {
                          form.setValue("formaPagamento", pm.value as "pix" | "debito" | "credito");
                          if (pm.value !== "credito") form.setValue("parcelas", 1);
                        }}
                      >
                        <pm.icon className="h-4.5 w-4.5" />
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {formaPagamento === "credito" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid gap-4 sm:grid-cols-2 overflow-hidden"
                  >
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parcelas</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {parcelasOpcoes.map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`h-9 min-w-11 px-3 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${parcelas === p ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted border border-border/40"}`}
                            onClick={() => form.setValue("parcelas", p)}
                          >
                            {p}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cartão</Label>
                      <Select value={form.watch("cartaoId") || ""} onValueChange={(v) => form.setValue("cartaoId", v)}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Selecione o cartão" />
                        </SelectTrigger>
                        <SelectContent>
                          {cartoes.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                className="w-full sm:w-auto h-12 gap-2.5 font-bold shadow-premium btn-premium rounded-xl"
                disabled={simularMutation.isPending}
              >
                {simularMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Simular compra
                  </>
                )}
              </Button>
            </form>
          </motion.div>

          {/* Como funciona — visible only before first result */}
          {!resultado && !simularMutation.isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card-premium p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Como funciona a simulação?</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground/60">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">1</span>
                  <span><strong className="text-muted-foreground/80">Projeção de 12 meses</strong> — Simula mês a mês como fica seu saldo com a compra</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground/60">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">2</span>
                  <span><strong className="text-muted-foreground/80">Sazonalidade</strong> — Considera gastos sazonais (IPVA, material escolar, etc.)</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground/60">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">3</span>
                  <span><strong className="text-muted-foreground/80">Impacto em metas</strong> — Mostra se a compra atrasa suas metas financeiras</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground/60">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">4</span>
                  <span><strong className="text-muted-foreground/80">Cenários alternativos</strong> — Sugere parcelamentos com risco menor</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/40 italic">Use dados reais para resultados mais precisos. Quanto mais lançamentos, melhor a projeção.</p>
            </motion.div>
          )}

          {/* Resultado */}
          <AnimatePresence>
            {resultado && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Risk Card */}
                <div
                  className={`rounded-2xl border p-6 ${riskColor(resultado.risco).bg} ${riskColor(resultado.risco).border}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${riskColor(resultado.risco).badge}`}
                    >
                      {riskIcon(resultado.risco)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold">Risco {resultado.risco}</h3>
                        <Badge className={riskColor(resultado.risco).badge}>
                          Confiança: {resultado.confianca}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground/70 leading-relaxed">
                        {resultado.recomendacao}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <StatCard
                    title="Pior Mês"
                    value={resultado.piorMes}
                    subtitle={`Saldo: ${formatCurrency(resultado.menorSaldoProjetado)}`}
                    icon={<TrendingDown className="h-5 w-5" />}
                    trend="down"
                  />
                  <StatCard
                    title="Folga Mensal Média"
                    value={formatCurrency(resultado.folgaMensalMedia)}
                    icon={<TrendingUp className="h-5 w-5" />}
                    trend={resultado.folgaMensalMedia >= 0 ? "up" : "down"}
                  />
                </div>

                {/* Alternative Scenarios */}
                {resultado.cenariosAlternativos && resultado.cenariosAlternativos.length > 0 && (
                  <div className="card-premium p-6">
                    <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground/70 mb-4">
                      Cenários Alternativos
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {resultado.cenariosAlternativos.map((c) => (
                        <div
                          key={c.numeroParcelas}
                          className="rounded-xl border border-border p-4 space-y-2 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">{c.numeroParcelas}x</span>
                            <Badge className={riskColor(c.risco).badge} variant="secondary">
                              {c.risco}
                            </Badge>
                          </div>
                          <p className="text-lg font-bold tabular-nums">
                            {formatCurrency(c.valorParcela)}
                            <span className="text-[11px] text-muted-foreground/60 font-normal">/mês</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 font-medium">
                            Menor saldo: {formatCurrency(c.menorSaldoProjetado)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly Projection */}
                {resultado.meses && resultado.meses.length > 0 && (
                  <>
                    {/* Area Chart */}
                    <div className="card-premium p-6">
                      <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground/70 mb-4">
                        Projeção Visual
                      </h3>
                      <ProjectionChart data={resultado.meses} />
                    </div>

                    {/* Table */}
                    <div className="card-premium p-6">
                      <button
                        onClick={() => setShowMeses(!showMeses)}
                        className="flex w-full items-center justify-between"
                      >
                        <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground/70">
                          Projeção Mensal ({resultado.meses.length} meses)
                        </h3>
                        {showMeses ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground/70" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
                        )}
                      </button>

                      <AnimatePresence>
                        {showMeses && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 overflow-auto"
                          >
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="py-2 text-left font-medium text-muted-foreground/70">
                                    Mês
                                  </th>
                                  <th className="py-2 text-right font-medium text-muted-foreground/70">
                                    Saldo Base
                                  </th>
                                  <th className="py-2 text-right font-medium text-muted-foreground/70">
                                    Impacto
                                  </th>
                                  <th className="py-2 text-right font-medium text-muted-foreground/70">
                                    Saldo Final
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {resultado.meses.map((m) => (
                                  <tr
                                    key={m.mes}
                                    className={`border-b border-border/50 ${
                                      m.saldoComCompra < 0 ? "bg-red-50 dark:bg-red-950/20" : ""
                                    }`}
                                  >
                                    <td className="py-2.5 font-medium">{formatMonth(m.mes)}</td>
                                    <td className="py-2.5 text-right tabular-nums">
                                      {formatCurrency(m.saldoBase)}
                                    </td>
                                    <td className="py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">
                                      {m.impactoCompra > 0
                                        ? `-${formatCurrency(m.impactoCompra)}`
                                        : "-"}
                                    </td>
                                    <td
                                      className={`py-2.5 text-right font-bold tabular-nums ${
                                        m.saldoComCompra < 0
                                          ? "text-red-600 dark:text-red-400"
                                          : "text-emerald-600 dark:text-emerald-400"
                                      }`}
                                    >
                                      {formatCurrency(m.saldoComCompra)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}

                {/* Health Score & Extra Risk Info */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {resultado.scoreSaudeFinanceira != null && (
                    <div className="card-premium p-4 flex items-center gap-4">
                      <div className="relative h-12 w-12 shrink-0">
                        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
                          <circle
                            cx="18" cy="18" r="14" fill="none" strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={`${(resultado.scoreSaudeFinanceira / 100) * 88} 88`}
                            className={resultado.scoreSaudeFinanceira >= 70 ? "text-emerald-500" : resultado.scoreSaudeFinanceira >= 40 ? "text-amber-500" : "text-red-500"}
                          />
                        </svg>
                        <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${
                          resultado.scoreSaudeFinanceira >= 70 ? "text-emerald-500" : resultado.scoreSaudeFinanceira >= 40 ? "text-amber-500" : "text-red-500"
                        }`}>
                          {resultado.scoreSaudeFinanceira}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Saúde Financeira</p>
                        <p className="text-xs text-muted-foreground/60">
                          {resultado.scoreSaudeFinanceira >= 70
                            ? "Situação saudável para esta compra"
                            : resultado.scoreSaudeFinanceira >= 40
                            ? "Atenção — orçamento apertado"
                            : "Momento crítico para gastos extras"}
                        </p>
                      </div>
                    </div>
                  )}
                  {resultado.probabilidadeMesNegativo != null && resultado.probabilidadeMesNegativo > 0 && (
                    <div className="card-premium p-4 flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">Meses no Vermelho</p>
                        <p className="text-xs text-muted-foreground/60">
                          {resultado.probabilidadeMesNegativo} de 12 meses projetados ficam com saldo negativo
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Goal Impact */}
                {resultado.impactoMetas && resultado.impactoMetas.length > 0 && (
                  <div className="card-premium p-6 space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground/70">
                      Impacto nas Metas
                    </h3>
                    {resultado.impactoMetas.map((meta) => (
                      <div key={meta.nomeMeta} className="rounded-xl border border-border/50 p-4 space-y-2 bg-muted/10">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">{meta.nomeMeta}</span>
                          </div>
                          {meta.mesesAtraso > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              +{meta.mesesAtraso} {meta.mesesAtraso === 1 ? "mês" : "meses"} de atraso
                            </Badge>
                          )}
                          {meta.reservaAbaixoMinimo && (
                            <Badge variant="destructive" className="text-[10px]">
                              Abaixo da reserva mínima
                            </Badge>
                          )}
                        </div>
                        {meta.descricao && (
                          <p className="text-xs text-muted-foreground/70">{meta.descricao}</p>
                        )}
                        {meta.valorMensalNecessarioAntes > 0 && meta.valorMensalNecessarioDepois > meta.valorMensalNecessarioAntes && (
                          <p className="text-xs">
                            Parcela mensal necessária: {formatCurrency(meta.valorMensalNecessarioAntes)} → {formatCurrency(meta.valorMensalNecessarioDepois)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Seasonal Events */}
                {resultado.eventosSazonaisConsiderados && resultado.eventosSazonaisConsiderados.length > 0 && (
                  <div className="card-premium p-6 space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground/70">
                      Eventos Sazonais Considerados
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {resultado.eventosSazonaisConsiderados.map((ev) => (
                        <div key={ev.id} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 bg-muted/10">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <span className="text-xs font-medium">{ev.descricao}</span>
                          <span className="text-xs text-muted-foreground/60">
                            {ev.ehReceita ? "+" : "-"}{formatCurrency(ev.valorMedio)}
                          </span>
                          {ev.detectadoAutomaticamente && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">Auto</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence / Data Tip */}
                <div className="card-premium p-4 flex items-start gap-3 bg-primary/[0.03]">
                  <Activity className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    <strong className="text-foreground/80">Dica:</strong> Quanto mais lançamentos você cadastrar (receitas, despesas, metas), mais precisa fica a simulação.
                    As projeções usam seus dados reais e consideram sazonalidades detectadas automaticamente.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ── Tab Perfil ── */}
        <TabsContent value="perfil" className="space-y-4">
          {perfil ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  title="Receita Média"
                  value={formatCurrency(perfil.receitaMensalMedia)}
                  icon={<TrendingUp className="h-5 w-5" />}
                  trend="up"
                  delay={0}
                />
                <StatCard
                  title="Gasto Médio"
                  value={formatCurrency(perfil.gastoMensalMedio)}
                  icon={<TrendingDown className="h-5 w-5" />}
                  trend="down"
                  delay={1}
                />
                <StatCard
                  title="Saldo Médio"
                  value={formatCurrency(perfil.saldoMedioMensal)}
                  icon={<Wallet className="h-5 w-5" />}
                  trend={perfil.saldoMedioMensal >= 0 ? "up" : "down"}
                  delay={2}
                />
                <StatCard
                  title="Parcelas Abertas"
                  value={perfil.quantidadeParcelasAbertas.toString()}
                  subtitle={`Total: ${formatCurrency(perfil.totalParcelasAbertas)}`}
                  icon={<CreditCard className="h-5 w-5" />}
                  delay={3}
                />
                <StatCard
                  title="Histórico"
                  value={`${perfil.mesesComDados} meses`}
                  subtitle={`${perfil.diasDeHistorico} dias de dados`}
                  icon={<Calendar className="h-5 w-5" />}
                  delay={4}
                />
                <StatCard
                  title="Confiança"
                  value={perfil.confianca}
                  icon={<Target className="h-5 w-5" />}
                  delay={5}
                />
              </div>

              {/* Gasto Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card-premium p-6"
              >
                <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground/70 mb-4">
                  Composição dos Gastos
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Gastos Fixos</span>
                      <span className="font-bold tabular-nums">
                        {formatCurrency(perfil.gastoFixoEstimado)}
                      </span>
                    </div>
                    <Progress
                      value={
                        perfil.gastoMensalMedio > 0
                          ? (perfil.gastoFixoEstimado / perfil.gastoMensalMedio) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Gastos Variáveis</span>
                      <span className="font-bold tabular-nums">
                        {formatCurrency(perfil.gastoVariavelEstimado)}
                      </span>
                    </div>
                    <Progress
                      value={
                        perfil.gastoMensalMedio > 0
                          ? (perfil.gastoVariavelEstimado / perfil.gastoMensalMedio) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                </div>
              </motion.div>
            </>
          ) : (
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" />}
              title="Perfil indisponível"
              description="Registre lançamentos para gerar seu perfil financeiro"
            />
          )}
        </TabsContent>

        {/* ── Tab Histórico ── */}
        <TabsContent value="historico" className="space-y-4">
          {historico.length > 0 ? (
            <div className="space-y-3">
              {historico.map((h) => (
                <motion.div
                  key={h.simulacaoId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-premium p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold tracking-tight">{h.descricao}</h4>
                      <p className="text-sm text-muted-foreground/70">
                        {formatCurrency(h.valor)} • {h.formaPagamento}
                        {h.numeroParcelas > 1 && ` • ${h.numeroParcelas}x`}
                      </p>
                    </div>
                    <Badge className={riskColor(h.risco).badge}>{h.risco}</Badge>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-[11px] text-muted-foreground/60 font-medium">Pior Mês</p>
                      <p className="font-medium">{h.piorMes}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground/60 font-medium">Menor Saldo</p>
                      <p className="font-medium tabular-nums">
                        {formatCurrency(h.menorSaldoProjetado)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground/60 font-medium">Folga Mensal</p>
                      <p className="font-medium tabular-nums">
                        {formatCurrency(h.folgaMensalMedia)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="Nenhuma simulação"
              description="Faça sua primeira simulação para ver o histórico aqui"
            />
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
