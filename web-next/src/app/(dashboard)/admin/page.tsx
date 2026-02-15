"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type AdminDashboardData } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Receipt,
  CreditCard,
  Target,
  Shield,
  KeyRound,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Activity,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery<AdminDashboardData>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.admin.dashboard(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Painel Administrativo</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      label: "Total Usuários",
      value: data.totalUsuarios,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Usuários Ativos",
      value: data.usuariosAtivos,
      icon: Activity,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Novos (7 dias)",
      value: data.novosUltimos7Dias,
      icon: UserPlus,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Novos (30 dias)",
      value: data.novosUltimos30Dias,
      icon: UserPlus,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Receitas do Mês",
      value: formatCurrency(data.volumeReceitasMes),
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Gastos do Mês",
      value: formatCurrency(data.volumeGastosMes),
      icon: TrendingDown,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Lançamentos (Mês)",
      value: data.totalLancamentosMes,
      icon: Receipt,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Cartões Ativos",
      value: data.totalCartoes,
      icon: CreditCard,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Metas Ativas",
      value: data.metasAtivas,
      icon: Target,
      color: "text-pink-500",
      bg: "bg-pink-500/10",
    },
    {
      label: "Sessões Ativas",
      value: data.sessoesAtivas,
      icon: Shield,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Convites Ativos",
      value: data.codigosConviteAtivos,
      icon: KeyRound,
      color: "text-teal-500",
      bg: "bg-teal-500/10",
    },
    {
      label: "Bloqueados",
      value: data.usuariosBloqueados,
      icon: Shield,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-amber-500" />
          Painel Administrativo
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cadastros por Dia */}
      {data.cadastrosPorDia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-violet-500" />
              Cadastros Recentes (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.cadastrosPorDia.map((dia) => (
                <div key={dia.data} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <span className="text-sm text-muted-foreground">
                    {new Date(dia.data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                  </span>
                  <Badge variant="secondary" className="font-mono">
                    {dia.quantidade} {dia.quantidade === 1 ? "cadastro" : "cadastros"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo Financeiro do Mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Volume Total de Receitas</span>
              <span className="text-sm font-semibold text-emerald-500">{formatCurrency(data.volumeReceitasMes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Volume Total de Gastos</span>
              <span className="text-sm font-semibold text-red-500">{formatCurrency(data.volumeGastosMes)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="text-sm font-medium">Saldo Líquido</span>
              <span className={`text-sm font-bold ${data.volumeReceitasMes - data.volumeGastosMes >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {formatCurrency(data.volumeReceitasMes - data.volumeGastosMes)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo de Usuários</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Ativos</span>
              <Badge variant="default">{data.usuariosAtivos}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Inativos</span>
              <Badge variant="secondary">{data.usuariosInativos}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Com Telegram</span>
              <Badge variant="outline">{data.usuariosComTelegram}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Bloqueados</span>
              <Badge variant="destructive">{data.usuariosBloqueados}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
