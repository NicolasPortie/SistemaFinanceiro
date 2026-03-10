"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  FolderOpen,
  LogOut,
  Mail,
  PiggyBank,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldOff,
  User,
  UserX,
  Users,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import {
  useAceitarRecursoFamilia,
  useAtivarRecursoFamilia,
  useCancelarConviteFamilia,
  useDesativarRecursoFamilia,
  useEnviarConviteFamilia,
  useFamilia,
  useFamiliaRecursos,
  useRecusarRecursoFamilia,
  useRemoverMembroFamilia,
  useSairDaFamilia,
} from "@/hooks/use-queries";
import {
  FamilyDialogHeader,
  FamilyHero,
  FamilyMetricCard,
  FamilyPanel,
  FamilyPrimaryAction,
  FamilyShell,
} from "@/components/familia/family-layout";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/shared/page-components";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const statusFamiliaConfig: Record<
  string,
  {
    label: string;
    color: string;
  }
> = {
  Ativa: {
    label: "Ativa",
    color:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  Pendente: {
    label: "Pendente",
    color:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
  },
  Desativada: {
    label: "Desativada",
    color:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300",
  },
};

const statusConviteConfig: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
  }
> = {
  Pendente: {
    label: "Pendente",
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "text-amber-600 dark:text-amber-300",
  },
  Aceito: {
    label: "Aceito",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-emerald-600 dark:text-emerald-300",
  },
  Recusado: {
    label: "Recusado",
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "text-red-600 dark:text-red-300",
  },
  Expirado: {
    label: "Expirado",
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "text-slate-500 dark:text-slate-400",
  },
  Cancelado: {
    label: "Cancelado",
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "text-slate-500 dark:text-slate-400",
  },
};

const recursoLabels: Record<
  string,
  {
    label: string;
    desc: string;
    icon: React.ReactNode;
  }
> = {
  CategoriasCompartilhadas: {
    label: "Categorias Compartilhadas",
    desc: "Compartilhe categorias para manter a mesma estrutura financeira entre titular e membro.",
    icon: <FolderOpen className="h-5 w-5" />,
  },
  OrcamentoFamiliar: {
    label: "Orçamento Familiar",
    desc: "Defina limites em conjunto e acompanhe o uso da família em uma única visão.",
    icon: <PiggyBank className="h-5 w-5" />,
  },
  ContasFixasCompartilhadas: {
    label: "Contas Fixas Compartilhadas",
    desc: "Distribua compromissos recorrentes e mantenha lembretes sincronizados.",
    icon: <Receipt className="h-5 w-5" />,
  },
};

const statusRecursoConfig: Record<
  string,
  {
    label: string;
    badgeClass: string;
  }
> = {
  Desativado: {
    label: "Desativado",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  },
  PendenteAceite: {
    label: "Pendente",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  },
  Ativo: {
    label: "Ativo",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  Recusado: {
    label: "Recusado",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  },
};

const quickLinks = [
  {
    href: "/familia/dashboard",
    label: "Dashboard Familiar",
    description: "Veja receitas, despesas e a contribuição de cada pessoa.",
    icon: Users,
    toneClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  {
    href: "/familia/metas",
    label: "Metas Conjuntas",
    description: "Crie objetivos em conjunto e acompanhe o progresso.",
    icon: PiggyBank,
    toneClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  },
  {
    href: "/familia/categorias",
    label: "Categorias",
    description: "Mantenha a mesma taxonomia financeira entre os membros.",
    icon: FolderOpen,
    toneClass: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  },
  {
    href: "/familia/orcamentos",
    label: "Orçamentos",
    description: "Defina limites compartilhados por categoria.",
    icon: Receipt,
    toneClass: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  },
] as const;

export default function FamiliaPage() {
  const { usuario } = useAuth();
  const { data: familia, isLoading, isError, error, refetch } = useFamilia();
  const { data: recursos = [] } = useFamiliaRecursos();
  const enviarConvite = useEnviarConviteFamilia();
  const cancelarConvite = useCancelarConviteFamilia();
  const removerMembro = useRemoverMembroFamilia();
  const sairFamilia = useSairDaFamilia();
  const ativarRecurso = useAtivarRecursoFamilia();
  const aceitarRecurso = useAceitarRecursoFamilia();
  const recusarRecurso = useRecusarRecursoFamilia();
  const desativarRecurso = useDesativarRecursoFamilia();

  const [showConvite, setShowConvite] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmRemover, setConfirmRemover] = useState(false);
  const [confirmSair, setConfirmSair] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const isTitular = familia ? familia.titularId === usuario?.id : false;
  const isMembro = familia ? familia.membroId === usuario?.id : false;
  const isAtiva = familia?.status === "Ativa";
  const convitePendente = familia?.convitePendente?.status === "Pendente";
  const recursosAtivos = recursos.filter((item) => item.status === "Ativo").length;
  const recursosPendentes = recursos.filter((item) => item.status === "PendenteAceite").length;
  const pendenciasTotais = recursosPendentes + (convitePendente ? 1 : 0);
  const papelAtual = isTitular ? "Titular" : isMembro ? "Membro" : "Sem papel definido";
  const familiaDesde = familia
    ? new Date(familia.criadoEm).toLocaleDateString("pt-BR", {
        month: "2-digit",
        year: "numeric",
      })
    : null;

  const handleEnviarConvite = () => {
    if (!email.trim()) return;
    enviarConvite.mutate(email.trim(), {
      onSuccess: () => {
        setEmail("");
        setShowConvite(false);
      },
    });
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/familia/convite/${token}`);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const heroDescription = !familia
    ? "Monte a estrutura compartilhada do plano 2 Pessoas, convide o outro membro e libere recursos conjuntos com o mesmo padrão visual do restante do produto."
    : isAtiva
      ? "A família já está ativa. Aqui você controla convites, acompanha o membro conectado e decide quais recursos compartilhados ficam disponíveis."
      : "A estrutura foi criada, mas ainda depende da confirmação do outro membro para virar uma operação compartilhada completa.";

  const showInvitePrimaryAction =
    !familia || (isTitular && !familia.membroNome && !convitePendente);

  return (
    <TooltipProvider>
      <FamilyShell>
        <FamilyHero
          icon={<Users className="h-6 w-6" />}
          title="Plano Família"
          description={heroDescription}
          eyebrow="Plano 2 Pessoas"
          tone="emerald"
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-2 rounded-xl"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
              {showInvitePrimaryAction && (
                <FamilyPrimaryAction size="sm" onClick={() => setShowConvite(true)}>
                  <Send className="h-4 w-4" />
                  Enviar convite
                </FamilyPrimaryAction>
              )}
              {isAtiva && (
                <FamilyPrimaryAction size="sm" asChild>
                  <Link href="/familia/dashboard">
                    <Users className="h-4 w-4" />
                    Abrir dashboard
                  </Link>
                </FamilyPrimaryAction>
              )}
            </>
          }
        >
          {familia && (
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
                  statusFamiliaConfig[familia.status]?.color ?? statusFamiliaConfig.Pendente.color
                )}
              >
                {statusFamiliaConfig[familia.status]?.label ?? familia.status}
              </span>
              <span className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-white/8 dark:bg-white/4 dark:text-slate-300">
                Você atua como {papelAtual}
              </span>
              {familiaDesde && (
                <span className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-white/8 dark:bg-white/4 dark:text-slate-300">
                  Família desde {familiaDesde}
                </span>
              )}
            </div>
          )}
        </FamilyHero>

        {isLoading ? (
          <CardSkeleton count={4} />
        ) : isError ? (
          <ErrorState message={error?.message ?? "Erro ao carregar família"} onRetry={refetch} />
        ) : !familia ? (
          <FamilyPanel tone="slate" className="p-10 lg:p-12">
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Nenhuma família configurada"
              description="Convide um membro para começar a compartilhar metas, categorias e orçamentos em um único fluxo."
              action={
                <FamilyPrimaryAction onClick={() => setShowConvite(true)}>
                  <Send className="h-4 w-4" />
                  Iniciar estrutura
                </FamilyPrimaryAction>
              }
            />
          </FamilyPanel>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FamilyMetricCard
                title="Status Atual"
                value={statusFamiliaConfig[familia.status]?.label ?? familia.status}
                subtitle={
                  isAtiva
                    ? "Estrutura pronta para uso conjunto"
                    : "Aguardando confirmação do outro membro"
                }
                icon={<Users className="h-5 w-5" />}
                tone="emerald"
              />
              <FamilyMetricCard
                title="Composição"
                value={familia.membroNome ? "2 pessoas" : "1 de 2"}
                subtitle={familia.membroNome ?? "Slot do membro ainda aberto"}
                icon={<User className="h-5 w-5" />}
                tone="blue"
                delay={0.05}
              />
              <FamilyMetricCard
                title="Recursos Ativos"
                value={String(recursosAtivos)}
                subtitle={
                  recursosAtivos > 0
                    ? "Fluxos compartilhados já disponíveis"
                    : "Nenhum recurso compartilhado ativo"
                }
                icon={<ShieldCheck className="h-5 w-5" />}
                tone="amber"
                delay={0.1}
              />
              <FamilyMetricCard
                title="Pendências"
                value={String(pendenciasTotais)}
                subtitle={
                  pendenciasTotais > 0
                    ? "Convites ou recursos aguardando ação"
                    : "Nada pendente neste momento"
                }
                icon={<Clock className="h-5 w-5" />}
                tone="slate"
                delay={0.15}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <FamilyPanel
                title="Estrutura da família"
                description="O titular controla o plano e pode convidar ou remover o membro. O membro aceita recursos compartilhados e participa dos fluxos ativos."
                icon={<Users className="h-5 w-5" />}
                tone="blue"
              >
                <div className="space-y-4">
                  <div className="rounded-[1.75rem] border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-500/15 dark:bg-amber-500/8">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/12 dark:text-amber-300">
                        <Crown className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {familia.titularNome}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Titular do plano
                        </p>
                      </div>
                      {isTitular && (
                        <span className="rounded-full border border-amber-200 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                          Você
                        </span>
                      )}
                    </div>
                  </div>

                  {familia.membroNome ? (
                    <div className="rounded-[1.75rem] border border-blue-200/70 bg-blue-50/60 p-4 dark:border-blue-500/15 dark:bg-blue-500/8">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {familia.membroNome}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Membro conectado
                          </p>
                        </div>
                        {isMembro && (
                          <span className="rounded-full border border-blue-200 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                            Você
                          </span>
                        )}
                        {isTitular && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setConfirmRemover(true)}
                                aria-label="Remover membro"
                                className="rounded-xl border border-transparent p-2 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-500/15 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                              >
                                <UserX className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Remover membro</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/30">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              Nenhum membro conectado
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              O segundo slot do plano ainda está disponível.
                            </p>
                          </div>
                        </div>
                        {isTitular && (
                          <Button variant="outline" size="sm" onClick={() => setShowConvite(true)}>
                            <Send className="h-4 w-4" />
                            Convidar membro
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {isTitular && !familia.membroNome && (
                      <FamilyPrimaryAction size="sm" onClick={() => setShowConvite(true)}>
                        <Send className="h-4 w-4" />
                        Enviar convite
                      </FamilyPrimaryAction>
                    )}
                    {isMembro && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmSair(true)}
                        className="gap-2 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                      >
                        <LogOut className="h-4 w-4" />
                        Sair da família
                      </Button>
                    )}
                  </div>
                </div>
              </FamilyPanel>

              <FamilyPanel
                title="Convites e vínculo"
                description="Quando existir um convite pendente, ele fica visível aqui com link de compartilhamento, status e data de expiração."
                icon={<Mail className="h-5 w-5" />}
                tone="slate"
              >
                {familia.convitePendente ? (
                  <div className="space-y-4">
                    <div className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/8 dark:bg-slate-900/35">
                      <div className="space-y-3">
                        <InfoRow label="E-mail" value={familia.convitePendente.email} />
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Status
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-semibold",
                              statusConviteConfig[familia.convitePendente.status]?.color
                            )}
                          >
                            {statusConviteConfig[familia.convitePendente.status]?.icon}
                            {statusConviteConfig[familia.convitePendente.status]?.label ??
                              familia.convitePendente.status}
                          </span>
                        </div>
                        <InfoRow
                          label="Expira em"
                          value={new Date(familia.convitePendente.expiraEm).toLocaleDateString(
                            "pt-BR"
                          )}
                        />
                      </div>
                    </div>

                    {convitePendente && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={`${typeof window !== "undefined" ? window.location.origin : ""}/familia/convite/${familia.convitePendente.token}`}
                            className="h-10 rounded-xl bg-slate-50/70 text-xs dark:bg-slate-900/30"
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 rounded-xl"
                                aria-label="Copiar link do convite"
                                onClick={() => handleCopyToken(familia.convitePendente!.token)}
                              >
                                {copiedToken ? (
                                  <Check className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar link do convite</TooltipContent>
                          </Tooltip>
                        </div>
                        {isTitular && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelarConvite.mutate()}
                            loading={cancelarConvite.isPending}
                            className="w-full gap-2 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                          >
                            <XCircle className="h-4 w-4" />
                            Cancelar convite
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/70 p-5 text-center dark:border-white/10 dark:bg-slate-900/30">
                    <Mail className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-500" />
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Nenhum convite ativo
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Gere um link quando quiser conectar o outro membro ao plano.
                    </p>
                    {isTitular && !familia.membroNome && (
                      <div className="mt-4">
                        <FamilyPrimaryAction size="sm" onClick={() => setShowConvite(true)}>
                          <Send className="h-4 w-4" />
                          Gerar convite
                        </FamilyPrimaryAction>
                      </div>
                    )}
                  </div>
                )}
              </FamilyPanel>
            </div>

            {isAtiva && (
              <FamilyPanel
                title="Recursos compartilhados"
                description="O titular solicita a ativação e o membro confirma quando o recurso depende de aceite. Nenhum fluxo foi removido nesta migração."
                icon={<ShieldCheck className="h-5 w-5" />}
                tone="emerald"
                delay={0.1}
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(
                    [
                      "CategoriasCompartilhadas",
                      "OrcamentoFamiliar",
                      "ContasFixasCompartilhadas",
                    ] as const
                  ).map((recursoKey, index) => {
                    const recursoAtual = recursos.find((item) => item.recurso === recursoKey);
                    const info = recursoLabels[recursoKey];
                    const statusAtual = recursoAtual?.status ?? "Desativado";
                    const statusConfig =
                      statusRecursoConfig[statusAtual] ?? statusRecursoConfig.Desativado;

                    return (
                      <motion.div
                        key={recursoKey}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 + index * 0.04, duration: 0.35 }}
                        className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/70 p-5 shadow-sm dark:border-white/8 dark:bg-slate-900/35"
                      >
                        <div className="mb-5 flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                            {info.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                              {info.label}
                            </h3>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {info.desc}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                                statusConfig.badgeClass
                              )}
                            >
                              {statusConfig.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {statusAtual === "Desativado" && isTitular && (
                              <FamilyPrimaryAction
                                size="sm"
                                onClick={() => ativarRecurso.mutate(recursoKey)}
                                loading={ativarRecurso.isPending}
                              >
                                <ShieldCheck className="h-4 w-4" />
                                Ativar
                              </FamilyPrimaryAction>
                            )}

                            {statusAtual === "PendenteAceite" && isMembro && (
                              <>
                                <FamilyPrimaryAction
                                  size="sm"
                                  onClick={() => aceitarRecurso.mutate(recursoKey)}
                                  loading={aceitarRecurso.isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Aceitar
                                </FamilyPrimaryAction>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => recusarRecurso.mutate(recursoKey)}
                                  loading={recusarRecurso.isPending}
                                >
                                  <XCircle className="h-4 w-4" />
                                  Recusar
                                </Button>
                              </>
                            )}

                            {statusAtual === "Ativo" && (isTitular || isMembro) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => desativarRecurso.mutate(recursoKey)}
                                loading={desativarRecurso.isPending}
                                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                              >
                                <ShieldOff className="h-4 w-4" />
                                Desativar
                              </Button>
                            )}

                            {statusAtual === "Recusado" && isTitular && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => ativarRecurso.mutate(recursoKey)}
                                loading={ativarRecurso.isPending}
                              >
                                <RefreshCw className="h-4 w-4" />
                                Solicitar novamente
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </FamilyPanel>
            )}

            {isAtiva && (
              <FamilyPanel
                title="Navegação rápida"
                description="As áreas abaixo seguem a mesma regra de compartilhamento e serão migradas para o mesmo padrão visual."
                icon={<FolderOpen className="h-5 w-5" />}
                tone="slate"
                delay={0.15}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {quickLinks.map((item, index) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18 + index * 0.04, duration: 0.35 }}
                    >
                      <Link
                        href={item.href}
                        className="group block rounded-[1.75rem] border border-slate-200/70 bg-slate-50/70 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/8 dark:bg-slate-900/35"
                      >
                        <div
                          className={cn(
                            "mb-4 flex h-11 w-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-105",
                            item.toneClass
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.label}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {item.description}
                        </p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </FamilyPanel>
            )}
          </>
        )}

        <Dialog open={showConvite} onOpenChange={setShowConvite}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="sr-only">Convidar membro</DialogTitle>
              <DialogDescription className="sr-only">
                Envie um convite por e-mail para conectar o outro membro da família.
              </DialogDescription>
              <FamilyDialogHeader
                icon={<Send className="h-5 w-5 sm:h-6 sm:w-6" />}
                title="Convidar membro"
                description="Envie um link de entrada para o outro membro assumir o segundo slot do plano."
                tone="emerald"
              />
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  E-mail do membro
                </Label>
                <Input
                  type="email"
                  placeholder="membro@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  onKeyDown={(e) => e.key === "Enter" && handleEnviarConvite()}
                />
              </div>

              <FamilyPrimaryAction
                onClick={handleEnviarConvite}
                disabled={!email.trim()}
                loading={enviarConvite.isPending}
                className="h-12 w-full"
              >
                <Send className="h-5 w-5" />
                Enviar convite
              </FamilyPrimaryAction>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmRemover} onOpenChange={setConfirmRemover}>
          <AlertDialogContent>
            <AlertDialogHeader className="items-start text-left">
              <AlertDialogTitle className="sr-only">Remover membro?</AlertDialogTitle>
              <AlertDialogDescription className="sr-only">
                O membro será removido da família e todos os recursos compartilhados serão
                desativados. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
              <FamilyDialogHeader
                icon={<UserX className="h-5 w-5 sm:h-6 sm:w-6" />}
                title="Remover membro?"
                description="O membro sera removido da familia e todos os recursos compartilhados serao desativados. Essa acao nao pode ser desfeita."
                tone="rose"
              />
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removerMembro.mutate()}
                loading={removerMembro.isPending}
                className="gap-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <UserX className="h-4 w-4" />
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmSair} onOpenChange={setConfirmSair}>
          <AlertDialogContent>
            <AlertDialogHeader className="items-start text-left">
              <AlertDialogTitle className="sr-only">Sair da família?</AlertDialogTitle>
              <AlertDialogDescription className="sr-only">
                Você será removido da estrutura compartilhada e perderá acesso aos recursos em
                conjunto. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
              <FamilyDialogHeader
                icon={<LogOut className="h-5 w-5 sm:h-6 sm:w-6" />}
                title="Sair da família?"
                description="Você será removido da estrutura compartilhada e perderá acesso aos recursos em conjunto. Essa ação não pode ser desfeita."
                tone="rose"
              />
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => sairFamilia.mutate()}
                loading={sairFamilia.isPending}
                className="gap-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </FamilyShell>
    </TooltipProvider>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}
