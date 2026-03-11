"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, Loader2, Plus, Save, Search, Settings, Users } from "lucide-react";
import { toast } from "sonner";

import {
  api,
  type AtualizarPlanoRequest,
  type AtualizarRecursoRequest,
  type CriarPlanoRequest,
  type PlanoConfigDto,
  type RecursoPlanoDto,
  type TipoPlano,
} from "@/lib/api";
import { ErrorState } from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TIPOS_PLANO: TipoPlano[] = ["Gratuito", "Individual", "Familia"];
const RECURSOS_FAMILIA = new Set([
  "MembrosFamilia",
  "DashboardFamiliar",
  "MetasConjuntas",
  "CategoriasCompartilhadas",
  "OrcamentoFamiliar",
  "ContasFixasCompartilhadas",
]);

const CREATE_FORM_INITIAL: CriarPlanoRequest = {
  tipo: "Individual",
  nome: "",
  descricao: "",
  precoMensal: 0,
  ativo: true,
  trialDisponivel: false,
  diasGratis: 0,
  ordem: 1,
  destaque: false,
  stripePriceId: null,
};

function isFamilyResource(recurso: RecursoPlanoDto) {
  return RECURSOS_FAMILIA.has(recurso.recurso);
}

function splitPlanos(planos: PlanoConfigDto[]) {
  return {
    individual: planos.filter((plano) => plano.tipo !== "Familia"),
    familiar: planos.filter((plano) => plano.tipo === "Familia"),
  };
}

function splitRecursos(recursos: RecursoPlanoDto[]) {
  return {
    individual: recursos.filter((recurso) => !isFamilyResource(recurso)),
    familiar: recursos.filter((recurso) => isFamilyResource(recurso)),
  };
}

export default function AdminPlanosPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<AtualizarPlanoRequest>({
    nome: "",
    descricao: "",
    precoMensal: 0,
    ativo: true,
    trialDisponivel: false,
    diasGratis: 0,
    ordem: 0,
    destaque: false,
    stripePriceId: null,
  });
  const [createForm, setCreateForm] = useState<CriarPlanoRequest>(CREATE_FORM_INITIAL);
  const [limites, setLimites] = useState<Record<string, number>>({});

  const {
    data: planos = [],
    isLoading,
    error,
  } = useQuery<PlanoConfigDto[]>({
    queryKey: ["admin", "planos"],
    queryFn: () => api.admin.planos.listar(),
  });

  const atualizarPlano = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AtualizarPlanoRequest }) =>
      api.admin.planos.atualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "planos"] });
      toast.success("Plano atualizado com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const atualizarRecursos = useMutation({
    mutationFn: ({ id, recursos }: { id: number; recursos: AtualizarRecursoRequest[] }) =>
      api.admin.planos.atualizarRecursos(id, recursos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "planos"] });
      toast.success("Recursos atualizados.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const criarPlano = useMutation({
    mutationFn: (data: CriarPlanoRequest) => api.admin.planos.criar(data),
    onSuccess: (novoPlano) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "planos"] });
      setSelectedId(novoPlano.id);
      setIsCreateOpen(false);
      toast.success("Plano criado com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredPlanos = useMemo(() => {
    const ordered = [...planos].sort((a, b) => a.ordem - b.ordem);
    if (!searchQuery.trim()) return ordered;

    const query = searchQuery.toLowerCase().trim();
    return ordered.filter(
      (plano) =>
        plano.nome.toLowerCase().includes(query) ||
        plano.tipo.toLowerCase().includes(query) ||
        plano.descricao.toLowerCase().includes(query)
    );
  }, [planos, searchQuery]);

  const planosSeparados = useMemo(() => splitPlanos(filteredPlanos), [filteredPlanos]);

  const tiposDisponiveis = useMemo(
    () => TIPOS_PLANO.filter((tipo) => !planos.some((plano) => plano.tipo === tipo)),
    [planos]
  );

  const selectedPlano = planos.find((plano) => plano.id === selectedId) ?? null;
  const recursosSeparados = useMemo(
    () => splitRecursos(selectedPlano?.recursos ?? []),
    [selectedPlano]
  );

  useEffect(() => {
    if (!planos.length) return;
    if (selectedId !== null && planos.some((plano) => plano.id === selectedId)) return;

    const primeiroPlano = [...planos].sort((a, b) => a.ordem - b.ordem)[0];
    setSelectedId(primeiroPlano.id);
  }, [planos, selectedId]);

  useEffect(() => {
    if (!selectedPlano) return;

    setForm({
      nome: selectedPlano.nome,
      descricao: selectedPlano.descricao,
      precoMensal: selectedPlano.precoMensal,
      ativo: selectedPlano.ativo,
      trialDisponivel: selectedPlano.trialDisponivel,
      diasGratis: selectedPlano.diasGratis,
      ordem: selectedPlano.ordem,
      destaque: selectedPlano.destaque,
      stripePriceId: selectedPlano.stripePriceId,
      tipo: selectedPlano.tipo,
    });

    const initialLimits = Object.fromEntries(
      selectedPlano.recursos.map((recurso) => [recurso.recurso, recurso.limite])
    );
    setLimites(initialLimits);
  }, [selectedPlano]);

  useEffect(() => {
    if (!isCreateOpen) return;

    const tipoInicial = tiposDisponiveis[0] ?? "Individual";
    const proximaOrdem = (planos.length ? Math.max(...planos.map((plano) => plano.ordem)) : 0) + 1;

    setCreateForm({
      ...CREATE_FORM_INITIAL,
      tipo: tipoInicial,
      ordem: proximaOrdem,
    });
  }, [isCreateOpen, planos, tiposDisponiveis]);

  const isSaving = atualizarPlano.isPending || atualizarRecursos.isPending;

  const handleSave = async () => {
    if (!selectedPlano) return;

    try {
      await atualizarPlano.mutateAsync({ id: selectedPlano.id, data: form });

      await atualizarRecursos.mutateAsync({
        id: selectedPlano.id,
        recursos: selectedPlano.recursos.map((recurso) => ({
          recurso: recurso.recurso,
          limite: limites[recurso.recurso] ?? recurso.limite,
          descricaoLimite: recurso.descricaoLimite,
        })),
      });
    } catch {
      return;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full">
        <aside className="hidden w-96 shrink-0 border-r border-slate-100 bg-white p-6 lg:block dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="mb-6 h-10 w-full rounded-xl" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="mb-3 h-24 w-full rounded-xl" />
          ))}
        </aside>
        <div className="flex-1 p-4 sm:p-6 lg:p-10">
          <Skeleton className="mb-8 h-10 w-80" />
          <Skeleton className="h-64 w-full rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorState
          message="Erro ao carregar planos."
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["admin", "planos"] })}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0">
        <aside className="hidden w-96 shrink-0 flex-col overflow-hidden border-r border-slate-100 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-50 p-6 dark:border-slate-800">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl serif-italic">Lista de Planos</h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  Acesso individual e familiar em blocos separados.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                disabled={tiposDisponiveis.length === 0}
                className="rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Plano
              </Button>
            </div>

            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar planos..."
                className="h-auto rounded-xl border-none bg-slate-50 px-4 py-2.5 text-[11px] placeholder:text-slate-300 focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900/50"
              />
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <PlanSection
              title="Acesso individual"
              subtitle="Planos para uso pessoal e acesso direto"
              planos={planosSeparados.individual}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <PlanSection
              title="Acesso familiar"
              subtitle="Planos com recursos compartilhados entre 2 pessoas"
              planos={planosSeparados.familiar}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>Total de Planos</span>
              <span>{String(planos.length).padStart(2, "0")}</span>
            </div>
            {tiposDisponiveis.length === 0 && (
              <p className="mt-2 text-[10px] text-slate-400">
                Todos os tipos disponíveis já foram cadastrados.
              </p>
            )}
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
          <div className="mb-6 lg:hidden">
            <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Selecionar plano
            </label>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
            >
              {filteredPlanos.map((plano) => (
                <option key={plano.id} value={plano.id}>
                  {plano.nome} - {plano.tipo}
                </option>
              ))}
            </select>

            <Button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              disabled={tiposDisponiveis.length === 0}
              className="mt-3 w-full rounded-xl text-[10px] font-bold uppercase tracking-widest"
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar Plano
            </Button>
          </div>

          {selectedPlano ? (
            <motion.div
              key={selectedPlano.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-5xl space-y-8 lg:space-y-10"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    Configuração de Plano
                  </span>
                  <h1 className="text-2xl serif-italic lg:text-3xl">{selectedPlano.nome}</h1>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Tipo {selectedPlano.tipo} com recursos organizados por contexto de uso.
                  </p>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="falcon-glow shrink-0 rounded-full bg-slate-900 px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Alterações
                </Button>
              </div>

              <div className="exec-card rounded-[2rem] p-6 lg:p-8">
                <h3 className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  <Settings className="h-3.5 w-3.5" /> Dados principais
                </h3>

                <div className="grid grid-cols-12 gap-4 lg:gap-6">
                  <div className="col-span-12 sm:col-span-8">
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      Nome do plano
                    </label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm((current) => ({ ...current, nome: e.target.value }))}
                      className="h-auto rounded-xl border-slate-100 bg-slate-50 px-4 py-2.5 text-[12px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-4">
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      Ordem de exibição
                    </label>
                    <Input
                      type="number"
                      value={form.ordem}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          ordem: Number.parseInt(e.target.value, 10) || 0,
                        }))
                      }
                      className="h-auto rounded-xl border-slate-100 bg-slate-50 px-4 py-2.5 text-[12px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
                    />
                  </div>
                  <div className="col-span-12">
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      Descrição curta
                    </label>
                    <textarea
                      value={form.descricao}
                      onChange={(e) =>
                        setForm((current) => ({ ...current, descricao: e.target.value }))
                      }
                      rows={2}
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-[12px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-4">
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      Tipo
                    </label>
                    <Input value={selectedPlano.tipo} disabled className="h-auto rounded-xl bg-slate-100 px-4 py-2.5 text-[12px] dark:bg-slate-800" />
                  </div>
                  <div className="col-span-12 sm:col-span-4">
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      Preço mensal (R$)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.precoMensal}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          precoMensal: Number.parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="h-auto rounded-xl border-slate-100 bg-slate-50 px-4 py-2.5 text-[12px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-4">
                    <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      Stripe Price ID
                    </label>
                    <Input
                      value={form.stripePriceId ?? ""}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          stripePriceId: e.target.value || null,
                        }))
                      }
                      className="h-auto rounded-xl border-slate-100 bg-slate-50 px-4 py-2.5 text-[12px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ResourceSection
                  title="Acesso individual"
                  description="Recursos do uso pessoal do titular."
                  icon={<BarChart3 className="h-3.5 w-3.5" />}
                  recursos={recursosSeparados.individual}
                  limites={limites}
                  onChange={(recurso, limite) =>
                    setLimites((current) => ({ ...current, [recurso]: limite }))
                  }
                />
                <ResourceSection
                  title="Acesso familiar"
                  description="Itens de compartilhamento e colaboração entre 2 pessoas."
                  icon={<Users className="h-3.5 w-3.5" />}
                  recursos={recursosSeparados.familiar}
                  limites={limites}
                  onChange={(recurso, limite) =>
                    setLimites((current) => ({ ...current, [recurso]: limite }))
                  }
                  emptyMessage="Esse plano não expõe recursos familiares."
                />
              </div>

              <div className="exec-card rounded-[2rem] p-6 lg:p-8">
                <h3 className="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  <Settings className="h-3.5 w-3.5" /> Disponibilidade comercial
                </h3>
                <div className="flex flex-wrap gap-8 lg:gap-10">
                  <CheckboxCard
                    label="Plano ativo"
                    helper="Disponível para contratação"
                    checked={form.ativo}
                    onChange={(checked) => setForm((current) => ({ ...current, ativo: checked }))}
                  />
                  <CheckboxCard
                    label="Destaque comercial"
                    helper="Marca o plano como principal"
                    checked={form.destaque}
                    onChange={(checked) =>
                      setForm((current) => ({ ...current, destaque: checked }))
                    }
                  />
                  <CheckboxCard
                    label="Trial disponível"
                    helper={form.trialDisponivel ? `${form.diasGratis} dias grátis` : "Sem trial"}
                    checked={form.trialDisponivel}
                    onChange={(checked) =>
                      setForm((current) => ({ ...current, trialDisponivel: checked }))
                    }
                  />

                  {form.trialDisponivel && (
                    <div>
                      <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        Dias gratuitos
                      </label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          value={form.diasGratis}
                          onChange={(e) =>
                            setForm((current) => ({
                              ...current,
                              diasGratis: Number.parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className="h-auto w-16 rounded-xl border-slate-100 bg-slate-50 py-1.5 text-center text-[12px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
                        />
                        <span className="text-[10px] font-bold uppercase text-slate-400">dias</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <p className="text-[11px] font-bold uppercase tracking-widest">
                Selecione um plano na lista
              </p>
            </div>
          )}
        </section>
      </div>

      <CreatePlanDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        tiposDisponiveis={tiposDisponiveis}
        form={createForm}
        onChange={setCreateForm}
        isPending={criarPlano.isPending}
        onSubmit={() => criarPlano.mutate(createForm)}
      />
    </>
  );
}

function PlanSection({
  title,
  subtitle,
  planos,
  selectedId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  planos: PlanoConfigDto[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="px-3 py-3">
      <div className="mb-2 px-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{title}</p>
        <p className="mt-1 text-[10px] text-slate-400">{subtitle}</p>
      </div>

      {planos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-[11px] text-slate-400 dark:border-slate-700">
          Nenhum plano nesta seção.
        </div>
      ) : (
        planos.map((plano) => (
          <button
            key={plano.id}
            type="button"
            onClick={() => onSelect(plano.id)}
            className={cn(
              "mb-2 w-full rounded-2xl border border-transparent p-5 text-left transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/50",
              selectedId === plano.id &&
                "border-emerald-100 bg-white shadow-sm dark:border-emerald-500/20 dark:bg-slate-800"
            )}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-100">{plano.nome}</h3>
              <span className="text-[11px] font-bold text-emerald-600">
                {plano.precoMensal === 0
                  ? "Grátis"
                  : `R$ ${plano.precoMensal.toFixed(2).replace(".", ",")}`}
              </span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {plano.tipo}
              </span>
              {plano.destaque && (
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                  Destaque
                </span>
              )}
              {!plano.ativo && (
                <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-red-500 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                  Inativo
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-[11px] text-slate-400">{plano.descricao}</p>
          </button>
        ))
      )}
    </div>
  );
}

function ResourceSection({
  title,
  description,
  icon,
  recursos,
  limites,
  onChange,
  emptyMessage = "Sem recursos configurados.",
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  recursos: RecursoPlanoDto[];
  limites: Record<string, number>;
  onChange: (recurso: string, limite: number) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="exec-card rounded-[2rem] p-6 lg:p-8">
      <h3 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {icon} {title}
      </h3>
      <p className="mb-6 text-[11px] text-slate-400">{description}</p>

      <div className="space-y-1">
        {recursos.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-[11px] text-slate-400 dark:border-slate-700">
            {emptyMessage}
          </div>
        )}

        {recursos
          .slice()
          .sort((a, b) => a.nomeRecurso.localeCompare(b.nomeRecurso))
          .map((recurso) => {
            const valor = limites[recurso.recurso] ?? recurso.limite;
            const ilimitado = valor === -1;
            const bloqueado = valor === 0;

            return (
              <div
                key={recurso.recurso}
                className="flex items-center justify-between gap-4 border-b border-slate-50 py-4 dark:border-slate-800"
              >
                <div>
                  <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                    {recurso.nomeRecurso}
                  </p>
                  <p className="text-[10px] text-slate-400">{recurso.recurso}</p>
                </div>
                <div className="flex items-center gap-2">
                  {ilimitado ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                      Ilimitado
                    </span>
                  ) : bloqueado ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">
                      Bloqueado
                    </span>
                  ) : (
                    <Input
                      type="number"
                      value={valor}
                      onChange={(e) => onChange(recurso.recurso, Number.parseInt(e.target.value, 10) || 0)}
                      className="h-auto w-20 rounded-xl border-slate-100 bg-slate-50 py-1.5 text-right text-[12px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
                    />
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onChange(recurso.recurso, ilimitado ? 1 : -1)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[9px] font-bold uppercase transition-all",
                        ilimitado
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-500/10"
                      )}
                    >
                      ∞
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(recurso.recurso, bloqueado ? 1 : 0)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[9px] font-bold uppercase transition-all",
                        bloqueado
                          ? "bg-red-500 text-white"
                          : "bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-500/10"
                      )}
                    >
                      X
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function CheckboxCard({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-slate-200 text-emerald-500 focus:ring-emerald-500 dark:border-slate-600"
      />
      <div>
        <span className="text-sm font-semibold text-slate-700 transition-colors group-hover:text-emerald-600 dark:text-slate-200">
          {label}
        </span>
        <p className="text-[10px] text-slate-400">{helper}</p>
      </div>
    </label>
  );
}

function CreatePlanDialog({
  open,
  onOpenChange,
  tiposDisponiveis,
  form,
  onChange,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiposDisponiveis: TipoPlano[];
  form: CriarPlanoRequest;
  onChange: (form: CriarPlanoRequest) => void;
  isPending: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Criar Plano</DialogTitle>
        </DialogHeader>

        {tiposDisponiveis.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Todos os tipos disponíveis já foram cadastrados. Para mudar um plano existente, edite-o na lista.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Tipo do plano
              </label>
              <select
                value={form.tipo}
                onChange={(e) => onChange({ ...form, tipo: e.target.value as TipoPlano })}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
              >
                {tiposDisponiveis.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Nome
              </label>
              <Input value={form.nome} onChange={(e) => onChange({ ...form, nome: e.target.value })} />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Descrição
              </label>
              <textarea
                value={form.descricao}
                onChange={(e) => onChange({ ...form, descricao: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Preço mensal
              </label>
              <Input
                type="number"
                step="0.01"
                value={form.precoMensal}
                onChange={(e) => onChange({ ...form, precoMensal: Number.parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Ordem
              </label>
              <Input
                type="number"
                value={form.ordem}
                onChange={(e) => onChange({ ...form, ordem: Number.parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Stripe Price ID
              </label>
              <Input
                value={form.stripePriceId ?? ""}
                onChange={(e) => onChange({ ...form, stripePriceId: e.target.value || null })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => onChange({ ...form, ativo: e.target.checked })}
              />
              Plano ativo
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.destaque}
                onChange={(e) => onChange({ ...form, destaque: e.target.checked })}
              />
              Destaque comercial
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.trialDisponivel}
                onChange={(e) => onChange({ ...form, trialDisponivel: e.target.checked })}
              />
              Trial disponível
            </label>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Dias grátis
              </label>
              <Input
                type="number"
                value={form.diasGratis}
                onChange={(e) => onChange({ ...form, diasGratis: Number.parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={tiposDisponiveis.length === 0 || !form.nome.trim() || isPending}
            onClick={onSubmit}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Criar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}