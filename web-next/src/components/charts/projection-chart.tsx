"use client";

import { formatCurrency, formatMonth } from "@/lib/format";
import type { SimulacaoMes } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ProjectionChartProps {
  data: SimulacaoMes[];
}

export function ProjectionChart({ data }: ProjectionChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((m) => ({
    mes: formatMonth(m.mes),
    saldoBase: m.saldoBase,
    saldoComCompra: m.saldoComCompra,
    impacto: m.impactoCompra,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.696 0.17 162.48)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="oklch(0.696 0.17 162.48)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCompra" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.637 0.237 25.331)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="oklch(0.637 0.237 25.331)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" opacity={0.5} />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 12, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v)}
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            name === "saldoBase" ? "Saldo Base" : "Com Compra",
          ]}
          contentStyle={{
            backgroundColor: "oklch(var(--popover))",
            border: "1px solid oklch(var(--border))",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
            color: "oklch(var(--foreground))",
          }}
        />
        <ReferenceLine y={0} stroke="oklch(var(--muted-foreground))" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="saldoBase"
          stroke="oklch(0.696 0.17 162.48)"
          fill="url(#colorBase)"
          strokeWidth={2}
          name="Saldo Base"
        />
        <Area
          type="monotone"
          dataKey="saldoComCompra"
          stroke="oklch(0.637 0.237 25.331)"
          fill="url(#colorCompra)"
          strokeWidth={2}
          name="Com Compra"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
