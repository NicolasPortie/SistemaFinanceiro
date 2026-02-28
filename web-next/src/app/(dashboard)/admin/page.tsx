"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type AdminDashboardData } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/shared/page-components";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const from = 0;
    const to = value;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * ease));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value]);
  return <>{display}</>;
}

function RingChart({
  value,
  max,
  color,
  icon: Icon,
  iconColor,
}: {
  value: number;
  max: number;
  color: string;
  icon: React.ElementType;
  iconColor: string;
}) {
  const pct = Math.min(Math.round((value / (max || 1)) * 100), 100);
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-muted/40"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        {pct > 0 && (
          <motion.path
            className={color}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeDasharray={`${pct}, 100`}
            strokeLinecap="round"
            strokeWidth="3"
            initial={{ strokeDasharray: "0, 100" }}
            animate={{ strokeDasharray: `${pct}, 100` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { data: string; quantidade: number }[] }) {
  const max = Math.max(...data.map((d) => d.quantidade), 1);
  const last10 = data.slice(-10);

  return (
    <div className="flex items-end justify-between h-44 gap-1.5 w-full pt-4 px-1">
      {last10.map((d, i) => {
        const pct = Math.max((d.quantidade / max) * 100, 6);
        const label = new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR", {
          weekday: "short",
        });
        return (
          <div key={d.data} className="flex flex-col items-center flex-1 group cursor-pointer">
            <div className="relative w-full flex-1 flex items-end">
              <motion.div
                className="relative w-full rounded-t-lg bg-emerald-500/20 group-hover:bg-emerald-500 transition-colors duration-300"
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 * i }}
              >
                <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 dark:bg-gray-900 text-white text-[10px] py-0.5 px-1.5 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                  {d.quantidade}
                </div>
              </motion.div>
            </div>
            <span className="text-[10px] text-muted-foreground/50 mt-1.5 truncate w-full text-center">
              {label}
            </span>
          </div>
        );
      })}
      {last10.length === 0 && (
        <p className="text-sm text-muted-foreground/40 mx-auto self-center">Sem dados</p>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery<AdminDashboardData>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.admin.dashboard(),
  });

  if (isLoading) {
    return (
      <PageShell>
        <div className="mb-8">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  if (!data) return null;

  const total = data.totalUsuarios || 1;
  const pctAtivos = Math.round((data.usuariosAtivos / total) * 100);
  const pct7d = Math.round((data.novosUltimos7Dias / total) * 100);
  const pct30d = Math.round((data.novosUltimos30Dias / total) * 100);

  // Top 4 metric cards (with progress bar) — all values derived from real API data
  const topMetrics = [
    {
      label: "Total de Usuários",
      value: data.totalUsuarios,
      icon: Users,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      barColor: "bg-emerald-500",
      barPct: 100,
      sub: `${data.usuariosAtivos} ativos · ${data.usuariosInativos} inativos`,
    },
    {
      label: "Usuários Ativos",
      value: data.usuariosAtivos,
      icon: Activity,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      barColor: "bg-emerald-500",
      barPct: pctAtivos,
      sub: `${pctAtivos}% do total de usuários`,
    },
    {
      label: "Novos (7 dias)",
      value: data.novosUltimos7Dias,
      icon: UserPlus,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      barColor: "bg-violet-400",
      barPct: Math.max(pct7d, data.novosUltimos7Dias > 0 ? 6 : 0),
      sub: `${pct7d}% do total · últimos 7 dias`,
    },
    {
      label: "Novos (30 dias)",
      value: data.novosUltimos30Dias,
      icon: UserPlus,
      color: "text-teal-400",
      bg: "bg-teal-500/10",
      barColor: "bg-teal-400",
      barPct: Math.max(pct30d, data.novosUltimos30Dias > 0 ? 6 : 0),
      sub: `${pct30d}% do total · últimos 30 dias`,
    },
  ];

  // Bottom 4 simpler cards
  const bottomMetrics = [
    {
      label: "Com Telegram",
      value: data.usuariosComTelegram,
      icon: MessageCircle,
      color: "text-sky-500",
      bg: "bg-sky-500/10",
    },
    {
      label: "Inativos",
      value: data.usuariosInativos,
      icon: UserX,
      color: "text-muted-foreground",
      bg: "bg-muted/40",
    },
    {
      label: "Bloqueados",
      value: data.usuariosBloqueados,
      icon: Shield,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Sessões Ativas",
      value: data.sessoesAtivas,
      icon: Activity,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  // Platform ring metrics
  const plataforma = [
    {
      label: "Lançamentos (mês)",
      value: data.totalLancamentosMes,
      max: 500,
      ringColor: "text-amber-500",
      iconColor: "text-amber-500",
      icon: Receipt,
    },
    {
      label: "Cartões Cadastrados",
      value: data.totalCartoes,
      max: 100,
      ringColor: "text-cyan-500",
      iconColor: "text-cyan-500",
      icon: CreditCard,
    },
    {
      label: "Metas Ativas",
      value: data.metasAtivas,
      max: 50,
      ringColor: "text-rose-500",
      iconColor: "text-rose-500",
      icon: Target,
    },
    {
      label: "Convites Ativos",
      value: data.codigosConviteAtivos,
      max: 20,
      ringColor: "text-muted-foreground",
      iconColor: "text-muted-foreground/60",
      icon: KeyRound,
    },
  ];

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const, delay },
  });

  return (
    <PageShell>
      {/* Page title */}
      <motion.div className="mb-8" {...fadeUp(0)}>
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo de volta ao painel administrativo do Control Finance.
        </p>
      </motion.div>

      {/* ── Métricas de Usuários ── */}
      <section className="mb-8">
        <motion.div className="flex items-center justify-between mb-4" {...fadeUp(0.05)}>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
            Métricas de Usuários
          </p>
        </motion.div>

        {/* Top 4 — with progress bar */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {topMetrics.map((m, i) => (
            <motion.div
              key={m.label}
              {...fadeUp(0.1 + i * 0.07)}
              className="glass-panel rounded-2xl p-5 hover:border-emerald-500/30 transition-all group"
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-muted-foreground/60">{m.label}</p>
                  <h3 className={cn("text-2xl font-bold mt-1", m.color)}>
                    <AnimatedNumber value={m.value} />
                  </h3>
                </div>
                <div className={cn("p-2 rounded-lg", m.bg)}>
                  <m.icon className={cn("h-4.5 w-4.5", m.color)} />
                </div>
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground/50">{m.sub}</p>
              <div className="mt-3 h-1 w-full bg-muted/40 rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", m.barColor)}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(m.barPct, m.value > 0 ? 4 : 0)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 + i * 0.07 }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom 4 — simple icon+value */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {bottomMetrics.map((m, i) => (
            <motion.div
              key={m.label}
              {...fadeUp(0.38 + i * 0.07)}
              className="glass-panel rounded-2xl p-5 hover:shadow-lg transition-all flex items-center justify-between"
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
            >
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-xl", m.bg)}>
                  <m.icon className={cn("h-5 w-5", m.color)} />
                </div>
                <div>
                  <h4 className="text-xl font-bold">
                    <AnimatedNumber value={m.value} />
                  </h4>
                  <p className="text-xs text-muted-foreground/60">{m.label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Plataforma ── */}
      <section className="mb-8">
        <motion.p
          {...fadeUp(0.55)}
          className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4"
        >
          Plataforma
        </motion.p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plataforma.map((p, i) => (
            <motion.div
              key={p.label}
              {...fadeUp(0.6 + i * 0.07)}
              className="glass-panel rounded-2xl p-6 flex items-center gap-5"
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
            >
              <RingChart
                value={p.value}
                max={p.max}
                color={p.ringColor}
                icon={p.icon}
                iconColor={p.iconColor}
              />
              <div>
                <h3 className="text-2xl font-bold">
                  <AnimatedNumber value={p.value} />
                </h3>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{p.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Bottom row: chart + recent registrations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bar chart */}
        <motion.div {...fadeUp(0.85)} className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold">Atividade de Cadastros</h2>
            <span className="text-xs text-muted-foreground/50 bg-muted/30 px-2.5 py-1 rounded-lg">
              Últimos 30 dias
            </span>
          </div>
          {data.cadastrosPorDia.length > 0 ? (
            <BarChart data={data.cadastrosPorDia} />
          ) : (
            <div className="h-44 flex items-center justify-center">
              <p className="text-sm text-muted-foreground/40">Sem cadastros no período</p>
            </div>
          )}
        </motion.div>

        {/* Recent registrations */}
        <motion.div {...fadeUp(0.9)} className="glass-panel rounded-2xl p-6 flex flex-col">
          <h2 className="text-base font-bold mb-4">Cadastros Recentes</h2>
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {data.cadastrosPorDia.length === 0 && (
              <p className="text-sm text-muted-foreground/40 text-center py-8">
                Nenhum cadastro recente
              </p>
            )}
            <AnimatePresence>
              {[...data.cadastrosPorDia]
                .reverse()
                .slice(0, 8)
                .map((d, i) => {
                  const date = new Date(d.data + "T00:00:00");
                  const label = date.toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  });
                  const isFirst = i === 0;
                  return (
                    <motion.div
                      key={d.data}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.95 + i * 0.06 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/35 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                            isFirst
                              ? "bg-emerald-500/20 text-emerald-500"
                              : "bg-muted/60 text-muted-foreground"
                          )}
                        >
                          {String(date.getDate()).padStart(2, "0")}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground/50">
                            Cadastro {d.quantidade > 1 ? `(${d.quantidade}x)` : ""}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-xs font-semibold",
                          isFirst
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-muted/60 text-muted-foreground"
                        )}
                      >
                        +{d.quantidade}
                      </span>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>
          {data.cadastrosPorDia.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/30 text-center">
              <span className="text-xs text-primary font-semibold">Ver histórico completo</span>
            </div>
          )}
        </motion.div>
      </div>
    </PageShell>
  );
}
