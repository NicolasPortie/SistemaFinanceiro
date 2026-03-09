"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type AdminDashboardData,
  type AdminUsuario,
  type AdminCodigoConvite,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Users,
  TrendingUp,
  UserMinus,
  Activity,
  Mail,
  Plus,
  Search,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Trash2,
} from "lucide-react";

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * ease));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);
  return <>{display.toLocaleString("pt-BR")}</>;
}

function DonutChart({ ativos, inativos, bloqueados }: { ativos: number; inativos: number; bloqueados: number }) {
  const total = ativos + inativos + bloqueados || 1;
  const pctAtivos = (ativos / total) * 251.2;
  const pctInativos = (inativos / total) * 251.2;
  return (
    <div className="relative w-36 h-36 xl:w-40 xl:h-40 flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#cbd5e1" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="0" />
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10B981" strokeWidth="8" strokeDasharray={`${pctAtivos} ${251.2 - pctAtivos}`} strokeLinecap="round" />
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#6366f1" strokeWidth="8" strokeDasharray={`${pctInativos} ${251.2 - pctInativos}`} strokeLinecap="round" strokeDashoffset={`${251.2 - pctAtivos}`} />
      </svg>
      <div className="absolute text-center">
        <p className="text-xl serif-italic text-slate-900">{total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}</p>
        <p className="text-[7px] text-slate-400 uppercase tracking-widest font-bold">Total</p>
      </div>
    </div>
  );
}

function ActivityBars({ data }: { data: { data: string; quantidade: number }[] }) {
  const last7 = data.slice(-7);
  const max = Math.max(...last7.map((d) => d.quantidade), 1);
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "SÃ¡b"];
  return (
    <div className="flex-1 flex items-end justify-between px-2 gap-3">
      {last7.map((d, i) => {
        const pct = Math.max((d.quantidade / max) * 100, 4);
        const label = days[new Date(d.data + "T00:00:00").getDay()];
        const isPeak = d.quantidade === max;
        return (
          <div key={d.data} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
            <div className="flex items-end gap-1 w-full justify-center h-[70%]">
              <div className={`w-3 rounded-t-sm ${isPeak ? "bg-emerald-500 shadow-[0_5px_15px_rgba(16,185,129,0.3)]" : "bg-emerald-500/40"}`}
                style={{ height: `${pct}%` }} />
            </div>
            <span className={`text-[9px] mono-data uppercase ${isPeak ? "text-emerald-600 font-bold" : "text-slate-400"}`}>{label}</span>
          </div>
        );
      })}
      {last7.length === 0 && <p className="text-xs text-slate-400 mx-auto self-center">Sem dados</p>}
    </div>
  );
}

function PlanBadge({ role }: { role: string }) {
  if (role === "admin") return <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">Admin</span>;
  if (role === "premium" || role === "executive") return <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">Executive</span>;
  if (role === "pro") return <span className="px-3 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Pro</span>;
  return <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">Basic</span>;
}

function StatusBadge({ ativo, bloqueado }: { ativo: boolean; bloqueado: boolean }) {
  if (bloqueado) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Bloqueado
    </span>
  );
  if (!ativo) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inativo
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ativo
    </span>
  );
}

function initials(nome: string) {
  return nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const masked = local.slice(0, 2) + "***";
  const domParts = domain.split(".");
  const domMasked = domParts[0].slice(0, 2) + "***";
  return `${masked}@${domMasked}.${domParts.slice(1).join(".")}`;
}

const PAGE_SIZE = 10;

export default function AdminDashboardPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"visao-geral" | "usuarios">("visao-geral");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<AdminDashboardData>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.admin.dashboard(),
  });

  const { data: usuarios = [], isLoading: loadingUsers } = useQuery<AdminUsuario[]>({
    queryKey: ["admin", "usuarios"],
    queryFn: () => api.admin.usuarios.listar(),
  });

  const { data: convites = [], isLoading: loadingConvites } = useQuery<AdminCodigoConvite[]>({
    queryKey: ["admin", "convites"],
    queryFn: () => api.admin.convites.listar(),
  });

  const deleteConviteMutation = useMutation({
    mutationFn: (id: number) => api.admin.convites.remover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "convites"] }),
  });

  const filteredUsers = usuarios.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchStatus =
      statusFilter === "todos" ? true :
      statusFilter === "ativo" ? u.ativo && !u.bloqueadoAte :
      statusFilter === "bloqueado" ? !!u.bloqueadoAte : !u.ativo;
    return matchSearch && matchStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="pl-4">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 sm:h-48 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem]" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pctAtivos = data.totalUsuarios ? Math.round((data.usuariosAtivos / data.totalUsuarios) * 100) : 0;
  const pctTelegram = data.totalUsuarios ? Math.round((data.usuariosComTelegram / data.totalUsuarios) * 100) : 0;

  const tabs = [
    { key: "visao-geral" as const, label: "VisÃ£o Geral" },
    { key: "usuarios" as const, label: "UsuÃ¡rios" },
  ];

  return (
    <div className="flex flex-col gap-6 sm:gap-10">
      <div className="pl-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          {activeTab === "visao-geral" ? (
            <>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl text-slate-900 serif-italic mb-2">Painel Administrativo</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">MÃ©tricas de Crescimento e OperaÃ§Ã£o</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl text-slate-900 serif-italic mb-2">Gestão de Usuários</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">VisÃ£o Geral e Controle de Acesso</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {activeTab === "usuarios" && (
            <button className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2" onClick={() => setActiveTab("visao-geral")}>
              <Mail className="w-4 h-4" /> Gerenciar Convites
            </button>
          )}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-full border border-slate-200/50">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={cn("px-5 py-2 text-[9px] font-bold uppercase tracking-widest rounded-full transition-all",
                  activeTab === t.key ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600")}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "visao-geral" && (
        <motion.div key="visao-geral" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col gap-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity text-slate-900">
                <Users className="w-28 h-28" />
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-6">Total de UsuÃ¡rios</p>
              <span className="text-2xl sm:text-3xl lg:text-4xl serif-italic text-slate-900 tracking-tight block mb-2"><AnimatedNumber value={data.totalUsuarios} /></span>
              <div className="flex items-center gap-2 text-[10px] mono-data text-emerald-600 font-bold">
                <TrendingUp className="w-4 h-4" /><span>+{data.novosUltimos7Dias} nos últimos 7d</span>
              </div>
            </div>
            <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-28 h-28" />
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-6">LanÃ§amentos (MÃªs)</p>
              <span className="text-2xl sm:text-3xl lg:text-4xl serif-italic text-slate-900 tracking-tight block mb-2"><AnimatedNumber value={data.totalLancamentosMes} /></span>
              <p className="text-[10px] mono-data text-slate-500 font-bold">{data.metasAtivas} metas ativas · {data.totalCartoes} cartões</p>
            </div>
            <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-28 h-28" />
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-6">SessÃµes Ativas (24h)</p>
              <span className="text-2xl sm:text-3xl lg:text-4xl serif-italic text-slate-900 tracking-tight block mb-2"><AnimatedNumber value={data.sessoesAtivas} /></span>
              <p className="text-[10px] mono-data text-slate-500 font-bold">{data.usuariosComTelegram} vinculados ao Telegram</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
            <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-6 sm:p-10 lg:p-12 flex flex-col sm:flex-row items-center gap-6 sm:gap-10 xl:gap-16">
              <div className="flex-1 space-y-5">
                <h4 className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.3em] mb-4">DistribuiÃ§Ã£o de UsuÃ¡rios</h4>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: "Ativos", pct: pctAtivos, color: "bg-emerald-500" },
                    { label: "Inativos", pct: data.totalUsuarios ? Math.round((data.usuariosInativos / data.totalUsuarios) * 100) : 0, color: "bg-indigo-500" },
                    { label: "Bloqueados", pct: data.totalUsuarios ? Math.round((data.usuariosBloqueados / data.totalUsuarios) * 100) : 0, color: "bg-rose-400" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-[10px] px-2 py-1">
                      <span className="flex items-center gap-3 text-slate-500 font-medium whitespace-nowrap">
                        <span className={`w-2 h-2 rounded-full ${item.color}`} /> {item.label}
                      </span>
                      <span className="text-slate-900 mono-data font-bold whitespace-nowrap">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <DonutChart ativos={data.usuariosAtivos} inativos={data.usuariosInativos} bloqueados={data.usuariosBloqueados} />
            </div>
            <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-6 sm:p-10 lg:p-12 flex flex-col h-75">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.3em]">Cadastros (7d)</h4>
                <span className="flex items-center gap-1 text-[8px] uppercase tracking-widest font-bold text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Cadastros
                </span>
              </div>
              <ActivityBars data={data.cadastrosPorDia} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8">
            <div className="col-span-12 lg:col-span-7 exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden flex flex-col">
              <div className="px-5 sm:px-10 py-5 sm:py-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                <h4 className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.3em]">GestÃ£o de Convites</h4>
                <button className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Novo Convite
                </button>
              </div>
              <div className="flex-1 overflow-x-auto bg-white px-4 pb-4">
                {loadingConvites ? (
                  <div className="p-8 space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : convites.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <KeyRound className="w-8 h-8 text-slate-200 mb-3" />
                    <p className="text-xs text-slate-400 font-medium">Nenhum convite cadastrado</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        {["CÃ³digo","DescriÃ§Ã£o","Uso","Status",""].map((h, i) => (
                          <th key={i} className="px-6 py-4 text-[8px] text-slate-400 font-bold uppercase tracking-widest border-b border-slate-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {convites.map((c) => {
                        const esgotado = c.usoMaximo !== null && c.usosRealizados >= c.usoMaximo;
                        const expiredOrUsed = c.expirado || c.usado;
                        const ativo = !esgotado && !expiredOrUsed;
                        return (
                          <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-5 mono-data text-[11px] font-bold text-slate-900">{c.codigo}</td>
                            <td className="px-6 py-5 text-[10px] text-slate-600 font-medium max-w-40 truncate">{c.descricao ?? "â€”"}</td>
                            <td className="px-6 py-5 text-[11px] mono-data text-slate-500">{c.ilimitado ? "âˆž" : `${c.usosRealizados}/${c.usoMaximo ?? 1}`}</td>
                            <td className="px-6 py-5">
                              {ativo ? <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-bold uppercase tracking-widest">Ativo</span>
                               : esgotado ? <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[8px] font-bold uppercase tracking-widest">Esgotado</span>
                               : c.expirado ? <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[8px] font-bold uppercase tracking-widest">Expirado</span>
                               : <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[8px] font-bold uppercase tracking-widest">Usado</span>}
                            </td>
                            <td className="px-6 py-5 text-right">
                              <button onClick={() => deleteConviteMutation.mutate(c.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden flex flex-col">
              <div className="px-5 sm:px-10 py-5 sm:py-8 border-b border-slate-50 bg-white">
                <h4 className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.3em]">Ãšltimos Cadastros</h4>
              </div>
              <div className="flex-1 bg-white px-8 py-6">
                {loadingUsers ? (
                  <div className="space-y-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : usuarios.length === 0 ? (
                  <div className="flex items-center justify-center py-12"><p className="text-xs text-slate-400">Sem cadastros recentes</p></div>
                ) : (
                  <ul className="space-y-5">
                    {[...usuarios].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()).slice(0, 6).map((u) => (
                      <li key={u.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{initials(u.nome)}</div>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-900">{maskEmail(u.email)}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{new Date(u.criadoEm).toLocaleDateString("pt-BR")}</p>
                          </div>
                        </div>
                        <PlanBadge role={u.role} />
                      </li>
                    ))}
                  </ul>
                )}
                {usuarios.length > 6 && (
                  <button onClick={() => setActiveTab("usuarios")} className="mt-6 text-[9px] font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors">
                    Ver todos â†’
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "usuarios" && (
        <motion.div key="usuarios" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="exec-card rounded-3xl p-6 flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0"><Users className="w-5 h-5" /></div>
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-1">Total de UsuÃ¡rios</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl mono-data text-slate-900 font-bold"><AnimatedNumber value={data.totalUsuarios} /></span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">+{data.novosUltimos30Dias} m/m</span>
                </div>
              </div>
            </div>
            <div className="exec-card rounded-3xl p-6 flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-1">UsuÃ¡rios Ativos</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl mono-data text-slate-900 font-bold">{pctAtivos}%</span>
                  <span className="text-[10px] text-slate-400 font-bold">{data.usuariosAtivos} ativos</span>
                </div>
              </div>
            </div>
            <div className="exec-card rounded-3xl p-6 flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0"><UserMinus className="w-5 h-5" /></div>
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-1">Bloqueados / Inativos</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl mono-data text-slate-900 font-bold"><AnimatedNumber value={data.usuariosBloqueados + data.usuariosInativos} /></span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">{pctTelegram}% Telegram</span>
                </div>
              </div>
            </div>
          </div>

          <div className="exec-card rounded-[2rem] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input className="w-full bg-slate-50 border border-slate-100 rounded-full pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-400 text-slate-900"
                  placeholder="Buscar por nome ou e-mail..." type="text" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status:</span>
                <select className="bg-slate-50 border border-slate-100 rounded-full text-xs py-2 pl-4 pr-8 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 font-medium cursor-pointer"
                  value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              {loadingUsers ? (
                <div className="p-8 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : pagedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Users className="w-8 h-8 text-slate-200 mb-3" />
                  <p className="text-xs text-slate-400">Nenhum usuÃ¡rio encontrado</p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      {["Nome","E-mail","Plano","Entrada","Status","AÃ§Ãµes"].map((h, i) => (
                        <th key={h} className={cn("px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100", i === 5 && "text-right")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pagedUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 border-b border-slate-50 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">{initials(u.nome)}</div>
                            <span className="font-medium text-slate-900 truncate max-w-30">{u.nome}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-slate-50 text-slate-500 font-mono text-xs">{maskEmail(u.email)}</td>
                        <td className="px-6 py-4 border-b border-slate-50"><PlanBadge role={u.role} /></td>
                        <td className="px-6 py-4 border-b border-slate-50 text-slate-500 mono-data text-xs">
                          {new Date(u.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4 border-b border-slate-50"><StatusBadge ativo={u.ativo} bloqueado={!!u.bloqueadoAte} /></td>
                        <td className="px-6 py-4 border-b border-slate-50 text-right">
                          <button className="text-slate-400 hover:text-slate-900 transition-colors p-1"><MoreVertical className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Mostrando {filteredUsers.length === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, filteredUsers.length)}â€“{Math.min(page * PAGE_SIZE, filteredUsers.length)} de {filteredUsers.length}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={cn("w-8 h-8 rounded-full border text-xs font-bold transition-colors", page === p ? "border-slate-200 bg-white text-slate-900 shadow-sm" : "border-transparent text-slate-500 hover:bg-white")}>
                    {p}
                  </button>
                ))}
                {totalPages > 5 && <span className="w-8 h-8 flex items-center justify-center text-slate-400">â€¦</span>}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition-colors shadow-sm bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
