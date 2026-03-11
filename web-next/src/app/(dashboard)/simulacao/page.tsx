"use client";

import { useState } from "react";
import {
  useCartoes,
  useCategorias,
  usePerfilFinanceiro,
  useHistoricoSimulacao,
  useSimularCompra,
  useAvaliarGasto,
} from "@/hooks/use-queries";
import type {
  SimularCompraRequest,
  SimulacaoResultado,
  DecisaoGastoResult,
  DecisaoCompletaResult,
} from "@/lib/api";
import { formatCurrency, riskColor, formatMonth } from "@/lib/format";
import {
  simulacaoSchema,
  decisaoGastoSchema,
  type SimulacaoData,
  type DecisaoGastoData,
} from "@/lib/schemas";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Target,
  Activity,
  Wallet,
  Calendar,
  History,
  Zap,
  Brain,
  Info,
  RotateCcw,
  Calculator,
  Heart,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import {
  ProjectionChart,
  MonthlyCompositionChart,
  ImpactPercentChart,
  ScenariosCompareChart,
  BudgetDonutChart,
  BalanceLineChart,
} from "@/components/charts";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

/* ────────────────────────────────────────────── */
/* Constants                                       */
/* ────────────────────────────────────────────── */

type AnalysisMode = "rapida" | "projecao";

/* ────────────────────────────────────────────── */
/* Helper functions                                */
/* ────────────────────────────────────────────── */

function isDecisaoRapida(
  result: DecisaoGastoResult | DecisaoCompletaResult
): result is DecisaoGastoResult {
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
        heroGradient: "from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20",
        heroIcon: "text-emerald-500",
      };
    case "cautela":
      return {
        icon: <AlertTriangle className="h-6 w-6" />,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
        badgeCls: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
        label: "Com cautela",
        heroGradient: "from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/20",
        heroIcon: "text-yellow-500",
      };
    case "segurar":
      return {
        icon: <XCircle className="h-6 w-6" />,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-950/30",
        border: "border-red-200 dark:border-red-800",
        badgeCls: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
        label: "Melhor segurar",
        heroGradient: "from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20",
        heroIcon: "text-red-500",
      };
    default:
      return {
        icon: <Info className="h-6 w-6" />,
        color: "text-slate-500",
        bg: "bg-slate-50 dark:bg-slate-800/30",
        border: "border-slate-200 dark:border-slate-700",
        badgeCls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        label: parecer,
        heroGradient: "from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/20",
        heroIcon: "text-slate-400",
      };
  }
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

/* ────────────────────────────────────────────── */
/* Main Page                                       */
/* ────────────────────────────────────────────── */

export default function ConsultorFinanceiroPage() {
  /* ── queries / mutations ── */
  const { data: cartoes = [] } = useCartoes();
  const { data: categorias = [] } = useCategorias();
  usePerfilFinanceiro(); // prefetch for background data
  const { data: historico = [], refetch: carregarHistorico } = useHistoricoSimulacao();
  const simularMutation = useSimularCompra();
  const avaliarGasto = useAvaliarGasto();

  /* ── state ── */
  const [mode, setMode] = useState<AnalysisMode>("rapida");
  const [tab, setTab] = useState<"nova" | "historico">("nova");
  const [resultadoSimulacao, setResultadoSimulacao] = useState<SimulacaoResultado | null>(null);
  const [resultadoDecisao, setResultadoDecisao] = useState<
    DecisaoGastoResult | DecisaoCompletaResult | null
  >(null);
  const [showMeses, setShowMeses] = useState(false);

  /* ── forms ── */
  const rapidaForm = useForm<DecisaoGastoData>({
    resolver: zodResolver(decisaoGastoSchema),
    defaultValues: { valor: "", descricao: "", categoria: "", parcelado: false, parcelas: "1" },
  });

  const projecaoForm = useForm<SimulacaoData>({
    resolver: zodResolver(simulacaoSchema),
    defaultValues: { descricao: "", valor: "", formaPagamento: "pix", parcelas: 1, cartaoId: "" },
  });

  const parcelado = rapidaForm.watch("parcelado");
  const formaPagamento = projecaoForm.watch("formaPagamento");
  const parcelas = projecaoForm.watch("parcelas");

  const isLoading = simularMutation.isPending || avaliarGasto.isPending;
  const hasResult = resultadoSimulacao !== null || resultadoDecisao !== null;

  /* ── handlers ── */
  const handleRapida = (data: DecisaoGastoData) => {
    const valorNum = parseFloat(data.valor.replace(",", "."));
    setResultadoDecisao(null);
    setResultadoSimulacao(null);
    avaliarGasto.mutate(
      {
        valor: valorNum,
        descricao: data.descricao?.trim() || undefined,
        categoria: data.categoria || undefined,
        parcelado: data.parcelado,
        parcelas: data.parcelado ? parseInt(data.parcelas || "1") || 1 : 1,
      },
      { onSuccess: (res) => setResultadoDecisao(res) }
    );
  };

  const handleProjecao = (data: SimulacaoData) => {
    const valorNum = parseFloat(data.valor.replace(",", "."));
    setResultadoSimulacao(null);
    setResultadoDecisao(null);
    const req: SimularCompraRequest = {
      descricao: data.descricao,
      valor: valorNum,
      formaPagamento: data.formaPagamento,
      numeroParcelas: data.formaPagamento === "credito" ? data.parcelas : 1,
      cartaoCreditoId: data.cartaoId ? parseInt(data.cartaoId) : undefined,
    };
    simularMutation.mutate(req, {
      onSuccess: (res) => setResultadoSimulacao(res),
    });
  };

  const handleReset = () => {
    setResultadoDecisao(null);
    setResultadoSimulacao(null);
    rapidaForm.reset();
    projecaoForm.reset();
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

  /* ── render ── */
  return (
    <div className="flex flex-col gap-5 sm:gap-8">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl serif-italic text-slate-900 dark:text-white mb-2">
            Simulação
          </h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">
            Consultor Financeiro Estratégico
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setTab(tab === "historico" ? "nova" : "historico");
            if (tab !== "historico") carregarHistorico();
          }}
          aria-pressed={tab === "historico"}
          className="flex items-center gap-2 exec-card px-5 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <History className="h-4 w-4" />
          {tab === "historico" ? "Nova Análise" : "Ver Histórico"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "nova" ? (
          <motion.div
            key="nova"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* ═══ LEFT: Input Form (4 cols) ═══ */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 flex flex-col overflow-hidden">
                {/* Mode Toggle */}
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">
                  Configuração
                </p>
                <div className="flex flex-col gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/70 rounded-2xl mb-8">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("rapida");
                      handleReset();
                    }}
                    aria-pressed={mode === "rapida"}
                    className={`w-full py-2.5 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all cursor-pointer ${mode === "rapida" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-900/50"}`}
                  >
                    Pensamento Rápido
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("projecao");
                      handleReset();
                    }}
                    aria-pressed={mode === "projecao"}
                    className={`w-full py-2.5 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all cursor-pointer ${mode === "projecao" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-900/50"}`}
                  >
                    Projeção Estratégica
                  </button>
                </div>

                {/* ── RÁPIDA form ── */}
                <AnimatePresence mode="wait">
                  {mode === "rapida" ? (
                    <motion.form
                      key="form-rapida"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex flex-col gap-6"
                      onSubmit={rapidaForm.handleSubmit(handleRapida)}
                    >
                      <div className="border-b border-slate-50 dark:border-slate-800 pb-6">
                        <label
                          htmlFor="simulacao-rapida-valor"
                          className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2"
                        >
                          Valor (R$) *
                        </label>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                            R$
                          </span>
                          <CurrencyInput
                            id="simulacao-rapida-valor"
                            name="valor_rapido"
                            placeholder="0,00"
                            className={`flex-1 bg-transparent border-none p-0 text-xl font-semibold text-slate-900 dark:text-white focus:ring-0 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-500 ${rapidaForm.formState.errors.valor ? "text-red-500" : ""}`}
                            value={rapidaForm.watch("valor")}
                            onValueChange={(v) =>
                              rapidaForm.setValue("valor", v, {
                                shouldValidate: rapidaForm.formState.isSubmitted,
                              })
                            }
                          />
                        </div>
                        {rapidaForm.formState.errors.valor && (
                          <p className="text-xs text-red-500 font-medium mt-1">
                            {rapidaForm.formState.errors.valor.message}
                          </p>
                        )}
                      </div>

                      <div className="border-b border-slate-50 dark:border-slate-800 pb-6">
                        <label
                          htmlFor="simulacao-rapida-descricao"
                          className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2"
                        >
                          Descrição
                        </label>
                        <input
                          id="simulacao-rapida-descricao"
                          autoComplete="off"
                          className="w-full bg-transparent border-none p-0 text-sm font-semibold text-slate-900 dark:text-white focus:ring-0 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-500"
                          placeholder="Ex: Notebook, Tênis..."
                          {...rapidaForm.register("descricao")}
                        />
                      </div>

                      <div className="border-b border-slate-50 dark:border-slate-800 pb-6">
                        <label
                          htmlFor="simulacao-rapida-categoria"
                          className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2"
                        >
                          Categoria
                        </label>
                        <Select
                          name="categoria_rapida"
                          value={rapidaForm.watch("categoria") || ""}
                          onValueChange={(v) => rapidaForm.setValue("categoria", v)}
                        >
                          <SelectTrigger
                            id="simulacao-rapida-categoria"
                            className="h-9 rounded-xl border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white"
                          >
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

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label
                            htmlFor="simulacao-rapida-parcelado"
                            className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest"
                          >
                            Compra Parcelada?
                          </label>
                          <Switch
                            id="simulacao-rapida-parcelado"
                            name="parcelado_rapido"
                            aria-label="Ativar compra parcelada"
                            checked={parcelado}
                            onCheckedChange={(v) => rapidaForm.setValue("parcelado", v)}
                          />
                        </div>
                        <AnimatePresence>
                          {parcelado && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mt-3 space-y-2"
                            >
                              <label
                                htmlFor="simulacao-rapida-parcelas"
                                className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1"
                              >
                                Número de Parcelas
                              </label>
                              <Input
                                id="simulacao-rapida-parcelas"
                                type="number"
                                min={2}
                                max={48}
                                className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white"
                                {...rapidaForm.register("parcelas")}
                              />
                              {(() => {
                                const nParcelas = parseInt(rapidaForm.watch("parcelas") || "1");
                                const valorStr = rapidaForm.watch("valor") || "";
                                const valorNum = parseFloat(valorStr.replace(",", "."));
                                if (nParcelas > 1 && !isNaN(valorNum) && valorNum > 0) {
                                  return (
                                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-50/50 dark:bg-emerald-500/10 px-3 py-2">
                                      <CreditCard className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                        {nParcelas}x de{" "}
                                        <strong>{formatCurrency(valorNum / nParcelas)}</strong>
                                        <span className="text-emerald-600/60 ml-1">
                                          (total: {formatCurrency(valorNum)})
                                        </span>
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 bg-[#0F172A] text-white py-4 rounded-2xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {avaliarGasto.isPending ? (
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                        Processar Análise
                      </button>
                    </motion.form>
                  ) : (
                    /* ── PROJEÇÃO form ── */
                    <motion.form
                      key="form-projecao"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex flex-col gap-6"
                      onSubmit={projecaoForm.handleSubmit(handleProjecao)}
                    >
                      <div className="border-b border-slate-50 dark:border-slate-800 pb-6">
                        <label
                          htmlFor="simulacao-projecao-descricao"
                          className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2"
                        >
                          Descrição
                        </label>
                        <input
                          id="simulacao-projecao-descricao"
                          autoComplete="off"
                          className={`w-full bg-transparent border-none p-0 text-lg serif-italic placeholder:text-slate-300 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:ring-0 outline-none ${projecaoForm.formState.errors.descricao ? "text-red-500" : ""}`}
                          placeholder="Ex: Aquisição de Ativos"
                          {...projecaoForm.register("descricao")}
                        />
                        {projecaoForm.formState.errors.descricao && (
                          <p className="text-xs text-red-500 font-medium mt-1">
                            {projecaoForm.formState.errors.descricao.message}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-6 border-b border-slate-50 dark:border-slate-800 pb-6">
                        <div>
                          <label
                            htmlFor="simulacao-projecao-valor"
                            className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2"
                          >
                            Valor
                          </label>
                          <div className="flex items-baseline gap-1">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                              R$
                            </span>
                            <CurrencyInput
                              id="simulacao-projecao-valor"
                              name="valor_projecao"
                              placeholder="0,00"
                              className={`flex-1 bg-transparent border-none p-0 mono-data text-base font-semibold text-slate-900 dark:text-white focus:ring-0 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-500 ${projecaoForm.formState.errors.valor ? "text-red-500" : ""}`}
                              value={projecaoForm.watch("valor")}
                              onValueChange={(v) =>
                                projecaoForm.setValue("valor", v, {
                                  shouldValidate: projecaoForm.formState.isSubmitted,
                                })
                              }
                            />
                          </div>
                          {projecaoForm.formState.errors.valor && (
                            <p className="text-xs text-red-500 font-medium mt-1">
                              {projecaoForm.formState.errors.valor.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor="simulacao-projecao-pagamento"
                            className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2"
                          >
                            Pagamento
                          </label>
                          <Select
                            name="forma_pagamento_projecao"
                            value={projecaoForm.watch("formaPagamento") || "debito"}
                            onValueChange={(v) => {
                              projecaoForm.setValue(
                                "formaPagamento",
                                v as "pix" | "debito" | "credito"
                              );
                              if (v !== "credito") projecaoForm.setValue("parcelas", 1);
                            }}
                          >
                            <SelectTrigger
                              id="simulacao-projecao-pagamento"
                              className="h-9 rounded-xl border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white"
                            >
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pix">PIX / À Vista</SelectItem>
                              <SelectItem value="debito">Débito</SelectItem>
                              <SelectItem value="credito">Crédito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <AnimatePresence>
                        {formaPagamento === "credito" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex flex-col gap-4 overflow-hidden border-b border-slate-50 dark:border-slate-800 pb-6"
                          >
                            <div>
                              <label
                                htmlFor="simulacao-projecao-parcelas"
                                className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3"
                              >
                                Parcelamento (1–12)
                              </label>
                              <div className="flex items-center gap-4">
                                <input
                                  id="simulacao-projecao-parcelas"
                                  name="parcelas_projecao"
                                  type="range"
                                  min={1}
                                  max={12}
                                  value={parcelas}
                                  onChange={(e) =>
                                    projecaoForm.setValue("parcelas", parseInt(e.target.value))
                                  }
                                  className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                                <span className="text-[10px] mono-data font-bold text-slate-900 dark:text-white">
                                  {String(parcelas).padStart(2, "0")}x
                                </span>
                              </div>
                              {(() => {
                                const valorStr = projecaoForm.watch("valor") || "";
                                const valorNum = parseFloat(valorStr.replace(",", "."));
                                if (parcelas > 1 && !isNaN(valorNum) && valorNum > 0) {
                                  return (
                                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-50/50 dark:bg-emerald-500/10 px-3 py-2 mt-3">
                                      <CreditCard className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                        {parcelas}x de{" "}
                                        <strong>{formatCurrency(valorNum / parcelas)}</strong>
                                        <span className="text-emerald-600/60 ml-1">
                                          (total: {formatCurrency(valorNum)})
                                        </span>
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div>
                              <label
                                htmlFor="simulacao-projecao-cartao"
                                className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2"
                              >
                                Cartão
                              </label>
                              <Select
                                name="cartao_projecao"
                                value={projecaoForm.watch("cartaoId") || ""}
                                onValueChange={(v) => projecaoForm.setValue("cartaoId", v)}
                              >
                                <SelectTrigger
                                  id="simulacao-projecao-cartao"
                                  className="h-9 rounded-xl border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white"
                                >
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

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 bg-[#0F172A] text-white py-4 rounded-2xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {simularMutation.isPending ? (
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <BarChart3 className="h-4 w-4" />
                        )}
                        Processar Projeção
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              {/* Sidebar mini-chart */}
              <AnimatePresence>
                {resultadoSimulacao &&
                  mode === "projecao" &&
                  resultadoSimulacao.meses?.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="exec-card rounded-[2rem] p-6"
                    >
                      <h4 className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                        Resumo da Projeção
                      </h4>
                      <BalanceLineChart data={resultadoSimulacao.meses} />
                    </motion.div>
                  )}
                {resultadoDecisao && mode === "rapida" && isDecisaoRapida(resultadoDecisao) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="exec-card rounded-[2rem] p-6"
                  >
                    <h4 className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                      Orçamento do Mês
                    </h4>
                    <BudgetDonutChart
                      gastoAcumulado={resultadoDecisao.gastoAcumuladoMes}
                      saldoLivre={resultadoDecisao.saldoLivreMes}
                      valorCompra={resultadoDecisao.valorCompra}
                      reservaMetas={resultadoDecisao.reservaMetas}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ═══ RIGHT: Results (8 cols) ═══ */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <AnimatePresence mode="wait">
                {resultadoDecisao && mode === "rapida" && (
                  <motion.div
                    key="rapida-result"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-6"
                  >
                    {isDecisaoRapida(resultadoDecisao) ? (
                      <RapidaResult data={resultadoDecisao} onReset={handleReset} />
                    ) : (
                      <CompletaResult data={resultadoDecisao} onReset={handleReset} />
                    )}
                  </motion.div>
                )}

                {resultadoSimulacao && mode === "projecao" && (
                  <motion.div
                    key="projecao-result"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-6"
                  >
                    <ProjecaoResult
                      data={resultadoSimulacao}
                      showMeses={showMeses}
                      setShowMeses={setShowMeses}
                      riskIcon={riskIcon}
                      onReset={handleReset}
                    />
                  </motion.div>
                )}

                {!hasResult && !isLoading && (
                  <motion.div
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Placeholder: chart mockup + AI panel */}
                    <div className="grid grid-cols-12 gap-6 h-full">
                      <div className="col-span-8 flex flex-col gap-6">
                        <div
                          className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10 flex flex-col"
                          style={{ minHeight: 340 }}
                        >
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mb-2">
                                Simulação de Fluxo de Caixa
                              </h3>
                              <h2 className="text-3xl serif-italic text-slate-900 dark:text-white">
                                {mode === "rapida" ? "Análise Rápida" : "Saldo Projetado"}
                              </h2>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/70 px-5 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                              <Brain className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                              <div>
                                <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                  Aguardando
                                </p>
                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                                  Configure &amp; Processe
                                </p>
                              </div>
                            </div>
                          </div>
                          {/* Placeholder bars */}
                          <div className="flex-1 flex items-end justify-between px-4 pb-4 gap-4 min-h-[160px]">
                            {["Set", "Out", "Nov", "Dez", "Jan", "Fev"].map((m, i) => (
                              <div key={m} className="flex flex-col items-center gap-3 flex-1">
                                <div className="flex items-end gap-1 w-12 h-40 max-h-40">
                                  <div
                                    className="w-5 bg-slate-100 rounded-t-xl"
                                    style={{ height: `${60 + i * 6}%` }}
                                  />
                                  <div
                                    className="w-5 bg-emerald-100 rounded-t-xl"
                                    style={{ height: `${45 + i * 5}%` }}
                                  />
                                </div>
                                <span className="text-[9px] mono-data text-slate-300 uppercase">
                                  {m}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-6 flex items-center gap-8 justify-center border-t border-slate-50 pt-6">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Saldo Atual
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-200" />
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Saldo Projetado
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* How it works steps */}
                        <div className="exec-card rounded-[2rem] p-8">
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-6">
                            Como Funciona
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            {(mode === "rapida"
                              ? [
                                  {
                                    n: 1,
                                    title: "Orçamento",
                                    desc: "Verifica se o valor cabe no saldo livre do mês",
                                  },
                                  {
                                    n: 2,
                                    title: "Histórico",
                                    desc: "Compara com a média de gastos dos últimos 3 meses",
                                  },
                                  {
                                    n: 3,
                                    title: "Tendência",
                                    desc: "Analisa se seus gastos estão subindo ou caindo",
                                  },
                                  {
                                    n: 4,
                                    title: "Saúde Financeira",
                                    desc: "Score de 0 a 100 avaliando sua situação geral",
                                  },
                                ]
                              : [
                                  {
                                    n: 1,
                                    title: "Projeção 12 meses",
                                    desc: "Simula mês a mês como fica seu saldo com a compra",
                                  },
                                  {
                                    n: 2,
                                    title: "Sazonalidade",
                                    desc: "Considera gastos sazonais (IPVA, material escolar, etc.)",
                                  },
                                  {
                                    n: 3,
                                    title: "Impacto em metas",
                                    desc: "Mostra se a compra atrasa suas metas financeiras",
                                  },
                                  {
                                    n: 4,
                                    title: "Cenários",
                                    desc: "Sugere parcelamentos com risco menor",
                                  },
                                ]
                            ).map(({ n, title, desc }) => (
                              <HowItWorksStep key={n} n={n} title={title} desc={desc} />
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-4">
                            Quanto mais dados você cadastrar, mais precisa fica a análise.
                          </p>
                        </div>
                      </div>

                      {/* AI Scenarios panel */}
                      <div className="col-span-4">
                        <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10 flex flex-col h-full">
                          <div className="flex items-start gap-4 mb-6 sm:mb-8">
                            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shrink-0 mt-0.5">
                              <Brain className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                                Ravier
                              </h3>
                              <h2 className="text-lg sm:text-xl font-semibold leading-tight text-slate-900 dark:text-white">
                                Estratégias de compra
                              </h2>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Assim que a análise terminar, a Ravier sugere leituras mais seguras para esta decisão.
                              </p>
                            </div>
                          </div>
                          <div className="space-y-4 flex-1">
                            <div className="p-5 sm:p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[8px] font-bold uppercase tracking-widest rounded-full">
                                  Mais seguro
                                </span>
                                <span className="text-[10px] mono-data font-bold text-emerald-600">
                                  Menor risco
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                A Ravier vai mostrar a opção com melhor equilíbrio entre impacto mensal, folga no caixa e estabilidade ao longo dos próximos meses.
                              </p>
                            </div>
                            <div className="p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 bg-white/70 dark:bg-transparent">
                              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[8px] font-bold uppercase tracking-widest rounded-full">
                                  Suaviza parcelas
                                </span>
                                <span className="text-[10px] mono-data font-bold text-indigo-600">
                                  Menor pressão mensal
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Se parcelar fizer sentido, você verá combinações que reduzem o peso da compra no orçamento sem distorcer sua projeção financeira.
                              </p>
                            </div>
                            <div className="p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 bg-white/70 dark:bg-transparent">
                              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                                <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[8px] font-bold uppercase tracking-widest rounded-full">
                                  Preserva caixa
                                </span>
                                <span className="text-[10px] mono-data font-bold text-amber-600">
                                  Mais liquidez
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Quando houver alternativa melhor, a Ravier destaca caminhos que preservam seu saldo livre e evitam apertos nos meses mais sensíveis.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {isLoading && !hasResult && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-6 sm:p-10 lg:p-12 flex flex-col items-center justify-center text-center min-h-[300px] sm:min-h-[400px]">
                      <div className="h-12 w-12 border-2 border-slate-100 border-t-emerald-600 rounded-full animate-spin mb-6" />
                      <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">
                        Analisando seus dados financeiros...
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          /* ═══ HISTÓRICO TAB ═══ */
          <motion.div
            key="historico"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden">
              <div className="hidden lg:grid p-5 sm:p-8 lg:p-10 border-b border-slate-50 dark:border-slate-800 grid-cols-12 gap-6 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] items-center">
                <div className="col-span-4">Descrição</div>
                <div className="col-span-2">Valor</div>
                <div className="col-span-2">Veredito</div>
                <div className="col-span-2">Folga Mensal</div>
                <div className="col-span-2">Pior Mês</div>
              </div>

              {historico.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  <div className="lg:hidden divide-y divide-slate-50 dark:divide-slate-800">
                    {historico.map((h) => (
                      <div key={`mobile-${h.simulacaoId}`} className="px-5 py-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {h.descricao}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1 uppercase tracking-wider">
                              {h.formaPagamento}
                              {h.numeroParcelas > 1 && ` • ${h.numeroParcelas}x`}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-bold border uppercase tracking-widest shrink-0 ${riskColor(h.risco).badge} ${riskColor(h.risco).border}`}
                          >
                            {h.risco}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 px-3 py-3">
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                              Valor
                            </p>
                            <p className="text-sm mono-data font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(h.valor)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 px-3 py-3">
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                              Folga mensal
                            </p>
                            <p className="text-sm mono-data font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(h.folgaMensalMedia)}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 px-3 py-3">
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                            Pior mês
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{h.piorMes}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {historico.map((h) => (
                    <div
                      key={h.simulacaoId}
                      className="hidden lg:grid grid-cols-12 gap-6 px-5 sm:px-8 lg:px-10 py-5 sm:py-8 items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group"
                    >
                      <div className="col-span-4">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {h.descricao}
                        </span>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                          {h.formaPagamento}
                          {h.numeroParcelas > 1 && ` • ${h.numeroParcelas}x`}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm mono-data font-medium text-slate-900 dark:text-white">
                          {formatCurrency(h.valor)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-bold border uppercase tracking-widest ${riskColor(h.risco).badge} ${riskColor(h.risco).border}`}
                        >
                          {h.risco}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm mono-data font-medium text-slate-900 dark:text-white">
                          {formatCurrency(h.folgaMensalMedia)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {h.piorMes}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 sm:p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/70 flex items-center justify-center mb-4">
                    <History className="h-5 w-5 text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    Nenhuma simulação no histórico
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Faça sua primeira projeção para ver o histórico aqui
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Sub-Components
   ════════════════════════════════════════════════════════════ */

function HowItWorksStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-600/10 text-emerald-600 text-[10px] font-bold">
        {n}
      </span>
      <span>
        <strong className="text-slate-700 dark:text-slate-300">{title}</strong> — {desc}
      </span>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500";
  const bgColor = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  const label = score >= 70 ? "Saudável" : score >= 40 ? "Atenção" : "Crítico";

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-slate-200 dark:text-slate-700"
          />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            strokeWidth="3"
            strokeDasharray={`${(score / 100) * 88} 88`}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${color}`}
        >
          {score}
        </span>
      </div>
      <div>
        <span className={`text-xs font-semibold ${color}`}>{label}</span>
        <div className="flex items-center gap-1 mt-0.5">
          <div className={`h-1.5 w-1.5 rounded-full ${bgColor}`} />
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Saúde Financeira</span>
        </div>
      </div>
    </div>
  );
}

/* ── Resultado Rápido ── */

function RapidaResult({ data, onReset }: { data: DecisaoGastoResult; onReset: () => void }) {
  const [layersOpen, setLayersOpen] = useState(false);
  const config = parecerConfig(data.parecer);
  const percentualUsado =
    data.receitaPrevistoMes > 0 ? (data.gastoAcumuladoMes / data.receitaPrevistoMes) * 100 : 0;

  return (
    <>
      {/* Verdict Hero Card */}
      <div className="glass-panel p-1 rounded-2xl flex flex-col md:flex-row overflow-hidden min-h-[160px]">
        {/* Left: verdict badge */}
        <div
          className={`bg-linear-to-br ${config.heroGradient} p-6 flex flex-col justify-center items-center w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700/50 relative overflow-hidden`}
        >
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
            Veredito IA
          </span>
          <div className="flex items-center gap-2 mb-1">
            <span className={config.heroIcon}>{config.icon}</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white">
              {config.label}
            </h2>
          </div>
          {data.scoreSaudeFinanceira != null && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Score: {data.scoreSaudeFinanceira}/100
            </p>
          )}
        </div>

        {/* Right: structured data */}
        <div className="p-6 flex-1 flex flex-col justify-center gap-4">
          {/* Verdict headline */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-emerald-600/10 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-white text-sm">
                {data.parecer === "pode"
                  ? "Aprovado"
                  : data.parecer === "cautela"
                    ? "Aprovado com ressalva"
                    : "Não recomendado"}
                {" — "}
                <span className="font-normal text-slate-500 dark:text-slate-400">
                  {formatCurrency(data.valorCompra)}
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.parecer === "pode"
                  ? "Baixo impacto no orçamento"
                  : data.parecer === "cautela"
                    ? `Consome ${data.percentualSaldoLivre.toFixed(0)}% do saldo disponível`
                    : data.saldoLivreMes <= 0
                      ? `Saldo livre negativo (${formatCurrency(data.saldoLivreMes)})`
                      : `Consumiria ${data.percentualSaldoLivre.toFixed(0)}% do saldo restante`}
              </p>
            </div>
          </div>

          {/* Key metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/40 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                Gastos no mês
              </p>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">
                {formatCurrency(data.gastoAcumuladoMes)}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                de {formatCurrency(data.receitaPrevistoMes)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/40 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                Disponível
              </p>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">
                {formatCurrency(data.saldoLivreMes)}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                para {data.diasRestantesMes} dias
              </p>
            </div>
            {data.variacaoVsMediaHistorica != null && data.variacaoVsMediaHistorica !== 0 && (
              <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/40 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                  Vs média
                </p>
                <p
                  className={`text-sm font-bold ${data.variacaoVsMediaHistorica > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  {data.variacaoVsMediaHistorica > 0 ? "+" : ""}
                  {data.variacaoVsMediaHistorica.toFixed(1)}%
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">últimos 3 meses</p>
              </div>
            )}
            {data.parecer === "cautela" && data.diasRestantesMes > 0 && (
              <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/40 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                  Estimativa/dia
                </p>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">
                  ~
                  {formatCurrency(
                    (data.saldoLivreMes - data.valorCompra) / Math.max(1, data.diasRestantesMes)
                  )}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">após a compra</p>
              </div>
            )}
          </div>

          {/* Impact on goals (inline summary) */}
          {data.impactoMetas && data.impactoMetas.some((m) => m.mesesAtraso > 0) && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 px-3 py-2">
              <Target className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Impacto em metas
                </p>
                {data.impactoMetas
                  .filter((m) => m.mesesAtraso > 0)
                  .map((meta) => (
                    <p key={meta.nomeMeta} className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-medium">{meta.nomeMeta}</span>
                      {" — atrasa ~"}
                      {meta.mesesAtraso} {meta.mesesAtraso === 1 ? "mês" : "meses"}
                      <span className="text-slate-400 dark:text-slate-500">
                        {" "}
                        (de {formatCurrency(meta.valorMensalNecessarioAntes)}/mês para{" "}
                        {formatCurrency(meta.valorMensalNecessarioDepois)}/mês)
                      </span>
                    </p>
                  ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {data.parecer !== "pode" && (
            <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-700/50">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
                Ações:
              </span>
              <button
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Nova análise
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          label="Comprometimento"
          value={`${percentualUsado.toFixed(0)}%`}
          icon={<TrendingDown className="h-4 w-4 text-red-400" />}
          subtitle={
            percentualUsado > 80
              ? "Acima do limite seguro"
              : percentualUsado > 60
                ? "Fique atento"
                : "Dentro do ideal"
          }
          color={percentualUsado > 80 ? "red" : percentualUsado > 60 ? "amber" : "emerald"}
          progress={Math.min(percentualUsado, 100)}
        />
        <div className="glass-panel p-5 rounded-2xl flex flex-col items-center justify-center relative">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-3">
            Score de Impacto
          </p>
          {data.scoreSaudeFinanceira != null ? (
            <ScoreGauge score={data.scoreSaudeFinanceira} />
          ) : (
            <p className="text-sm text-slate-400">Indisponível</p>
          )}
        </div>
        <MetricCard
          label="Saldo Livre"
          value={formatCurrency(data.saldoLivreMes)}
          icon={<Wallet className="h-4 w-4 text-emerald-600" />}
          subtitle={`${data.diasRestantesMes} dias restantes no mês`}
          color="blue"
        />
      </div>

      {/* 4-Layer Analysis (collapsible) */}
      {data.camadas && data.camadas.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <button
            onClick={() => setLayersOpen(!layersOpen)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-800 dark:text-white">
                Como analisamos
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({data.camadas.length} camadas)
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${layersOpen ? "rotate-180" : ""}`}
            />
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
                <div className="px-5 pb-5 space-y-3">
                  {data.camadas.map((camada, i) => {
                    const layerConfig = parecerConfig(camada.parecer);
                    return (
                      <motion.div
                        key={camada.camada}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-700/40"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${layerConfig.bg} ${layerConfig.color}`}
                        >
                          {camadaIconMap[camada.camada] ?? <Info className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-slate-800 dark:text-white">
                              {camadaLabelMap[camada.camada] ?? camada.camada}
                            </span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${layerConfig.badgeCls}`}>
                              {layerConfig.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {camadaDescMap[camada.camada] ?? ""}
                          </p>
                          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
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

      {/* Goal Impact */}
      {data.impactoMetas && data.impactoMetas.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Impacto nas Metas
            </span>
          </div>
          <div className="space-y-3">
            {data.impactoMetas.map((meta) => (
              <div
                key={meta.nomeMeta}
                className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-700/40 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {meta.nomeMeta}
                  </span>
                  {meta.mesesAtraso > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      +{meta.mesesAtraso} {meta.mesesAtraso === 1 ? "mês" : "meses"} de atraso
                    </Badge>
                  )}
                </div>
                {meta.descricao && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{meta.descricao}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert Limit */}
      {data.alertaLimite && (
        <div className="glass-panel px-5 py-4 rounded-2xl flex items-center gap-3 border-amber-200 dark:border-amber-800">
          <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-400">{data.alertaLimite}</span>
        </div>
      )}

      {/* Tip */}
      <div className="glass-panel p-4 rounded-2xl flex items-start gap-3">
        <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-300">Dica:</strong> Quanto mais
          lançamentos você cadastrar, mais precisa fica a análise. O sistema usa seus dados reais
          dos últimos 3 meses.
        </p>
      </div>
    </>
  );
}

/* ── Resultado Completo (IA text) ── */

function CompletaResult({ data, onReset }: { data: DecisaoCompletaResult; onReset: () => void }) {
  return (
    <div className="glass-panel p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">Análise Completa</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Avaliação detalhada da IA</p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Nova
        </button>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {data.analise}
      </div>
    </div>
  );
}

/* ── Resultado Projeção (12 meses) ── */

function ProjecaoResult({
  data,
  showMeses,
  setShowMeses,
  riskIcon,
  onReset,
}: {
  data: SimulacaoResultado;
  showMeses: boolean;
  setShowMeses: (v: boolean) => void;
  riskIcon: (risk: string) => React.ReactNode;
  onReset: () => void;
}) {
  return (
    <>
      {/* Verdict Hero */}
      <div className="glass-panel p-1 rounded-2xl flex flex-col md:flex-row overflow-hidden min-h-[160px]">
        <div
          className={`bg-linear-to-br ${riskColor(data.risco).bg} p-6 flex flex-col justify-center items-center w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700/50 relative overflow-hidden`}
        >
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
            Veredito IA
          </span>
          <div className="flex items-center gap-2 mb-1">
            <span className={riskColor(data.risco).badge}>{riskIcon(data.risco)}</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white">
              {data.risco}
            </h2>
          </div>
          <Badge className={riskColor(data.risco).badge}>{data.confianca}</Badge>
        </div>
        <div className="p-6 flex-1 flex flex-col justify-center gap-3">
          {/* Structured recommendation */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-emerald-600/10 flex items-center justify-center shrink-0">
              <Brain className="h-4 w-4 text-emerald-600" />
            </div>
            <h4 className="font-semibold text-slate-800 dark:text-white text-sm">
              Recomendação da IA
            </h4>
          </div>

          {/* Recommendation as structured paragraphs */}
          <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            {data.recomendacao
              .split(/\n+/)
              .filter(Boolean)
              .map((line, i) => (
                <p key={i} className="leading-relaxed">
                  {line.trim()}
                </p>
              ))}
          </div>

          {/* Key projection metrics inline */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
            <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/40 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                Pior mês
              </p>
              <p className="text-sm font-bold text-slate-800 dark:text-white">{data.piorMes}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                saldo: {formatCurrency(data.menorSaldoProjetado)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/40 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                Folga média
              </p>
              <p
                className={`text-sm font-bold ${data.folgaMensalMedia >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              >
                {formatCurrency(data.folgaMensalMedia)}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {data.folgaMensalMedia >= 0 ? "positiva" : "negativa"}
              </p>
            </div>
            {data.scoreSaudeFinanceira != null && (
              <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/40 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                  Saúde
                </p>
                <p
                  className={`text-sm font-bold ${data.scoreSaudeFinanceira >= 70 ? "text-emerald-600 dark:text-emerald-400" : data.scoreSaudeFinanceira >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {data.scoreSaudeFinanceira}/100
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {data.scoreSaudeFinanceira >= 70
                    ? "saudável"
                    : data.scoreSaudeFinanceira >= 40
                      ? "atenção"
                      : "crítico"}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-700/50">
            <span className="text-xs font-bold text-slate-400 uppercase">Ações:</span>
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Nova simulação
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          label="Pior Mês Projetado"
          value={data.piorMes}
          icon={<TrendingDown className="h-4 w-4 text-red-400" />}
          subtitle={`Saldo: ${formatCurrency(data.menorSaldoProjetado)}`}
          color="red"
        />
        <MetricCard
          label="Folga Mensal Média"
          value={formatCurrency(data.folgaMensalMedia)}
          icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
          subtitle={data.folgaMensalMedia >= 0 ? "Positiva" : "Negativa"}
          color={data.folgaMensalMedia >= 0 ? "emerald" : "red"}
        />
        {data.scoreSaudeFinanceira != null && (
          <div className="glass-panel p-5 rounded-2xl flex flex-col items-center justify-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-3">
              Saúde Financeira
            </p>
            <ScoreGauge score={data.scoreSaudeFinanceira} />
          </div>
        )}
      </div>

      {/* Alternative scenarios */}
      {data.cenariosAlternativos && data.cenariosAlternativos.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
            Estratégias recomendadas pela Ravier
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.cenariosAlternativos.map((c) => (
              <div
                key={c.numeroParcelas}
                className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">
                    {c.numeroParcelas}x
                  </span>
                  <Badge className={riskColor(c.risco).badge} variant="secondary">
                    {c.risco}
                  </Badge>
                </div>
                <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-white">
                  {formatCurrency(c.valorParcela)}
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    /mês
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Menor saldo: {formatCurrency(c.menorSaldoProjetado)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projection Chart */}
      {data.meses && data.meses.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Saúde Financeira Projetada
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Fluxo de caixa previsto para os próximos meses com esta compra
              </p>
            </div>
          </div>
          <ProjectionChart data={data.meses} />
        </div>
      )}

      {/* Receita vs Despesas bar chart + Impacto % area chart side-by-side */}
      {data.meses && data.meses.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Monthly comparison — takes more space */}
          <div className="xl:col-span-3 glass-panel p-6 rounded-2xl">
            <div className="mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Receita vs Despesas
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Comparativo mensal entre receita e total de gastos
              </p>
            </div>
            <MonthlyCompositionChart data={data.meses} />
          </div>

          {/* Impact percent — smaller companion */}
          <div className="xl:col-span-2 glass-panel p-6 rounded-2xl flex flex-col">
            <div className="mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Impacto na Receita
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Percentual da receita comprometido pela compra
              </p>
            </div>
            <div className="flex-1 flex items-center">
              <div className="w-full">
                <ImpactPercentChart data={data.meses} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scenarios Compare Chart */}
      {data.cenariosAlternativos && data.cenariosAlternativos.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl">
          <div className="mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Comparativo de Parcelamento
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Menor saldo projetado por opção — barras maiores significam mais segurança financeira
            </p>
          </div>
          <ScenariosCompareChart
            data={data.cenariosAlternativos}
            selectedParcelas={data.numeroParcelas}
          />
        </div>
      )}

      {/* Monthly Table (collapsible) */}
      {data.meses && data.meses.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowMeses(!showMeses)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Projeção Mensal ({data.meses.length} meses)
            </h3>
            {showMeses ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          <AnimatePresence>
            {showMeses && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-auto border-t border-slate-200 dark:border-slate-700/50"
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                      <th className="py-3 px-5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Mês
                      </th>
                      <th className="py-3 px-5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Saldo Base
                      </th>
                      <th className="py-3 px-5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Impacto
                      </th>
                      <th className="py-3 px-5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Saldo Final
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                    {data.meses.map((m) => (
                      <tr
                        key={m.mes}
                        className={
                          m.saldoComCompra < 0
                            ? "bg-red-50/50 dark:bg-red-950/10"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                        }
                      >
                        <td className="py-2.5 px-5 font-medium text-slate-700 dark:text-slate-200">
                          {formatMonth(m.mes)}
                        </td>
                        <td className="py-2.5 px-5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {formatCurrency(m.saldoBase)}
                        </td>
                        <td className="py-2.5 px-5 text-right tabular-nums text-red-600 dark:text-red-400">
                          {m.impactoCompra > 0 ? `-${formatCurrency(m.impactoCompra)}` : "-"}
                        </td>
                        <td
                          className={`py-2.5 px-5 text-right font-bold tabular-nums ${
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
      )}

      {/* Goal Impact */}
      {data.impactoMetas && data.impactoMetas.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
            Impacto nas Metas
          </h3>
          <div className="space-y-3">
            {data.impactoMetas.map((meta) => (
              <div
                key={meta.nomeMeta}
                className="rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/20"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {meta.nomeMeta}
                    </span>
                  </div>
                  {meta.mesesAtraso > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      +{meta.mesesAtraso} {meta.mesesAtraso === 1 ? "mês" : "meses"} de atraso
                    </Badge>
                  )}
                </div>
                {meta.descricao && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{meta.descricao}</p>
                )}
                {meta.valorMensalNecessarioAntes > 0 &&
                  meta.valorMensalNecessarioDepois > meta.valorMensalNecessarioAntes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Parcela mensal: {formatCurrency(meta.valorMensalNecessarioAntes)} →{" "}
                      {formatCurrency(meta.valorMensalNecessarioDepois)}
                    </p>
                  )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seasonal events */}
      {data.eventosSazonaisConsiderados && data.eventosSazonaisConsiderados.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
            Eventos Sazonais Considerados
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.eventosSazonaisConsiderados.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700/50 px-3 py-2 bg-slate-50/50 dark:bg-slate-800/20"
              >
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {ev.descricao}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {ev.ehReceita ? "+" : "-"}
                  {formatCurrency(ev.valorMedio)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tip */}
      <div className="glass-panel p-4 rounded-2xl flex items-start gap-3">
        <Activity className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-300">Dica:</strong> Quanto mais
          lançamentos você cadastrar, mais precisa fica a simulação. As projeções usam dados reais e
          consideram sazonalidades detectadas automaticamente.
        </p>
      </div>
    </>
  );
}

/* ── Metric Card ── */

function MetricCard({
  label,
  value,
  icon,
  subtitle,
  color,
  progress,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtitle: string;
  color: "red" | "amber" | "emerald" | "blue";
  progress?: number;
}) {
  const bgCorner = {
    red: "bg-red-50 dark:bg-red-950/20",
    amber: "bg-amber-50 dark:bg-amber-950/20",
    emerald: "bg-emerald-50 dark:bg-emerald-950/20",
    blue: "bg-emerald-50 dark:bg-emerald-950/20",
  }[color];

  const progressColor = {
    red: "bg-red-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    blue: "bg-emerald-600",
  }[color];

  return (
    <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group hover:shadow-lg transition-all">
      <div
        className={`absolute right-0 top-0 w-24 h-24 ${bgCorner} rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
            {label}
          </p>
          {icon}
        </div>
        <h4 className="text-2xl font-bold text-slate-800 dark:text-white">{value}</h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">{subtitle}</p>
      </div>
      {progress != null && (
        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mt-4 overflow-hidden">
          <div
            className={`${progressColor} h-1.5 rounded-full transition-all`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
