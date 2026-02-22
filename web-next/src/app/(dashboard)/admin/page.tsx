"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type AdminDashboardData } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell, PageHeader } from "@/components/shared/page-components";
import { cn } from "@/lib/utils";
import {
  Users,
  Receipt,
  CreditCard,
  Target,
  Shield,
  KeyRound,
  UserPlus,
  Activity,
  MessageCircle,
  UserX,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery<AdminDashboardData>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.admin.dashboard(),
  });

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Painel Administrativo" description="Visão geral da plataforma" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card-premium p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  if (!data) return null;

  const usuariosStats = [
    { label: "Total de Usuários", value: data.totalUsuarios, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Usuários Ativos", value: data.usuariosAtivos, icon: Activity, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Cadastros (7 dias)", value: data.novosUltimos7Dias, icon: UserPlus, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Cadastros (30 dias)", value: data.novosUltimos30Dias, icon: UserPlus, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Com Telegram", value: data.usuariosComTelegram, icon: MessageCircle, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Inativos", value: data.usuariosInativos, icon: UserX, color: "text-muted-foreground", bg: "bg-muted/30" },
    { label: "Bloqueados", value: data.usuariosBloqueados, icon: Shield, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Sessões Ativas", value: data.sessoesAtivas, icon: Activity, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  const plataformaStats = [
    { label: "Lançamentos (mês)", value: data.totalLancamentosMes, icon: Receipt, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Cartões Cadastrados", value: data.totalCartoes, icon: CreditCard, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Metas Ativas", value: data.metasAtivas, icon: Target, color: "text-pink-500", bg: "bg-pink-500/10" },
    { label: "Convites Ativos", value: data.codigosConviteAtivos, icon: KeyRound, color: "text-teal-500", bg: "bg-teal-500/10" },
  ];

  return (
    <PageShell>
      <PageHeader title="Painel Administrativo" description="Visão geral da plataforma" />

      {/* Usuários */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Usuários</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {usuariosStats.map((stat) => (
            <div key={stat.label} className="card-premium p-4 flex items-center gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stat.bg)}>
                <stat.icon className={cn("h-4.5 w-4.5", stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground/60 font-medium truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plataforma */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Plataforma</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plataformaStats.map((stat) => (
            <div key={stat.label} className="card-premium p-4 flex items-center gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stat.bg)}>
                <stat.icon className={cn("h-4.5 w-4.5", stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground/60 font-medium truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>



      {/* Cadastros recentes */}
      {data.cadastrosPorDia.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Cadastros Recentes (30 dias)</p>
          <div className="card-premium overflow-hidden">
            <div className="divide-y divide-border/30">
              {data.cadastrosPorDia.map((dia) => (
                <div key={dia.data} className="flex items-center justify-between px-5 py-3 hover:bg-muted/15 transition-colors">
                  <span className="text-sm text-muted-foreground">
                    {new Date(dia.data + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {dia.quantidade} {dia.quantidade === 1 ? "cadastro" : "cadastros"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
