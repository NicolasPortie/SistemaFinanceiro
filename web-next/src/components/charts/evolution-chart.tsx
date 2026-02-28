"use client";

import { formatCurrency } from "@/lib/format";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

interface EvolutionData {
  mes: string;
  receitas: number;
  gastos: number;
  saldo: number;
}

interface EvolutionChartProps {
  data: EvolutionData[];
}

export function EvolutionChart({ data }: EvolutionChartProps) {
  if (!data || data.length < 2) return null;

  const chartData = data.map((d) => {
    const parts = d.mes.split("-");
    const monthIdx = parseInt(parts[1]) - 1;
    const yearShort = parts[0].slice(2);
    return {
      label: `${MESES_CURTOS[monthIdx]}/${yearShort}`,
      Receitas: d.receitas,
      Gastos: d.gastos,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradEvoReceitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradEvoGastos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" opacity={0.4} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => {
            if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
            return v.toFixed(0);
          }}
          tick={{ fontSize: 11, fill: "oklch(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name)]}
          contentStyle={{
            backgroundColor: "oklch(var(--popover))",
            border: "1px solid oklch(var(--border))",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
            color: "oklch(var(--foreground))",
          }}
        />
        <Area
          type="monotone"
          dataKey="Receitas"
          stroke="#10b981"
          fill="url(#gradEvoReceitas)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
          activeDot={{ r: 5, stroke: "#10b981", strokeWidth: 2, fill: "white" }}
        />
        <Area
          type="monotone"
          dataKey="Gastos"
          stroke="#ef4444"
          fill="url(#gradEvoGastos)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
          activeDot={{ r: 5, stroke: "#ef4444", strokeWidth: 2, fill: "white" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
