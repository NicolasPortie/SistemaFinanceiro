"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CreditCard,
  KeyRound,
  LayoutPanelTop,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

import {
  api,
  type AdminCodigoConvite,
  type AdminDashboardData,
  type AdminUsuario,
} from "@/lib/api";
import { ErrorState } from "@/components/shared/page-components";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

const QUICK_LINKS = [
  {
    href: "/admin/usuarios",
    title: "Gerenciar usuários",
    description: "Bloqueio, sessões, permissões e revisão de contas.",
    icon: Users,
  },
  {
    href: "/admin/planos",
    title: "Gerenciar planos",
    description: "Planos, recursos individuais e recursos familiares.",
    icon: Wallet,
  },
  {
    href: "/admin/convites",
    title: "Gerenciar convites",
    description: "Convites temporários, permanentes e códigos ativos.",
    icon: KeyRound,
  },
  {
    href: "/admin/seguranca",
    title: "Painel de segurança",
    description: "Sessões ativas, usuários bloqueados e ações administrativas.",
    icon: Shield,
  },
];

export default function AdminDashboardPage() {
  const {
    data: dashboard,
    isLoading: loadingDashboard,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useQuery<AdminDashboardData>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.admin.dashboard(),
  });

  const {
    data: usuarios = [],
    isLoading: loadingUsers,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery<AdminUsuario[]>({
    queryKey: ["admin", "usuarios"],
    queryFn: () => api.admin.usuarios.listar(),
  });

  const {
    data: convites = [],
    isLoading: loadingConvites,
    error: convitesError,
    refetch: refetchConvites,
  } = useQuery<AdminCodigoConvite[]>({
    queryKey: ["admin", "convites"],
    queryFn: () => api.admin.convites.listar(),
  });

  const usuariosRecentes = useMemo(
    () => [...usuarios].sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm)).slice(0, 5),
    [usuarios]
  );

  const convitesRecentes = useMemo(
    () => [...convites].sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm)).slice(0, 5),
    [convites]
  );

  if (loadingDashboard || loadingUsers || loadingConvites) {
    return <DashboardSkeleton />;
  }

  if (dashboardError || usersError || convitesError || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorState
          message="Erro ao carregar o painel administrativo."
          onRetry={() => {
            refetchDashboard();
            refetchUsers();
            refetchConvites();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="rounded-[2.5rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(239,246,255,0.92)_45%,rgba(226,232,240,0.9))] p-6 shadow-sm sm:p-8 lg:p-10 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.96),rgba(15,23,42,0.94)_45%,rgba(30,41,59,0.94))]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <LayoutPanelTop className="h-3.5 w-3.5" />
              Painel Administrativo
            </span>
            <h1 className="text-3xl serif-italic text-slate-900 lg:text-4xl dark:text-white">
              Operação central do produto
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-500 dark:text-slate-300">
              Métricas principais, atalhos para os módulos de administração e visão rápida dos convites e usuários mais recentes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Usuários" value={dashboard.totalUsuarios} />
            <MiniStat label="Convites ativos" value={dashboard.codigosConviteAtivos} />
            <MiniStat label="Sessões ativas" value={dashboard.sessoesAtivas} />
            <MiniStat label="Cartões" value={dashboard.totalCartoes} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Base ativa"
          value={dashboard.usuariosAtivos}
          detail={`${dashboard.novosUltimos7Dias} novos usuários nos últimos 7 dias`}
          icon={Users}
        />
        <StatCard
          title="Lançamentos do mês"
          value={dashboard.totalLancamentosMes}
          detail={`${dashboard.metasAtivas} metas ativas em acompanhamento`}
          icon={Activity}
        />
        <StatCard
          title="Usuários com Telegram"
          value={dashboard.usuariosComTelegram}
          detail="Base com canal ativo para notificações e atendimento"
          icon={KeyRound}
        />
        <StatCard
          title="Usuários bloqueados"
          value={dashboard.usuariosBloqueados}
          detail={`${dashboard.usuariosInativos} contas inativas no momento`}
          icon={Shield}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="exec-card rounded-[2rem] p-6 lg:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                Atalhos administrativos
              </p>
              <h2 className="mt-2 text-2xl serif-italic text-slate-900 dark:text-white">
                Módulos principais
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-[1.5rem] border border-slate-200/70 bg-white/80 p-5 transition-all hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {link.title}
                        </h3>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-300">
                          {link.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-emerald-600" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="exec-card rounded-[2rem] p-6 lg:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
            Distribuição da operação
          </p>
          <h2 className="mt-2 text-2xl serif-italic text-slate-900 dark:text-white">
            Resumo rápido
          </h2>

          <div className="mt-6 space-y-4">
            <RatioRow label="Usuários ativos" value={dashboard.usuariosAtivos} total={dashboard.totalUsuarios} tone="emerald" />
            <RatioRow label="Usuários inativos" value={dashboard.usuariosInativos} total={dashboard.totalUsuarios} tone="slate" />
            <RatioRow label="Usuários bloqueados" value={dashboard.usuariosBloqueados} total={dashboard.totalUsuarios} tone="rose" />
            <RatioRow label="Telegram vinculado" value={dashboard.usuariosComTelegram} total={dashboard.totalUsuarios} tone="sky" />
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-[11px] text-slate-500 dark:text-slate-300">
              Novos usuários em 30 dias
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {dashboard.novosUltimos30Dias.toLocaleString("pt-BR")}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Base atual com {dashboard.totalCartoes.toLocaleString("pt-BR")} cartões e {dashboard.metasAtivas.toLocaleString("pt-BR")} metas em andamento.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <RecentUsersCard usuarios={usuariosRecentes} />
        <RecentInvitesCard convites={convitesRecentes} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ActionCard
          href="/admin/planos"
          title="Planos e acessos"
          detail="Separação clara entre recursos individuais e familiares."
          icon={Wallet}
        />
        <ActionCard
          href="/admin/convites"
          title="Fluxo de convites"
          detail="Monitore convites permanentes, temporários e já utilizados."
          icon={KeyRound}
        />
        <ActionCard
          href="/admin/usuarios"
          title="Contas e segurança"
          detail="Ações administrativas concentradas sem misturar com o dashboard."
          icon={CreditCard}
        />
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="exec-card rounded-[2rem] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">{title}</p>
          <p className="mt-3 text-3xl serif-italic text-slate-900 dark:text-white">
            {value.toLocaleString("pt-BR")}
          </p>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-300">{detail}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function RatioRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "emerald" | "slate" | "rose" | "sky";
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const colors = {
    emerald: "bg-emerald-500",
    slate: "bg-slate-500",
    rose: "bg-rose-500",
    sky: "bg-sky-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-semibold text-slate-900 dark:text-white">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RecentUsersCard({ usuarios }: { usuarios: AdminUsuario[] }) {
  return (
    <div className="exec-card rounded-[2rem] p-6 lg:p-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
            Cadastros recentes
          </p>
          <h2 className="mt-2 text-2xl serif-italic text-slate-900 dark:text-white">
            Usuários mais recentes
          </h2>
        </div>
        <Link href="/admin/usuarios" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">
          Ver todos
        </Link>
      </div>

      <div className="space-y-3">
        {usuarios.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Nenhum usuário cadastrado ainda.
          </p>
        )}

        {usuarios.map((usuario) => (
          <div
            key={usuario.id}
            className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200/70 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{usuario.nome}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-300">{usuario.email}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500 dark:text-slate-300">{formatDate(usuario.criadoEm)}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {usuario.role}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentInvitesCard({ convites }: { convites: AdminCodigoConvite[] }) {
  return (
    <div className="exec-card rounded-[2rem] p-6 lg:p-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
            Convites recentes
          </p>
          <h2 className="mt-2 text-2xl serif-italic text-slate-900 dark:text-white">
            Links e códigos criados
          </h2>
        </div>
        <Link href="/admin/convites" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">
          Ver todos
        </Link>
      </div>

      <div className="space-y-3">
        {convites.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Nenhum convite gerado ainda.
          </p>
        )}

        {convites.map((convite) => (
          <div
            key={convite.id}
            className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200/70 bg-white/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{convite.codigo}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-300">
                {convite.permanente
                  ? "Acesso permanente"
                  : convite.duracaoAcessoDias
                    ? `${convite.duracaoAcessoDias} dias de acesso`
                    : "Sem prazo definido"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500 dark:text-slate-300">{formatDate(convite.criadoEm)}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {convite.usado ? "Usado" : convite.expirado ? "Expirado" : "Ativo"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  detail,
  icon: Icon,
}: {
  href: string;
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[2rem] border border-slate-200/70 bg-white p-6 transition-all hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/20 dark:hover:bg-emerald-500/5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-300">{detail}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-emerald-600" />
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 lg:space-y-10">
      <Skeleton className="h-52 rounded-[2.5rem]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-[2rem]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Skeleton className="h-80 rounded-[2rem]" />
        <Skeleton className="h-80 rounded-[2rem]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-[2rem]" />
        <Skeleton className="h-72 rounded-[2rem]" />
      </div>
    </div>
  );
}