"use client";

import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import {
  Calendar,
  CheckCircle2,
  DollarSign,
  Edit3,
  Flag,
  Minus,
  MoreVertical,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

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
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAtualizarValorMetaFamilia,
  useCriarMetaFamilia,
  useFamiliaCategoriasComp,
  useFamiliaMetas,
  useRemoverMetaFamilia,
} from "@/hooks/use-queries";
import type { CriarMetaRequest, MetaFinanceira } from "@/lib/api";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { metaSchema, type MetaData } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const DEFAULT_META_VALUES: MetaData = {
  nome: "",
  tipo: "juntar_valor",
  prioridade: "media",
  valorAlvo: "",
  valorAtual: "",
  prazo: "",
  categoria: "",
};

const META_TYPE_CONFIG: Record<
  MetaData["tipo"],
  {
    label: string;
    icon: ReactNode;
    iconClass: string;
  }
> = {
  juntar_valor: {
    label: "Juntar valor",
    icon: <DollarSign className="h-4 w-4" />,
    iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  },
  reduzir_gasto: {
    label: "Reduzir gasto",
    icon: <TrendingDown className="h-4 w-4" />,
    iconClass: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  },
  reserva_mensal: {
    label: "Reserva mensal",
    icon: <Zap className="h-4 w-4" />,
    iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  },
};

const PRIORITY_CONFIG: Record<
  MetaData["prioridade"],
  {
    label: string;
    badgeClass: string;
    iconClass: string;
  }
> = {
  baixa: {
    label: "Baixa",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    iconClass: "text-emerald-500 dark:text-emerald-300",
  },
  media: {
    label: "Media",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    iconClass: "text-amber-500 dark:text-amber-300",
  },
  alta: {
    label: "Alta",
    badgeClass:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
    iconClass: "text-rose-500 dark:text-rose-300",
  },
};

function parseCurrency(value: string) {
  return parseFloat(value.replace(/\./g, "").replace(",", "."));
}

function progressStyle(percent: number) {
  if (percent >= 100) {
    return {
      barClass: "bg-emerald-500",
      textClass: "text-emerald-600 dark:text-emerald-300",
      subtleClass:
        "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    };
  }

  if (percent >= 70) {
    return {
      barClass: "bg-blue-500",
      textClass: "text-blue-600 dark:text-blue-300",
      subtleClass: "border-blue-200 bg-blue-50/70 dark:border-blue-500/20 dark:bg-blue-500/10",
    };
  }

  if (percent >= 40) {
    return {
      barClass: "bg-amber-500",
      textClass: "text-amber-600 dark:text-amber-300",
      subtleClass: "border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10",
    };
  }

  return {
    barClass: "bg-rose-500",
    textClass: "text-rose-600 dark:text-rose-300",
    subtleClass: "border-rose-200 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10",
  };
}

function formatDesvioLabel(desvio: string) {
  if (!desvio) return "Sem referencia";
  if (desvio === "no_ritmo") return "No ritmo";
  return desvio.replace(/_/g, " ");
}

function DesvioIcon({ desvio }: { desvio: string }) {
  if (desvio.includes("adiant")) {
    return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  }

  if (desvio.includes("atras")) {
    return <TrendingDown className="h-3.5 w-3.5 text-rose-500" />;
  }

  return <Minus className="h-3.5 w-3.5 text-amber-500" />;
}

export default function FamiliaMetasPage() {
  const { data: metas = [], isLoading, isError, error, refetch } = useFamiliaMetas();
  const { data: categorias = [] } = useFamiliaCategoriasComp();
  const criarMeta = useCriarMetaFamilia();
  const atualizarValor = useAtualizarValorMetaFamilia();
  const removerMeta = useRemoverMetaFamilia();

  const [showForm, setShowForm] = useState(false);
  const [editMeta, setEditMeta] = useState<MetaFinanceira | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editValor, setEditValor] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);
  const [updateLoadingId, setUpdateLoadingId] = useState<number | null>(null);

  const form = useForm<MetaData>({
    resolver: zodResolver(metaSchema),
    defaultValues: DEFAULT_META_VALUES,
  });

  const tipo = form.watch("tipo");
  const prioridade = form.watch("prioridade");

  const totalAlvo = metas.reduce((sum, item) => sum + item.valorAlvo, 0);
  const totalAtual = metas.reduce((sum, item) => sum + item.valorAtual, 0);
  const progressoMedio =
    metas.length > 0
      ? Math.round(
          metas.reduce((sum, item) => sum + Math.min(item.percentualConcluido, 100), 0) /
            metas.length
        )
      : 0;
  const totalMensalNecessario = metas.reduce((sum, item) => sum + item.valorMensalNecessario, 0);
  const metasConcluidas = metas.filter(
    (item) => item.percentualConcluido >= 100 || item.status.toLowerCase() === "concluida"
  ).length;
  const globalPct = totalAlvo > 0 ? Math.round((totalAtual / totalAlvo) * 100) : 0;

  const openCreateDialog = () => {
    form.reset(DEFAULT_META_VALUES);
    setShowForm(true);
  };

  const openUpdateDialog = (meta: MetaFinanceira) => {
    setEditMeta(meta);
    setEditValor(meta.valorAtual.toFixed(2).replace(".", ","));
  };

  const handleCriar = (data: MetaData) => {
    if (data.tipo === "reduzir_gasto" && !data.categoria) {
      form.setError("categoria", {
        type: "manual",
        message: "Selecione a categoria para a meta de reducao.",
      });
      return;
    }

    const valorAlvo = parseCurrency(data.valorAlvo);
    const valorAtual = data.valorAtual ? parseCurrency(data.valorAtual) : 0;

    const request: CriarMetaRequest = {
      nome: data.nome.trim(),
      tipo: data.tipo,
      valorAlvo,
      valorAtual,
      prazo: data.prazo,
      prioridade: data.prioridade,
      categoria: data.tipo === "reduzir_gasto" ? data.categoria : undefined,
    };

    criarMeta.mutate(request, {
      onSuccess: () => {
        form.reset(DEFAULT_META_VALUES);
        setShowForm(false);
      },
    });
  };

  const handleAtualizarValor = () => {
    if (!editMeta) return;

    const valorAtual = parseCurrency(editValor);
    if (Number.isNaN(valorAtual)) return;

    setUpdateLoadingId(editMeta.id);
    atualizarValor.mutate(
      { id: editMeta.id, valorAtual },
      {
        onSuccess: () => setEditMeta(null),
        onSettled: () => setUpdateLoadingId(null),
      }
    );
  };

  const handleRemover = () => {
    if (!deleteId) return;

    setDeleteLoadingId(deleteId);
    removerMeta.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
      onSettled: () => setDeleteLoadingId(null),
    });
  };

  return (
    <FamilyShell>
      <FamilyHero
        icon={<Target className="h-6 w-6" />}
        title="Metas conjuntas"
        description="Crie objetivos compartilhados, acompanhe o progresso da familia e ajuste o valor acumulado sem sair do modulo colaborativo."
        eyebrow="Modulo Familia"
        backHref="/familia"
        backLabel="Familia"
        tone="amber"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="w-full justify-center gap-2 rounded-xl sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <FamilyPrimaryAction size="sm" onClick={openCreateDialog} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Nova meta
            </FamilyPrimaryAction>
          </>
        }
      />

      {isLoading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message ?? "Erro ao carregar metas"} onRetry={refetch} />
      ) : metas.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FamilyMetricCard
              title="Metas ativas"
              value={String(metas.length)}
              subtitle={`${metasConcluidas} concluidas e ${Math.max(metas.length - metasConcluidas, 0)} em andamento`}
              icon={<Target className="h-5 w-5" />}
              tone="amber"
            />
            <FamilyMetricCard
              title="Valor acumulado"
              value={formatCurrency(totalAtual)}
              subtitle={`${globalPct}% do objetivo total`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              tone="emerald"
              delay={0.05}
            />
            <FamilyMetricCard
              title="Objetivo total"
              value={formatCurrency(totalAlvo)}
              subtitle={`${progressoMedio}% de progresso medio`}
              icon={<DollarSign className="h-5 w-5" />}
              tone="blue"
              delay={0.1}
            />
            <FamilyMetricCard
              title="Aporte mensal"
              value={formatCurrency(totalMensalNecessario)}
              subtitle="Necessario para sustentar o ritmo atual"
              icon={<TrendingUp className="h-5 w-5" />}
              tone="slate"
              delay={0.15}
            />
          </div>

          <FamilyPanel
            title="Mapa de metas"
            description="Cada card mostra prazo, progresso, prioridade e o valor atual registrado para a meta compartilhada."
            icon={<Target className="h-5 w-5" />}
            tone="amber"
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence>
                {metas.map((meta, index) => {
                  const typeInfo =
                    META_TYPE_CONFIG[meta.tipo as keyof typeof META_TYPE_CONFIG] ??
                    META_TYPE_CONFIG.juntar_valor;
                  const priorityInfo =
                    PRIORITY_CONFIG[meta.prioridade as keyof typeof PRIORITY_CONFIG] ??
                    PRIORITY_CONFIG.media;
                  const progress = progressStyle(Math.min(meta.percentualConcluido, 100));

                  return (
                    <motion.article
                      key={meta.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ delay: index * 0.04, duration: 0.35 }}
                      className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/70 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/8 dark:bg-slate-900/35"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                            typeInfo.iconClass
                          )}
                        >
                          {typeInfo.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {meta.nome}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {typeInfo.label}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="rounded-xl"
                              aria-label={`Abrir acoes da meta ${meta.nome}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => openUpdateDialog(meta)}
                              className="gap-2"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Atualizar valor
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(meta.id)}
                              className="gap-2 text-rose-600 focus:text-rose-600 dark:text-rose-300 dark:focus:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover meta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                            priorityInfo.badgeClass
                          )}
                        >
                          <Flag className={cn("h-3.5 w-3.5", priorityInfo.iconClass)} />
                          {priorityInfo.label}
                        </span>
                        {meta.categoriaNome && (
                          <span className="inline-flex rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                            {meta.categoriaNome}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className={cn("rounded-[1.25rem] border p-3", progress.subtleClass)}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Valor atual
                          </p>
                          <p className={cn("mt-2 text-lg font-semibold", progress.textClass)}>
                            {formatCurrency(meta.valorAtual)}
                          </p>
                        </div>
                        <div className="rounded-[1.25rem] border border-slate-200/70 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Objetivo
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(meta.valorAlvo)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Progresso
                          </span>
                          <span className={cn("text-sm font-semibold", progress.textClass)}>
                            {meta.percentualConcluido.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              progress.barClass
                            )}
                            style={{ width: `${Math.min(meta.percentualConcluido, 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{formatCurrency(meta.valorAtual)}</span>
                          <span>{formatCurrency(meta.valorAlvo)}</span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.25rem] border border-slate-200/70 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Prazo
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                            {formatShortDate(meta.prazo)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {meta.mesesRestantes > 0
                              ? `${meta.mesesRestantes} meses restantes`
                              : "Prazo em andamento"}
                          </p>
                        </div>
                        <div className="rounded-[1.25rem] border border-slate-200/70 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Ritmo
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <DesvioIcon desvio={meta.desvio} />
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {formatDesvioLabel(meta.desvio)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Mensal sugerido: {formatCurrency(meta.valorMensalNecessario)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          className="h-10 flex-1 rounded-xl"
                          onClick={() => openUpdateDialog(meta)}
                        >
                          <Edit3 className="h-4 w-4" />
                          Atualizar valor
                        </Button>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          </FamilyPanel>
        </>
      ) : (
        <FamilyPanel tone="slate" className="p-10 lg:p-12">
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="Nenhuma meta conjunta"
            description="Crie objetivos compartilhados para acompanhar poupanca, reducao de gastos e reservas mensais em familia."
            action={
              <FamilyPrimaryAction onClick={openCreateDialog} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Criar meta
              </FamilyPrimaryAction>
            }
          />
        </FamilyPanel>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Nova meta</DialogTitle>
            <DialogDescription className="sr-only">
              Cadastre uma meta compartilhada para a familia.
            </DialogDescription>
            <FamilyDialogHeader
              icon={<Target className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Nova meta conjunta"
              description="Defina objetivo, prioridade, prazo e o valor atual ja acumulado."
              tone="amber"
            />
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleCriar)} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="familia-meta-nome"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Nome da meta
              </Label>
              <Input
                id="familia-meta-nome"
                placeholder="Ex: Reserva para viagem"
                {...form.register("nome")}
                aria-invalid={Boolean(form.formState.errors.nome)}
                className={cn("h-11 rounded-xl", form.formState.errors.nome && "border-rose-500")}
              />
              {form.formState.errors.nome && (
                <p className="text-xs font-medium text-rose-500">
                  {form.formState.errors.nome.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Tipo
                </Label>
                <div className="grid gap-2">
                  {(
                    Object.entries(META_TYPE_CONFIG) as Array<
                      [MetaData["tipo"], (typeof META_TYPE_CONFIG)[MetaData["tipo"]]]
                    >
                  ).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={tipo === key}
                      onClick={() => {
                        form.setValue("tipo", key, { shouldValidate: true });
                        if (key !== "reduzir_gasto") {
                          form.setValue("categoria", "");
                          form.clearErrors("categoria");
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-[1.25rem] border p-3 text-left transition-colors",
                        tipo === key
                          ? "border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10"
                          : "border-slate-200/70 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/15"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          item.iconClass
                        )}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {key === "juntar_valor"
                            ? "Objetivo com valor final definido."
                            : key === "reduzir_gasto"
                              ? "Meta de reducao associada a uma categoria."
                              : "Reserva recorrente ao longo do prazo."}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Prioridade
                </Label>
                <div className="grid gap-2">
                  {(
                    Object.entries(PRIORITY_CONFIG) as Array<
                      [MetaData["prioridade"], (typeof PRIORITY_CONFIG)[MetaData["prioridade"]]]
                    >
                  ).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={prioridade === key}
                      onClick={() => form.setValue("prioridade", key, { shouldValidate: true })}
                      className={cn(
                        "flex items-center justify-between rounded-[1.25rem] border p-3 text-left transition-colors",
                        prioridade === key
                          ? item.badgeClass
                          : "border-slate-200/70 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/15"
                      )}
                    >
                      <span className="text-sm font-semibold">{item.label}</span>
                      <Flag className={cn("h-4 w-4", item.iconClass)} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="familia-meta-valor-alvo"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Valor alvo
                </Label>
                <div className="relative">
                  <div className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-l-xl border-r border-amber-200/70 bg-amber-50 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                    R$
                  </div>
                  <CurrencyInput
                    id="familia-meta-valor-alvo"
                    value={form.watch("valorAlvo")}
                    onValueChange={(value) =>
                      form.setValue("valorAlvo", value, {
                        shouldValidate: form.formState.isSubmitted,
                      })
                    }
                    aria-invalid={Boolean(form.formState.errors.valorAlvo)}
                    className={cn(
                      "h-11 rounded-xl pl-12 font-semibold tabular-nums",
                      form.formState.errors.valorAlvo && "border-rose-500"
                    )}
                  />
                </div>
                {form.formState.errors.valorAlvo && (
                  <p className="text-xs font-medium text-rose-500">
                    {form.formState.errors.valorAlvo.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="familia-meta-valor-atual"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Valor atual
                </Label>
                <div className="relative">
                  <div className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-l-xl border-r border-emerald-200/70 bg-emerald-50 text-xs font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                    R$
                  </div>
                  <CurrencyInput
                    id="familia-meta-valor-atual"
                    value={form.watch("valorAtual") ?? ""}
                    onValueChange={(value) =>
                      form.setValue("valorAtual", value, {
                        shouldValidate: form.formState.isSubmitted,
                      })
                    }
                    className="h-11 rounded-xl pl-12 font-semibold tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="familia-meta-prazo"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Prazo
                </Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    id="familia-meta-prazo"
                    type="date"
                    {...form.register("prazo")}
                    aria-invalid={Boolean(form.formState.errors.prazo)}
                    className={cn(
                      "h-11 rounded-xl pl-10",
                      form.formState.errors.prazo && "border-rose-500"
                    )}
                  />
                </div>
                {form.formState.errors.prazo && (
                  <p className="text-xs font-medium text-rose-500">
                    {form.formState.errors.prazo.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="familia-meta-categoria"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Categoria
                </Label>
                <Select
                  value={form.watch("categoria") || ""}
                  onValueChange={(value) => {
                    form.setValue("categoria", value, { shouldValidate: true });
                    form.clearErrors("categoria");
                  }}
                  disabled={tipo !== "reduzir_gasto"}
                >
                  <SelectTrigger
                    id="familia-meta-categoria"
                    aria-invalid={Boolean(form.formState.errors.categoria)}
                    className="h-11 rounded-xl"
                  >
                    <SelectValue
                      placeholder={
                        tipo === "reduzir_gasto"
                          ? "Selecione a categoria"
                          : "Disponivel apenas para reducao"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.nome}>
                        {categoria.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tipo === "reduzir_gasto" && categorias.length === 0 && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                    Crie ou compartilhe categorias antes de cadastrar uma meta de reducao.
                  </p>
                )}
                {form.formState.errors.categoria && (
                  <p className="text-xs font-medium text-rose-500">
                    {form.formState.errors.categoria.message}
                  </p>
                )}
              </div>
            </div>

            <FamilyPrimaryAction
              type="submit"
              loading={criarMeta.isPending}
              className="h-12 w-full"
            >
              <Target className="h-5 w-5" />
              Criar meta conjunta
            </FamilyPrimaryAction>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editMeta !== null} onOpenChange={(open) => !open && setEditMeta(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Atualizar valor da meta</DialogTitle>
            <DialogDescription className="sr-only">
              Atualize o valor acumulado da meta selecionada.
            </DialogDescription>
            <FamilyDialogHeader
              icon={<Edit3 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Atualizar valor"
              description={editMeta ? `Meta: ${editMeta.nome}` : "Ajuste o valor atual da meta."}
              tone="amber"
            />
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="familia-meta-valor-atual-edit"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Valor atual
              </Label>
              <div className="relative">
                <div className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-l-xl border-r border-amber-200/70 bg-amber-50 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  R$
                </div>
                <CurrencyInput
                  id="familia-meta-valor-atual-edit"
                  value={editValor}
                  onValueChange={setEditValor}
                  className="h-11 rounded-xl pl-12 font-semibold tabular-nums"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditMeta(null)}
                className="h-12 flex-1 rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <FamilyPrimaryAction
                onClick={handleAtualizarValor}
                loading={updateLoadingId === editMeta?.id}
                className="h-12 flex-1"
              >
                <CheckCircle2 className="h-5 w-5" />
                Salvar valor
              </FamilyPrimaryAction>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">Remover meta conjunta?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              A meta sera removida do plano compartilhado e o historico atual nao podera ser
              restaurado automaticamente.
            </AlertDialogDescription>
            <FamilyDialogHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Remover meta conjunta?"
              description="A meta sera removida do plano compartilhado e o historico atual nao podera ser restaurado automaticamente."
              tone="rose"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemover}
              loading={deleteLoadingId === deleteId}
              className="gap-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FamilyShell>
  );
}
