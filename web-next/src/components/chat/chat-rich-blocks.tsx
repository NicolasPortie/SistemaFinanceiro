"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Receipt,
  Target,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// ── Types ──

export interface RichContent {
  texto: string;
  blocos: RichBloco[];
}

interface RichBloco {
  tipo: string;
  titulo?: string;
  subtitulo?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: Record<string, any>;
}

interface DadosResumo {
  receitas: number;
  gastos: number;
  saldo: number;
  comprometido?: number;
  saldoAcumulado?: number;
}

interface ItemGraficoPizza {
  nome: string;
  valor: number;
  percentual: number;
}

interface ItemGraficoBarras {
  mes: string;
  receitas: number;
  gastos: number;
}

interface ItemTransacao {
  descricao: string;
  valor: number;
  data: string;
  categoria?: string;
  tipo: string;
  formaPagamento?: string;
  parcela?: string;
}

interface ItemProgresso {
  nome: string;
  atual: number;
  limite: number;
  percentual: number;
  status: string;
  info?: string;
}

interface DadosComparativo {
  mesAtual: string;
  mesAnterior: string;
  gastosAtual: number;
  gastosAnterior: number;
  receitasAtual: number;
  receitasAnterior: number;
  variacaoGastosPercent: number;
  categoriasMudaram: { categoria: string; diferenca: number; atual: number; anterior: number }[];
}

interface DadosFatura {
  cartao: string;
  mesReferencia: string;
  total: number;
  limite?: number;
  status: string;
  dataVencimento?: string;
  itens: ItemTransacao[];
}

// ── Colors ──

const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#f97316",
  "#6366f1",
  "#14b8a6",
];

// ── Helpers ──

export function isRichContent(conteudo: string): boolean {
  if (!conteudo || conteudo[0] !== "{") return false;
  try {
    const parsed = JSON.parse(conteudo);
    return "texto" in parsed && "blocos" in parsed;
  } catch {
    return false;
  }
}

export function parseRichContent(conteudo: string): RichContent {
  return JSON.parse(conteudo);
}

// ── Main Component ──

export function ChatRichBlocks({ content }: { content: RichContent }) {
  return (
    <div className="space-y-3">
      {content.texto && (
        <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-strong:text-emerald-600 dark:prose-strong:text-emerald-400 max-w-none">
          <ReactMarkdown>{content.texto}</ReactMarkdown>
        </div>
      )}
      {content.blocos.map((bloco, idx) => (
        <RichBlocoRenderer key={idx} bloco={bloco} />
      ))}
    </div>
  );
}

function RichBlocoRenderer({ bloco }: { bloco: RichBloco }) {
  switch (bloco.tipo) {
    case "resumo":
      return <SummaryCards dados={bloco.dados as DadosResumo} />;
    case "grafico_pizza":
      return <PieChartBlock titulo={bloco.titulo} dados={bloco.dados as { itens: ItemGraficoPizza[] }} />;
    case "grafico_barras":
      return <BarChartBlock titulo={bloco.titulo} dados={bloco.dados as { itens: ItemGraficoBarras[] }} />;
    case "lista_transacoes":
      return (
        <TransactionList
          titulo={bloco.titulo}
          subtitulo={bloco.subtitulo}
          dados={bloco.dados as { itens: ItemTransacao[]; totalItens: number }}
        />
      );
    case "progresso":
      return <ProgressBars titulo={bloco.titulo} dados={bloco.dados as { itens: ItemProgresso[] }} />;
    case "comparativo":
      return <ComparativoBlock titulo={bloco.titulo} dados={bloco.dados as DadosComparativo} />;
    case "fatura":
      return (
        <FaturaBlock
          titulo={bloco.titulo}
          subtitulo={bloco.subtitulo}
          dados={bloco.dados as DadosFatura}
        />
      );
    default:
      return null;
  }
}

// ── Summary Cards ──

function SummaryCards({ dados }: { dados: DadosResumo }) {
  const cards = [
    {
      label: "Receitas",
      value: dados.receitas,
      icon: ArrowUpCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Gastos",
      value: dados.gastos,
      icon: ArrowDownCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Saldo",
      value: dados.saldo,
      icon: Wallet,
      color: dados.saldo >= 0 ? "text-emerald-500" : "text-red-500",
      bg: dados.saldo >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "Comprometido",
      value: dados.comprometido ?? 0,
      icon: CreditCard,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      isPercentage:
        dados.comprometido != null && dados.receitas > 0
          ? (dados.gastos / dados.receitas) * 100
          : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl bg-white/50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] p-3"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className={cn("rounded-lg p-1", card.bg)}>
              <card.icon className={cn("size-3.5", card.color)} />
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {card.label}
            </span>
          </div>
          <p className={cn("text-sm font-bold tabular-nums", card.color)}>
            {formatCurrency(card.value)}
          </p>
          {card.isPercentage !== undefined && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {card.isPercentage.toFixed(0)}% da renda
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Pie Chart Block ──

function PieChartBlock({
  titulo,
  dados,
}: {
  titulo?: string;
  dados: { itens: ItemGraficoPizza[] };
}) {
  if (!dados.itens?.length) return null;

  const total = dados.itens.reduce((s, i) => s + i.valor, 0);
  const chartData = dados.itens.map((item, i) => ({
    name: item.nome,
    value: item.valor,
    percentual: item.percentual,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="rounded-xl bg-white/50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] p-3">
      {titulo && (
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          {titulo}
        </p>
      )}
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={2}
              strokeWidth={0}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} opacity={0.92} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0];
                return (
                  <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 shadow-lg text-xs">
                    <p className="font-semibold">{item.name}</p>
                    <p className="tabular-nums font-bold">
                      {formatCurrency(item.value as number)}
                    </p>
                    <p className="text-muted-foreground">
                      {((item.payload as Record<string, unknown>)?.percentual as number)?.toFixed(1)}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Total
          </p>
          <p className="text-sm font-extrabold tabular-nums text-foreground leading-tight">
            {formatCurrency(total)}
          </p>
        </div>
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
        {dados.itens.slice(0, 8).map((item, i) => (
          <div key={item.nome} className="flex items-center gap-1.5 min-w-0">
            <div
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
              {item.nome}
            </span>
            <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400 ml-auto shrink-0">
              {item.percentual.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bar Chart Block ──

function BarChartBlock({
  titulo,
  dados,
}: {
  titulo?: string;
  dados: { itens: ItemGraficoBarras[] };
}) {
  if (!dados.itens?.length) return null;

  return (
    <div className="rounded-xl bg-white/50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] p-3">
      {titulo && (
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          {titulo}
        </p>
      )}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={dados.itens} barGap={2}>
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "oklch(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            width={35}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 shadow-lg text-xs">
                  <p className="font-semibold mb-1">{label}</p>
                  {payload.map((item) => (
                    <p key={item.name} className="tabular-nums">
                      <span
                        className="inline-block size-2 rounded-full mr-1.5"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name === "receitas" ? "Receitas" : "Gastos"}:{" "}
                      <span className="font-bold">
                        {formatCurrency(item.value as number)}
                      </span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            formatter={(value) => (
              <span className="text-[10px] text-muted-foreground">
                {value === "receitas" ? "Receitas" : "Gastos"}
              </span>
            )}
            iconSize={8}
            wrapperStyle={{ fontSize: 10 }}
          />
          <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Transaction List (Expandable) ──

function TransactionList({
  titulo,
  subtitulo,
  dados,
}: {
  titulo?: string;
  subtitulo?: string;
  dados: { itens: ItemTransacao[]; totalItens: number };
}) {
  const [expanded, setExpanded] = useState(false);
  if (!dados.itens?.length) return null;

  const visibleItems = expanded ? dados.itens : dados.itens.slice(0, 5);
  const hasMore = dados.itens.length > 5;

  return (
    <div className="rounded-xl bg-white/50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => hasMore && setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-between p-3",
          hasMore && "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
        )}
      >
        <div className="flex items-center gap-2">
          <Receipt className="size-3.5 text-slate-400" />
          <div className="text-left">
            {titulo && (
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {titulo}
              </p>
            )}
            {subtitulo && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {subtitulo}
              </p>
            )}
          </div>
        </div>
        {hasMore && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {expanded ? "Recolher" : `Ver todos (${dados.itens.length})`}
            {expanded ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </div>
        )}
      </button>

      {/* Items */}
      <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
        {visibleItems.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  item.tipo === "receita" ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              <div className="min-w-0">
                <p className="font-medium text-slate-700 dark:text-slate-300 truncate">
                  {item.descricao}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                  <span>{item.data}</span>
                  {item.categoria && (
                    <>
                      <span>•</span>
                      <span>{item.categoria}</span>
                    </>
                  )}
                  {item.formaPagamento && (
                    <>
                      <span>•</span>
                      <span>{item.formaPagamento}</span>
                    </>
                  )}
                  {item.parcela && (
                    <>
                      <span>•</span>
                      <span>{item.parcela}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <span
              className={cn(
                "font-bold tabular-nums shrink-0 ml-2",
                item.tipo === "receita"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {item.tipo === "receita" ? "+" : "-"} {formatCurrency(item.valor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Progress Bars ──

function ProgressBars({
  titulo,
  dados,
}: {
  titulo?: string;
  dados: { itens: ItemProgresso[] };
}) {
  if (!dados.itens?.length) return null;

  const statusColor = (status: string) => {
    switch (status) {
      case "ok":
      case "em_progresso":
        return "bg-emerald-500";
      case "atencao":
        return "bg-amber-500";
      case "critico":
      case "excedido":
        return "bg-red-500";
      default:
        return "bg-emerald-500";
    }
  };

  const statusTextColor = (status: string) => {
    switch (status) {
      case "ok":
      case "em_progresso":
        return "text-emerald-600 dark:text-emerald-400";
      case "atencao":
        return "text-amber-600 dark:text-amber-400";
      case "critico":
      case "excedido":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-emerald-600 dark:text-emerald-400";
    }
  };

  return (
    <div className="rounded-xl bg-white/50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] p-3">
      {titulo && (
        <div className="flex items-center gap-2 mb-3">
          <Target className="size-3.5 text-slate-400" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {titulo}
          </p>
        </div>
      )}
      <div className="space-y-3">
        {dados.itens.map((item) => (
          <div key={item.nome}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                {item.nome}
              </span>
              <span className={cn("text-[10px] font-bold tabular-nums", statusTextColor(item.status))}>
                {formatCurrency(item.atual)} / {formatCurrency(item.limite)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", statusColor(item.status))}
                style={{ width: `${Math.min(item.percentual, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className={cn("text-[10px] font-medium tabular-nums", statusTextColor(item.status))}>
                {item.percentual.toFixed(0)}%
              </span>
              {item.info && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {item.info}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Comparativo Block ──

function ComparativoBlock({
  titulo,
  dados,
}: {
  titulo?: string;
  dados: DadosComparativo;
}) {
  const variacaoGastos = dados.gastosAtual - dados.gastosAnterior;
  const gastosSubiram = variacaoGastos > 0;

  return (
    <div className="rounded-xl bg-white/50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] p-3 space-y-3">
      {titulo && (
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {titulo}
        </p>
      )}

      {/* Comparison cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
            {dados.mesAnterior}
          </p>
          <p className="text-xs font-bold text-red-600 dark:text-red-400 tabular-nums">
            {formatCurrency(dados.gastosAnterior)}
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(dados.receitasAnterior)}
          </p>
        </div>
        <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
            {dados.mesAtual}
          </p>
          <p className="text-xs font-bold text-red-600 dark:text-red-400 tabular-nums">
            {formatCurrency(dados.gastosAtual)}
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(dados.receitasAtual)}
          </p>
        </div>
      </div>

      {/* Variation badge */}
      <div className="flex items-center justify-center">
        <div
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold",
            gastosSubiram
              ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}
        >
          {gastosSubiram ? (
            <TrendingUp className="size-3" />
          ) : (
            <TrendingDown className="size-3" />
          )}
          {gastosSubiram ? "+" : ""}
          {dados.variacaoGastosPercent.toFixed(1)}% nos gastos
        </div>
      </div>

      {/* Categories that changed */}
      {dados.categoriasMudaram?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
            Categorias que mais mudaram
          </p>
          <div className="space-y-1">
            {dados.categoriasMudaram.map((cat) => (
              <div
                key={cat.categoria}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-slate-600 dark:text-slate-400">
                  {cat.categoria}
                </span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    cat.diferenca > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {cat.diferenca > 0 ? "+" : ""}
                  {formatCurrency(cat.diferenca)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fatura Block ──

function FaturaBlock({
  titulo,
  subtitulo,
  dados,
}: {
  titulo?: string;
  subtitulo?: string;
  dados: DadosFatura;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? dados.itens : dados.itens.slice(0, 5);
  const hasMore = dados.itens.length > 5;

  const usagePercent = dados.limite ? (dados.total / dados.limite) * 100 : 0;

  return (
    <div className="rounded-xl bg-white/50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-100 dark:border-white/[0.04]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <CreditCard className="size-3.5 text-violet-500" />
            {titulo && (
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {titulo}
              </p>
            )}
          </div>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              dados.status === "Aberta"
                ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : dados.status === "Fechada"
                  ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-slate-100 dark:bg-white/[0.06] text-slate-500"
            )}
          >
            {dados.status}
          </span>
        </div>
        {subtitulo && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {subtitulo}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <p className="text-lg font-bold text-slate-800 dark:text-slate-200 tabular-nums">
            {formatCurrency(dados.total)}
          </p>
          {dados.limite && dados.limite > 0 && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              de {formatCurrency(dados.limite)}
            </p>
          )}
        </div>
        {dados.limite && dados.limite > 0 && (
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden mt-1.5">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                usagePercent > 90
                  ? "bg-red-500"
                  : usagePercent > 70
                    ? "bg-amber-500"
                    : "bg-violet-500"
              )}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Fatura items */}
      {dados.itens.length > 0 && (
        <>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {visibleItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-700 dark:text-slate-300 truncate">
                    {item.descricao}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                    <span>{item.data}</span>
                    {item.categoria && (
                      <>
                        <span>•</span>
                        <span>{item.categoria}</span>
                      </>
                    )}
                    {item.parcela && (
                      <>
                        <span>•</span>
                        <span>{item.parcela}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="font-bold tabular-nums text-red-600 dark:text-red-400 shrink-0 ml-2">
                  {formatCurrency(item.valor)}
                </span>
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors flex items-center justify-center gap-1"
            >
              {expanded ? "Recolher" : `Ver todos (${dados.itens.length})`}
              {expanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
