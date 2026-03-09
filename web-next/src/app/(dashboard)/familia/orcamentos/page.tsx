"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Gauge,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  XCircle,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useAtualizarOrcamentoFamilia,
  useCriarOrcamentoFamilia,
  useFamiliaCategoriasComp,
  useFamiliaOrcamentos,
  useRemoverOrcamentoFamilia,
} from "@/hooks/use-queries";
import type { OrcamentoFamiliar } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type BudgetStatus = "ok" | "attention" | "critical" | "exceeded";

const STATUS_CONFIG: Record<
  BudgetStatus,
  {
    label: string;
    icon: ReactNode;
    badgeClass: string;
    iconClass: string;
    progressClass: string;
    subtleClass: string;
  }
> = {
  ok: {
    label: "Saudavel",
    icon: <CheckCircle2 className="h-4 w-4" />,
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    iconClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    progressClass: "bg-emerald-500",
    subtleClass:
      "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10",
  },
  attention: {
    label: "Atencao",
    icon: <AlertTriangle className="h-4 w-4" />,
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    iconClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    progressClass: "bg-amber-500",
    subtleClass:
      "border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10",
  },
  critical: {
    label: "Critico",
    icon: <AlertTriangle className="h-4 w-4" />,
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
    iconClass: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300",
    progressClass: "bg-orange-500",
    subtleClass:
      "border-orange-200 bg-orange-50/70 dark:border-orange-500/20 dark:bg-orange-500/10",
  },
  exceeded: {
    label: "Excedido",
    icon: <XCircle className="h-4 w-4" />,
    badgeClass:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
    iconClass: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    progressClass: "bg-rose-500",
    subtleClass:
      "border-rose-200 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10",
  },
};

function parseCurrency(value: string) {
  return parseFloat(value.replace(/\./g, "").replace(",", "."));
}

function statusFromPercent(percent: number): BudgetStatus {
  if (percent >= 100) return "exceeded";
  if (percent >= 90) return "critical";
  if (percent >= 70) return "attention";
  return "ok";
}

function openBudgetStateLabel(ativo: boolean) {
  return ativo ? "Ativo" : "Pausado";
}

export default function FamiliaOrcamentosPage() {
  const { data: orcamentos = [], isLoading, isError, error, refetch } = useFamiliaOrcamentos();
  const { data: categorias = [] } = useFamiliaCategoriasComp();
  const criarOrcamento = useCriarOrcamentoFamilia();
  const atualizarOrcamento = useAtualizarOrcamentoFamilia();
  const removerOrcamento = useRemoverOrcamentoFamilia();

  const [showForm, setShowForm] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [valorLimite, setValorLimite] = useState("");
  const [editOrcamento, setEditOrcamento] = useState<OrcamentoFamiliar | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editAtivo, setEditAtivo] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const categoriasDisponiveis = categorias.filter(
    (categoria) => !orcamentos.some((orcamento) => orcamento.categoriaId === categoria.id)
  );
  const orcamentosAtivos = orcamentos.filter((item) => item.ativo);
  const totalLimite = orcamentosAtivos.reduce((sum, item) => sum + item.valorLimite, 0);
  const totalGasto = orcamentosAtivos.reduce((sum, item) => sum + item.gastoAtual, 0);
  const avgUse =
    orcamentosAtivos.length > 0
      ? Math.round(
          orcamentosAtivos.reduce((sum, item) => sum + item.percentualConsumido, 0) /
            orcamentosAtivos.length
        )
      : 0;
  const alertas = orcamentosAtivos.filter(
    (item) => statusFromPercent(item.percentualConsumido) !== "ok"
  ).length;

  const openCreateDialog = () => {
    setCategoriaId("");
    setValorLimite("");
    setShowForm(true);
  };

  const openEditDialog = (orcamento: OrcamentoFamiliar) => {
    setEditOrcamento(orcamento);
    setEditValor(orcamento.valorLimite.toFixed(2).replace(".", ","));
    setEditAtivo(orcamento.ativo);
  };

  const handleCriar = () => {
    const parsedCategoriaId = parseInt(categoriaId, 10);
    const parsedValorLimite = parseCurrency(valorLimite);

    if (Number.isNaN(parsedCategoriaId) || Number.isNaN(parsedValorLimite) || parsedValorLimite <= 0) {
      return;
    }

    criarOrcamento.mutate(
      { categoriaId: parsedCategoriaId, valorLimite: parsedValorLimite },
      {
        onSuccess: () => {
          setCategoriaId("");
          setValorLimite("");
          setShowForm(false);
        },
      }
    );
  };

  const handleAtualizar = () => {
    if (!editOrcamento) return;

    const parsedValorLimite = parseCurrency(editValor);
    if (Number.isNaN(parsedValorLimite) || parsedValorLimite <= 0) return;

    atualizarOrcamento.mutate(
      {
        id: editOrcamento.id,
        data: { valorLimite: parsedValorLimite, ativo: editAtivo },
      },
      {
        onSuccess: () => setEditOrcamento(null),
      }
    );
  };

  const handleRemover = () => {
    if (!deleteId) return;

    removerOrcamento.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  };

  return (
    <FamilyShell>
      <FamilyHero
        icon={<Receipt className="h-6 w-6" />}
        title="Orcamentos familiares"
        description="Defina limites por categoria, acompanhe a pressao de consumo e ajuste o plano compartilhado no mesmo layout do restante do modulo."
        eyebrow="Modulo Familia"
        backHref="/familia"
        backLabel="Familia"
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
            <FamilyPrimaryAction
              size="sm"
              onClick={openCreateDialog}
              disabled={categoriasDisponiveis.length === 0}
            >
              <Plus className="h-4 w-4" />
              Novo orcamento
            </FamilyPrimaryAction>
          </>
        }
      />

      {isLoading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message ?? "Erro ao carregar orcamentos"} onRetry={refetch} />
      ) : orcamentos.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FamilyMetricCard
              title="Orcamentos ativos"
              value={String(orcamentosAtivos.length)}
              subtitle={`${orcamentos.length - orcamentosAtivos.length} pausados no momento`}
              icon={<PiggyBank className="h-5 w-5" />}
              tone="emerald"
            />
            <FamilyMetricCard
              title="Limite total"
              value={formatCurrency(totalLimite)}
              subtitle="Soma apenas dos orcamentos ativos"
              icon={<Receipt className="h-5 w-5" />}
              tone="blue"
              delay={0.05}
            />
            <FamilyMetricCard
              title="Gasto atual"
              value={formatCurrency(totalGasto)}
              subtitle={`${Math.max(totalLimite - totalGasto, 0) > 0 ? formatCurrency(Math.max(totalLimite - totalGasto, 0)) : "Sem margem"} restante`}
              icon={<Gauge className="h-5 w-5" />}
              tone={totalGasto <= totalLimite ? "amber" : "rose"}
              delay={0.1}
            />
            <FamilyMetricCard
              title="Uso medio"
              value={`${avgUse}%`}
              subtitle={`${alertas} categoria${alertas === 1 ? "" : "s"} exigindo atencao`}
              icon={<AlertTriangle className="h-5 w-5" />}
              tone="slate"
              delay={0.15}
            />
          </div>

          <FamilyPanel
            title="Controle por categoria"
            description="Revise gasto atual, limite, disponibilidade e o estado de cada orcamento compartilhado."
            icon={<Receipt className="h-5 w-5" />}
            tone="emerald"
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence>
                {orcamentos.map((orcamento, index) => {
                  const status = STATUS_CONFIG[statusFromPercent(orcamento.percentualConsumido)];
                  const disponivel = Math.max(orcamento.valorLimite - orcamento.gastoAtual, 0);
                  const excedente = Math.max(orcamento.gastoAtual - orcamento.valorLimite, 0);

                  return (
                    <motion.article
                      key={orcamento.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ delay: index * 0.04, duration: 0.35 }}
                      className={cn(
                        "rounded-[1.75rem] border border-slate-200/70 bg-slate-50/70 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/8 dark:bg-slate-900/35",
                        !orcamento.ativo && "opacity-75"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                            status.iconClass
                          )}
                        >
                          {status.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {orcamento.categoriaNome}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                                status.badgeClass
                              )}
                            >
                              {status.label}
                            </span>
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                                orcamento.ativo
                                  ? "border-emerald-200 bg-white/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                                  : "border-slate-200 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                              )}
                            >
                              {openBudgetStateLabel(orcamento.ativo)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-xl"
                            aria-label="Editar orcamento"
                            onClick={() => openEditDialog(orcamento)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-xl text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                            aria-label="Remover orcamento"
                            onClick={() => setDeleteId(orcamento.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Consumo atual
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {orcamento.percentualConsumido.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              status.progressClass
                            )}
                            style={{ width: `${Math.min(orcamento.percentualConsumido, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div
                          className={cn(
                            "rounded-[1.25rem] border p-3",
                            status.subtleClass
                          )}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Gasto atual
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(orcamento.gastoAtual)}
                          </p>
                        </div>
                        <div className="rounded-[1.25rem] border border-slate-200/70 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Limite
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(orcamento.valorLimite)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.25rem] border border-slate-200/70 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Disponivel
                          </p>
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              excedente > 0
                                ? "text-rose-600 dark:text-rose-300"
                                : "text-emerald-600 dark:text-emerald-300"
                            )}
                          >
                            {formatCurrency(disponivel)}
                          </p>
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {!orcamento.ativo
                            ? "Orcamento pausado. Nenhuma nova comparacao sera exibida ate a reativacao."
                            : excedente > 0
                              ? `Excedido em ${formatCurrency(excedente)} no periodo atual.`
                              : `Ainda restam ${formatCurrency(disponivel)} para essa categoria.`}
                        </p>
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
            icon={<Receipt className="h-6 w-6" />}
            title="Nenhum orcamento compartilhado"
            description="Defina limites por categoria para acompanhar os gastos da familia em um mesmo painel."
            action={
              categorias.length > 0 ? (
                <FamilyPrimaryAction onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Criar orcamento
                </FamilyPrimaryAction>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/familia/categorias">Configurar categorias</Link>
                </Button>
              )
            }
          />
        </FamilyPanel>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Novo orcamento</DialogTitle>
            <DialogDescription className="sr-only">
              Defina um novo limite compartilhado por categoria.
            </DialogDescription>
            <FamilyDialogHeader
              icon={<Receipt className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Novo orcamento"
              description="Escolha a categoria compartilhada e defina o limite mensal."
              tone="emerald"
            />
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Categoria
              </Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasDisponiveis.map((categoria) => (
                    <SelectItem key={categoria.id} value={String(categoria.id)}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoriasDisponiveis.length === 0 && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                  Todas as categorias compartilhadas ja possuem orcamento configurado.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Valor limite
              </Label>
              <div className="relative">
                <div className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-l-xl border-r border-emerald-200/70 bg-emerald-50 text-xs font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  R$
                </div>
                <CurrencyInput
                  value={valorLimite}
                  onValueChange={setValorLimite}
                  className="h-11 rounded-xl pl-12 font-semibold tabular-nums"
                />
              </div>
            </div>

            <FamilyPrimaryAction
              onClick={handleCriar}
              disabled={!categoriaId || !valorLimite}
              loading={criarOrcamento.isPending}
              className="h-12 w-full"
            >
              <Receipt className="h-5 w-5" />
              Criar orcamento
            </FamilyPrimaryAction>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOrcamento !== null} onOpenChange={(open) => !open && setEditOrcamento(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Editar orcamento</DialogTitle>
            <DialogDescription className="sr-only">
              Ajuste limite e estado do orcamento selecionado.
            </DialogDescription>
            <FamilyDialogHeader
              icon={<Edit3 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Editar orcamento"
              description={editOrcamento?.categoriaNome ?? "Ajuste limite e ativacao do orcamento."}
              tone="emerald"
            />
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Valor limite
              </Label>
              <div className="relative">
                <div className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-l-xl border-r border-emerald-200/70 bg-emerald-50 text-xs font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  R$
                </div>
                <CurrencyInput
                  value={editValor}
                  onValueChange={setEditValor}
                  className="h-11 rounded-xl pl-12 font-semibold tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[1.25rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/5">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Orcamento ativo</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Quando pausado, o card continua visivel mas sai do consolidado principal.
                </p>
              </div>
              <Switch checked={editAtivo} onCheckedChange={setEditAtivo} />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditOrcamento(null)}
                className="h-12 flex-1 rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <FamilyPrimaryAction
                onClick={handleAtualizar}
                loading={atualizarOrcamento.isPending}
                className="h-12 flex-1"
              >
                Salvar
              </FamilyPrimaryAction>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">Remover orcamento?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              A categoria perdera o limite compartilhado atual. O historico de gastos nao sera
              apagado, mas o controle deixara de existir ate um novo cadastro.
            </AlertDialogDescription>
            <FamilyDialogHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Remover orcamento?"
              description="A categoria perdera o limite compartilhado atual. O historico de gastos nao sera apagado, mas o controle deixara de existir ate um novo cadastro."
              tone="rose"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemover}
              loading={removerOrcamento.isPending}
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
