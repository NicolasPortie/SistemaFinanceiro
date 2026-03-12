"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAtualizarPerfil } from "@/hooks/use-queries";
import { getInitials, formatCurrency, formatDate } from "@/lib/format";
import {
  atualizarPerfilSchema,
  alterarSenhaSchema,
  rendaMensalSchema,
  type AtualizarPerfilData,
  type AlterarSenhaData,
  type RendaMensalData,
} from "@/lib/schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User,
  MessageCircle,
  Shield,
  Pencil,
  Lock,
  AlertTriangle,
  Crown,
  DollarSign,
  Sparkles,
  HeadphonesIcon,
  SlidersHorizontal,
  ChevronRight,
  Mail,
  BookOpen,
  Bug,
  Camera,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import { useUpgradePlan } from "@/components/upgrade-plan-modal";

/* ────────────────────────────────────────────── */

type SectionId = "perfil" | "assinatura" | "seguranca" | "preferencias" | "suporte";

const SIDEBAR_LINKS: { id: SectionId; icon: React.ElementType; label: string }[] = [
  { id: "perfil", icon: User, label: "Perfil e Conta" },
  { id: "assinatura", icon: Crown, label: "Plano e Assinatura" },
  { id: "seguranca", icon: Shield, label: "Segurança e Acesso" },
  { id: "preferencias", icon: SlidersHorizontal, label: "Preferências" },
  { id: "suporte", icon: HeadphonesIcon, label: "Suporte e Ajuda" },
];

/* ════════════════════════════════════════════════════════════ */

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { usuario, atualizarPerfil: atualizarContexto, logout } = useAuth();
  const { openUpgrade } = useUpgradePlan();

  /* ── Section state ── */
  const [activeSection, setActiveSection] = useState<SectionId>("perfil");
  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ── state ── */
  const [editandoNome, setEditandoNome] = useState(false);
  const [editandoRenda, setEditandoRenda] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showExcluirConta, setShowExcluirConta] = useState(false);
  const [excluirTexto, setExcluirTexto] = useState("");
  const [excluindoConta, setExcluindoConta] = useState(false);

  /* ── mutations / queries ── */
  const atualizarPerfilMutation = useAtualizarPerfil();
  const { data: minha } = useQuery({
    queryKey: ["assinatura-minha"],
    queryFn: () => api.assinaturas.minha(),
    staleTime: 5 * 60 * 1000,
  });
  const assinatura = minha?.assinatura;
  const cancelamentoAgendado = !!assinatura?.canceladoEm && assinatura.status !== "Cancelada";

  /* ── forms ── */
  const nomeForm = useForm<AtualizarPerfilData>({
    resolver: zodResolver(atualizarPerfilSchema),
    defaultValues: { nome: usuario?.nome ?? "" },
  });

  const senhaForm = useForm<AlterarSenhaData>({
    resolver: zodResolver(alterarSenhaSchema),
    defaultValues: { senhaAtual: "", novaSenha: "", confirmarSenha: "" },
  });

  const rendaForm = useForm<RendaMensalData>({
    resolver: zodResolver(rendaMensalSchema),
    defaultValues: {
      rendaMensal: usuario?.rendaMensal ? usuario.rendaMensal.toFixed(2).replace(".", ",") : "0,00",
    },
  });

  if (!usuario) return null;

  /* ── handlers ── */
  const onSalvarNome = (data: AtualizarPerfilData) => {
    atualizarPerfilMutation.mutate(
      { nome: data.nome },
      {
        onSuccess: async () => {
          setEditandoNome(false);
          await atualizarContexto();
        },
      }
    );
  };

  const onSalvarRenda = (data: RendaMensalData) => {
    const raw = data.rendaMensal.replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(raw);
    atualizarPerfilMutation.mutate(
      { rendaMensal: isNaN(valor) || valor === 0 ? 0 : valor },
      {
        onSuccess: async () => {
          setEditandoRenda(false);
          await atualizarContexto();
          toast.success("Renda mensal atualizada!");
        },
      }
    );
  };

  const onAlterarSenha = (data: AlterarSenhaData) => {
    atualizarPerfilMutation.mutate(
      { senhaAtual: data.senhaAtual, novaSenha: data.novaSenha },
      {
        onSuccess: () => {
          setShowSenha(false);
          senhaForm.reset();
          toast.success("Senha alterada com sucesso!");
        },
      }
    );
  };

  const onExcluirConta = async () => {
    if (excluirTexto !== "EXCLUIR MINHA CONTA") return;
    setExcluindoConta(true);
    try {
      await api.auth.excluirConta();
      toast.success("Conta excluída permanentemente.");
      logout();
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir conta.");
      setExcluindoConta(false);
    }
  };

  /* ── render ── */
  return (
    <div className="flex flex-col lg:flex-row h-full -m-4 sm:-m-6 lg:-m-8 overflow-hidden">
      {/* ── Mobile header + tabs ── */}
      <div className="lg:hidden bg-white dark:bg-[#161B22] border-b border-slate-100 dark:border-slate-800">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-2xl serif-italic text-slate-900 dark:text-white tracking-tight">
            Configurações
          </h1>
          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-bold mt-1">
            Personalize sua experiência
          </p>
        </div>
        <div className="flex overflow-x-auto gap-1 px-3 pb-2 pr-4 hide-scrollbar snap-x snap-mandatory">
          {SIDEBAR_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                aria-pressed={isActive}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all shrink-0 snap-start",
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
                )}
              >
                <Icon className="size-3.5" />
                {link.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sidebar ── */}
      <aside className="w-80 shrink-0 bg-white dark:bg-[#161B22] border-r border-slate-100 dark:border-slate-800 hidden lg:flex lg:flex-col">
        <div className="p-6 lg:p-10">
          <h1 className="text-3xl serif-italic text-slate-900 dark:text-white tracking-tight">
            Configurações
          </h1>
          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-bold mt-2">
            Personalize sua experiência
          </p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {SIDEBAR_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                aria-pressed={isActive}
                className={cn(
                  "w-full flex items-center gap-4 px-6 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all group text-left",
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-r-2 border-emerald-500"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                )}
              >
                <Icon
                  className={cn(
                    "size-5",
                    isActive ? "text-emerald-500" : "group-hover:text-emerald-500"
                  )}
                />
                {link.label}
              </button>
            );
          })}
        </nav>
        <div className="p-8 border-t border-slate-50 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 text-center">Ravier v2.4.0 • 2026</p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-12 hide-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12 pb-24">
          {/* ══════ 1. Perfil e Conta ══════ */}
          <div
            className="glass-card bg-white dark:bg-[#161B22] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-12"
            id="section-perfil"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 mb-6 sm:mb-10 pb-6 sm:pb-10 border-b border-slate-50 dark:border-slate-800">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-400 dark:text-slate-500 border-4 border-white dark:border-slate-700 shadow-sm overflow-hidden">
                  {getInitials(usuario.nome)}
                </div>
                <button
                  type="button"
                  disabled
                  aria-label="Upload de foto em breve"
                  title="Upload de foto em breve"
                  className="absolute bottom-0 right-0 rounded-full bg-slate-300 p-2 text-white opacity-70 shadow-lg transition-all cursor-not-allowed dark:bg-slate-600"
                >
                  <Camera className="size-3.5" />
                </button>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Perfil e Conta
                </h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                  Gerencie seus dados pessoais
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 lg:gap-x-12 gap-y-6 sm:gap-y-8">
              {/* Nome */}
              <div className="space-y-2">
                <label
                  htmlFor="config-full-name"
                  className="text-[9px] uppercase tracking-widest font-bold text-slate-400"
                >
                  Nome Completo
                </label>
                <div className="relative group">
                  <input
                    id="config-full-name"
                    name="full_name"
                    autoComplete="name"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-transparent rounded-2xl px-5 py-4 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-700 transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    type="text"
                    value={usuario.nome}
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() => {
                      nomeForm.reset({ nome: usuario.nome });
                      setEditandoNome(true);
                    }}
                    aria-label="Editar nome completo"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-emerald-500 transition-colors"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
              </div>
              {/* Email (readonly) */}
              <div className="space-y-2">
                <label
                  htmlFor="config-email"
                  className="text-[9px] uppercase tracking-widest font-bold text-slate-400"
                >
                  Endereço de E-mail
                </label>
                <input
                  id="config-email"
                  name="email"
                  autoComplete="email"
                  className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-transparent rounded-2xl px-5 py-4 text-sm font-medium text-slate-400 cursor-not-allowed"
                  type="email"
                  value={usuario.email}
                  readOnly
                />
              </div>
              {/* Renda Mensal */}
              <div className="space-y-2">
                <label
                  htmlFor="config-income"
                  className="text-[9px] uppercase tracking-widest font-bold text-slate-400"
                >
                  Renda Mensal
                </label>
                <div className="relative group">
                  <input
                    id="config-income"
                    name="monthly_income"
                    autoComplete="off"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-transparent rounded-2xl px-5 py-4 text-sm font-medium mono-data text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-700 transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    type="text"
                    value={
                      usuario.rendaMensal ? formatCurrency(usuario.rendaMensal) : "Não informada"
                    }
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() => {
                      rendaForm.reset({
                        rendaMensal: usuario.rendaMensal
                          ? usuario.rendaMensal.toFixed(2).replace(".", ",")
                          : "0,00",
                      });
                      setEditandoRenda(true);
                    }}
                    aria-label="Editar renda mensal"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-emerald-500 transition-colors"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
              </div>
              {/* CPF (readonly) */}
              <div className="space-y-2">
                <label
                  htmlFor="config-cpf"
                  className="text-[9px] uppercase tracking-widest font-bold text-slate-400"
                >
                  CPF
                </label>
                <input
                  id="config-cpf"
                  name="cpf"
                  autoComplete="off"
                  className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-transparent rounded-2xl px-5 py-4 text-sm font-medium text-slate-400 cursor-not-allowed"
                  type="text"
                  value={usuario.temCpf ? "•••.•••.•••-•• (criptografado)" : "Não informado"}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* ══════ 2. Plano e Assinatura ══════ */}
          <div
            className="glass-card bg-white dark:bg-[#161B22] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-12"
            id="section-assinatura"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Plano e Assinatura
                </h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                  Detalhes do seu serviço contratado
                </p>
              </div>
              {assinatura && (
                <span
                  className={cn(
                    "px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-full",
                    assinatura.statusCor === "emerald"
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                      : assinatura.statusCor === "blue"
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                        : assinatura.statusCor === "red"
                          ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  )}
                >
                  {assinatura.statusNome}
                </span>
              )}
            </div>
            {assinatura ? (
              <>
                {cancelamentoAgendado && (
                  <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 size-5 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                          {assinatura.emTrial
                            ? "Cancelamento agendado antes da primeira cobrança"
                            : "Cancelamento agendado da assinatura"}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-300">
                          {assinatura.emTrial
                            ? `Seu acesso continua até ${formatDate(assinatura.canceladoEm!)}. Como o cancelamento foi agendado dentro do trial, não deve haver cobrança se você não reativar antes dessa data.`
                            : `Sua assinatura segue ativa até ${formatDate(assinatura.canceladoEm!)}. Depois disso, o plano volta para o gratuito automaticamente.`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12">
                  <div className="p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">
                      Plano Atual
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {assinatura.planoNome}
                    </p>
                  </div>
                  <div className="p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">
                      Valor Mensal
                    </p>
                    <p className="text-lg font-bold mono-data text-slate-900 dark:text-white">
                      {formatCurrency(assinatura.valorMensal)}
                    </p>
                  </div>
                  <div className="p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">
                      {cancelamentoAgendado ? "Encerramento" : "Próxima Cobrança"}
                    </p>
                    <p className="text-lg font-bold mono-data text-slate-900 dark:text-white">
                      {cancelamentoAgendado
                        ? formatDate(assinatura.canceladoEm!)
                        : assinatura.proximaCobranca
                          ? formatDate(assinatura.proximaCobranca)
                          : "—"}
                    </p>
                  </div>
                </div>
                {assinatura.emTrial && assinatura.diasRestantesTrial > 0 && (
                  <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-3.5 py-2 rounded-xl text-sm font-semibold border border-blue-100 dark:border-blue-900/40 mb-8">
                    <Sparkles className="size-4" />
                    <span>{assinatura.diasRestantesTrial} dias de trial restantes</span>
                  </div>
                )}
                <div className="flex items-center gap-4 flex-wrap">
                  <button
                    onClick={() => openUpgrade()}
                    className="px-8 py-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 dark:shadow-emerald-900/30"
                  >
                    Upgrade de Plano
                  </button>
                  {assinatura.podeGerenciarAssinatura && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.assinaturas.portal();
                          window.location.href = res.url;
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Erro ao abrir portal");
                        }
                      }}
                      className="px-8 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                      Gerenciar Cobrança
                    </button>
                  )}
                  <button
                    onClick={() => openUpgrade()}
                    className="px-8 py-4 bg-transparent text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:text-emerald-600 transition-all"
                  >
                    Ver todos os planos
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 p-6">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Bloqueado no seu plano atual
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: "🤖", label: "Consultor de IA" },
                      { icon: "📊", label: "Importação de extratos" },
                      { icon: "🎯", label: "Metas ilimitadas" },
                      { icon: "🔔", label: "Notificações proativas" },
                      { icon: "💬", label: "Telegram ilimitado" },
                      { icon: "👥", label: "Dashboard familiar" },
                    ].map((feat) => (
                      <div
                        key={feat.label}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 opacity-60"
                      >
                        <span className="text-base grayscale">{feat.icon}</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {feat.label}
                        </span>
                        <Lock className="size-3.5 text-slate-300 shrink-0 ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => openUpgrade()}
                  className="w-full px-8 py-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 dark:shadow-emerald-900/30"
                >
                  Ver Planos
                </button>
              </div>
            )}
          </div>

          {/* ══════ 3. Segurança e Acesso ══════ */}
          <div
            className="glass-card bg-white dark:bg-[#161B22] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-12"
            id="section-seguranca"
          >
            <div className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Segurança e Acesso
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                Controle de credenciais e privacidade
              </p>
            </div>
            <div className="space-y-8">
              {/* Senha */}
              <div className="flex items-center justify-between p-8 rounded-3xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center text-slate-400">
                    <Lock className="size-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                      Senha de Acesso
                    </p>
                    <p className="text-sm text-slate-400 mt-1 font-medium italic">••••••••••••••</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSenha(true)}
                  className="px-6 py-3 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all text-slate-900 dark:text-white"
                >
                  Alterar Senha
                </button>
              </div>
              {/* Zona de perigo */}
              <div className="p-8 rounded-3xl bg-rose-50/30 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                      Zona de Perigo
                    </p>
                    <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">
                      Excluir Conta Permanentemente
                    </p>
                    <p className="text-[11px] text-rose-400 max-w-md">
                      A exclusão é irreversível. Todos os seus dados financeiros, transações e
                      configurações serão permanentemente removidos de nossos servidores.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowExcluirConta(true)}
                    className="px-6 py-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-all shrink-0"
                  >
                    Excluir Conta
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ══════ 4. Preferências ══════ */}
          <div
            className="glass-card bg-white dark:bg-[#161B22] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-12"
            id="section-preferencias"
          >
            <div className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Preferências</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                Personalização do sistema
              </p>
            </div>
            <div className="space-y-12">
              <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-6 dark:border-slate-700 dark:bg-slate-800/35">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                      Categorias financeiras
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
                      O catálogo de categorias saiu de configurações e ganhou uma guia própria para
                      cadastro, revisão e manutenção.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/categorias")}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700"
                  >
                    Abrir Categorias
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              {/* Notificações */}
              <div className="space-y-6 pt-10 border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                      Notificações por E-mail
                    </p>
                    <p className="text-sm text-slate-400 font-medium">
                      Receba alertas de gastos e vencimentos
                    </p>
                  </div>
                  <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-0 text-xs">
                    Em breve
                  </Badge>
                </div>
                <div className="flex items-center justify-between opacity-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">
                        Resumo Financeiro Semanal
                      </p>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[8px] font-bold rounded uppercase">
                        Em Breve
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 font-medium">
                      Um relatório detalhado toda segunda-feira
                    </p>
                  </div>
                  <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative cursor-not-allowed">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══════ 5. Suporte e Ajuda ══════ */}
          <div
            className="glass-card bg-white dark:bg-[#161B22] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-12"
            id="section-suporte"
          >
            <div className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Suporte e Ajuda
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                Canais de atendimento ao cliente
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {/* Left col */}
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                    <Mail className="size-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-1">
                      E-mail
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                      suporte@ravier.com.br
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">
                      Segunda a Sexta, 09h às 18h
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                    <BookOpen className="size-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-1">
                      Central de Ajuda
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      Acesse nossa base de conhecimento completa.
                    </p>
                    <button className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase mt-3 tracking-widest hover:text-emerald-700 transition-colors">
                      Acessar Documentação
                    </button>
                  </div>
                </div>
              </div>
              {/* Right col */}
              <div className="space-y-4">
                <a
                  href="mailto:suporte@ravier.com.br?subject=Relato%20de%20Erro"
                  className="w-full flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-600 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <Bug className="size-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
                      Relatar um problema
                    </span>
                  </div>
                  <ChevronRight className="size-5 text-slate-300" />
                </a>
                <div className="w-full flex items-center justify-between p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800">
                  <div className="flex items-center gap-4">
                    <MessageCircle className="size-5 text-emerald-500" />
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                        Ravi no app
                      </span>
                      <span className="block text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Use o botão flutuante no canto da tela para retomar ou iniciar um
                        atendimento.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          DIALOGS (always mounted)
      ═══════════════════════════════════════════ */}

      {/* Edit Name Dialog */}
      <Dialog open={editandoNome} onOpenChange={setEditandoNome}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10">
                <User className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <DialogTitle className="text-lg sm:text-xl font-semibold">Editar Nome</DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">
                  Altere seu nome de exibição
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={nomeForm.handleSubmit(onSalvarNome)} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="settings-name"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Nome
              </Label>
              <Input
                id="settings-name"
                autoComplete="name"
                className="h-11 rounded-xl"
                {...nomeForm.register("nome")}
              />
              {nomeForm.formState.errors.nome && (
                <p className="text-xs text-red-500">{nomeForm.formState.errors.nome.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-xl bg-emerald-600 font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
              loading={atualizarPerfilMutation.isPending}
            >
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
              Salvar nome
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Income Dialog */}
      <Dialog open={editandoRenda} onOpenChange={setEditandoRenda}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:gap-4 sm:p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 sm:h-12 sm:w-12 sm:rounded-2xl">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="text-lg font-semibold sm:text-xl">
                  Atualizar Renda
                </DialogTitle>
                <DialogDescription className="mt-0.5 truncate text-xs text-muted-foreground sm:text-[13px]">
                  Informe sua renda mensal para personalizar análises e metas
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={rendaForm.handleSubmit(onSalvarRenda)} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="settings-income"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Renda mensal
              </Label>
              <div className="flex items-center gap-3 rounded-xl border border-input bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="text-sm font-bold text-muted-foreground">R$</span>
                <CurrencyInput
                  id="settings-income"
                  name="rendaMensal"
                  autoComplete="off"
                  className="h-auto flex-1 border-none bg-transparent p-0 text-base font-semibold shadow-none focus-visible:ring-0"
                  value={rendaForm.watch("rendaMensal")}
                  onValueChange={(value) =>
                    rendaForm.setValue("rendaMensal", value, { shouldValidate: true })
                  }
                  placeholder="0,00"
                />
              </div>
              {rendaForm.formState.errors.rendaMensal && (
                <p className="text-xs text-red-500">
                  {rendaForm.formState.errors.rendaMensal.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="h-12 w-full gap-2 rounded-xl bg-emerald-600 font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
              loading={atualizarPerfilMutation.isPending}
            >
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
              Salvar renda
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showSenha} onOpenChange={setShowSenha}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:gap-4 sm:p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 sm:h-12 sm:w-12 sm:rounded-2xl">
                <Lock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="text-lg font-semibold sm:text-xl">
                  Alterar Senha
                </DialogTitle>
                <DialogDescription className="mt-0.5 truncate text-xs text-muted-foreground sm:text-[13px]">
                  Informe sua senha atual e a nova senha
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={senhaForm.handleSubmit(onAlterarSenha)} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="settings-current-password"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Senha atual
              </Label>
              <Input
                id="settings-current-password"
                autoComplete="current-password"
                type="password"
                className="h-11 rounded-xl"
                {...senhaForm.register("senhaAtual")}
              />
              {senhaForm.formState.errors.senhaAtual && (
                <p className="text-xs text-red-500">
                  {senhaForm.formState.errors.senhaAtual.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="settings-new-password"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Nova senha
              </Label>
              <Input
                id="settings-new-password"
                autoComplete="new-password"
                type="password"
                className="h-11 rounded-xl"
                {...senhaForm.register("novaSenha")}
              />
              {senhaForm.formState.errors.novaSenha && (
                <p className="text-xs text-red-500">
                  {senhaForm.formState.errors.novaSenha.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="settings-confirm-password"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Confirmar nova senha
              </Label>
              <Input
                id="settings-confirm-password"
                autoComplete="new-password"
                type="password"
                className="h-11 rounded-xl"
                {...senhaForm.register("confirmarSenha")}
              />
              {senhaForm.formState.errors.confirmarSenha && (
                <p className="text-xs text-red-500">
                  {senhaForm.formState.errors.confirmarSenha.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              loading={atualizarPerfilMutation.isPending}
            >
              <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
              Alterar senha
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog
        open={showExcluirConta}
        onOpenChange={(open) => {
          setShowExcluirConta(open);
          if (!open) setExcluirTexto("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Excluir conta permanentemente</DialogTitle>
            <DialogDescription className="sr-only">
              Esta ação é irreversível. Todos os seus dados serão deletados definitivamente.
            </DialogDescription>
            <DialogShellHeader
              icon={<AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Excluir conta permanentemente"
              description="Esta ação é irreversível. Todos os seus dados serão deletados definitivamente."
              tone="rose"
            />
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive/80 space-y-1">
              <p className="font-semibold">Serão excluídos permanentemente:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Todos os lançamentos e transações</li>
                <li>Cartões, metas e limites</li>
                <li>Categorias personalizadas</li>
                <li>Configurações e integração com Telegram</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="settings-delete-confirmation"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Digite <span className="text-foreground font-bold">EXCLUIR MINHA CONTA</span> para
                confirmar:
              </Label>
              <Input
                id="settings-delete-confirmation"
                autoComplete="off"
                value={excluirTexto}
                onChange={(e) => setExcluirTexto(e.target.value)}
                placeholder="EXCLUIR MINHA CONTA"
                className="h-11 rounded-xl font-mono"
                disabled={excluindoConta}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setShowExcluirConta(false);
                  setExcluirTexto("");
                }}
                disabled={excluindoConta}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl font-bold"
                disabled={excluirTexto !== "EXCLUIR MINHA CONTA"}
                loading={excluindoConta}
                onClick={onExcluirConta}
              >
                Excluir definitivamente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
