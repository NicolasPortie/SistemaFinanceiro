"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Save, Settings, BarChart3, Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api, AtualizarPlanoRequest, AtualizarRecursoRequest } from "@/lib/api";
import { ErrorState } from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ── Page ───────────────────────────────────────────────────

export default function AdminPlanosPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const lastSyncedId = useRef<number | null>(null);

  // Form state
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
  const [limites, setLimites] = useState<Record<string, number>>({});

  const {
    data: planos,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "planos"],
    queryFn: () => api.admin.planos.listar(),
  });

  const atualizarPlano = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AtualizarPlanoRequest }) =>
      api.admin.planos.atualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "planos"] });
      toast.success("Plano atualizado com sucesso!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const atualizarRecursos = useMutation({
    mutationFn: ({ id, recursos }: { id: number; recursos: AtualizarRecursoRequest[] }) =>
      api.admin.planos.atualizarRecursos(id, recursos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "planos"] });
      toast.success("Limites atualizados!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Auto-select first plan on load
  useEffect(() => {
    if (planos?.length && selectedId === null) {
      setSelectedId(planos.sort((a, b) => a.ordem - b.ordem)[0].id);
    }
  }, [planos, selectedId]);

  const selectedPlano = planos?.find((p) => p.id === selectedId) ?? null;

  // Sync form when selection changes
  if (selectedPlano && selectedPlano.id !== lastSyncedId.current) {
    lastSyncedId.current = selectedPlano.id;
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
    });
    const initial: Record<string, number> = {};
    selectedPlano.recursos.forEach((r) => {
      initial[r.recurso] = r.limite;
    });
    setLimites(initial);
  }

  // Filtered plans for sidebar
  const sortedPlanos = useMemo(() => {
    if (!planos) return [];
    let list = [...planos].sort((a, b) => a.ordem - b.ordem);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) => p.nome.toLowerCase().includes(q) || p.tipo.toLowerCase().includes(q)
      );
    }
    return list;
  }, [planos, searchQuery]);

  // Save handler
  const isSaving = atualizarPlano.isPending || atualizarRecursos.isPending;

  const handleSave = async () => {
    if (!selectedPlano) return;
    try {
      await atualizarPlano.mutateAsync({
        id: selectedPlano.id,
        data: form,
      });
      const recursos: AtualizarRecursoRequest[] = selectedPlano.recursos.map((r) => ({
        recurso: r.recurso,
        limite: limites[r.recurso] ?? r.limite,
        descricaoLimite: null,
      }));
      await atualizarRecursos.mutateAsync({
        id: selectedPlano.id,
        recursos,
      });
    } catch {
      // errors handled by mutation callbacks
    }
  };

  // ── Loading ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full">
        <aside className="w-96 shrink-0 hidden lg:block bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-10 w-full mb-6 rounded-xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full mb-3 rounded-xl" />
          ))}
        </aside>
        <div className="flex-1 p-4 sm:p-6 lg:p-10">
          <Skeleton className="h-10 w-80 mb-8" />
          <Skeleton className="h-64 w-full rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
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
        {/* ── Sidebar: Plan List ── */}
        <aside className="w-96 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 hidden lg:flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl serif-italic">Lista de Planos</h2>
            </div>
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar planos..."
                className="bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2.5 text-[11px] placeholder:text-slate-300 focus:ring-1 focus:ring-emerald-500 h-auto"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar py-2">
            {sortedPlanos.map((plano) => (
              <button
                key={plano.id}
                onClick={() => setSelectedId(plano.id)}
                className={cn(
                  "w-full text-left p-5 cursor-pointer transition-all border-l-4 border-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/50",
                  selectedId === plano.id &&
                    "bg-white dark:bg-slate-800 border-emerald-500 shadow-sm"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3
                    className={cn(
                      "font-bold text-sm",
                      selectedId === plano.id
                        ? "text-foreground"
                        : "text-slate-600 dark:text-slate-300"
                    )}
                  >
                    {plano.nome}
                  </h3>
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      selectedId === plano.id ? "text-emerald-600" : "text-slate-400"
                    )}
                  >
                    {plano.precoMensal === 0
                      ? "Grátis"
                      : `R$ ${plano.precoMensal.toFixed(2).replace(".", ",")}`}
                  </span>
                </div>
                <div className="flex gap-1.5 items-center mb-3">
                  {plano.destaque && (
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                      Popular
                    </span>
                  )}
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider",
                      plano.ativo
                        ? "bg-slate-50 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
                        : "bg-red-50 text-red-500 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20"
                    )}
                  >
                    {plano.ativo ? plano.tipo : "Inativo"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{plano.descricao}</p>
              </button>
            ))}
          </div>

          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Total de Planos</span>
              <span>{String(planos?.length ?? 0).padStart(2, "0")}</span>
            </div>
          </div>
        </aside>

        {/* ── Detail Panel ── */}
        <section className="flex-1 overflow-y-auto hide-scrollbar p-4 sm:p-6 lg:p-10">
          {/* Mobile plan selector */}
          <div className="lg:hidden mb-6">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              Selecionar Plano
            </label>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-emerald-500"
            >
              {sortedPlanos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} — R$ {p.precoMensal.toFixed(2).replace(".", ",")}
                </option>
              ))}
            </select>
          </div>

          {selectedPlano ? (
            <motion.div
              key={selectedPlano.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-8 lg:space-y-10"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1 block">
                    Configuração de Plano
                  </span>
                  <h1 className="text-2xl lg:text-3xl serif-italic">
                    {form.nome || selectedPlano.nome}
                  </h1>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all falcon-glow shrink-0"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </div>

              {/* ── Atributos Principais ── */}
              <div className="exec-card rounded-[2rem] p-6 lg:p-8">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <Settings className="h-3.5 w-3.5" /> Atributos Principais
                </h3>
                <div className="grid grid-cols-12 gap-4 lg:gap-6">
                  <div className="col-span-12 sm:col-span-8">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                      Nome do Plano
                    </label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      placeholder="Ex: Premium Gold"
                      className="bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-[12px] placeholder:text-slate-300 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 h-auto"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-4">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                      Ordem de Exibição
                    </label>
                    <Input
                      type="number"
                      value={form.ordem}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          ordem: parseInt(e.target.value) || 0,
                        })
                      }
                      className="bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-[12px] focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 h-auto"
                    />
                  </div>
                  <div className="col-span-12">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                      Descrição Curta
                    </label>
                    <textarea
                      value={form.descricao}
                      onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-[12px] placeholder:text-slate-300 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none transition-all"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                      Preço Mensal (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 font-medium">
                        R$
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.precoMensal}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            precoMensal: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-[12px] focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 h-auto"
                      />
                    </div>
                  </div>
                  <div className="col-span-12 sm:col-span-6">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                      Stripe Price ID
                    </label>
                    <Input
                      value={form.stripePriceId || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          stripePriceId: e.target.value || null,
                        })
                      }
                      placeholder="price_..."
                      className="bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-[12px] placeholder:text-slate-300 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* ── Limites de Recursos ── */}
              <div className="exec-card rounded-[2rem] p-6 lg:p-8">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" /> Limites de Recursos e Capacidade
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-0">
                  {selectedPlano.recursos
                    .sort((a, b) => a.nomeRecurso.localeCompare(b.nomeRecurso))
                    .map((r) => {
                      const valor = limites[r.recurso] ?? r.limite;
                      const isUnlimited = valor === -1;
                      const isBlocked = valor === 0;

                      return (
                        <div
                          key={r.recurso}
                          className="flex items-center justify-between py-5 border-b border-slate-50 dark:border-slate-800"
                        >
                          <div>
                            <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 block">
                              {r.nomeRecurso}
                            </label>
                            <p className="text-[10px] text-slate-400">{r.recurso}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isUnlimited ? (
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                Ilimitado
                              </span>
                            ) : isBlocked ? (
                              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                                Bloqueado
                              </span>
                            ) : (
                              <Input
                                type="number"
                                value={valor}
                                onChange={(e) =>
                                  setLimites((prev) => ({
                                    ...prev,
                                    [r.recurso]: parseInt(e.target.value) || 0,
                                  }))
                                }
                                className="w-20 bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 rounded-xl text-right text-[12px] h-auto py-1.5 focus:ring-1 focus:ring-emerald-500"
                              />
                            )}
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setLimites((prev) => ({
                                    ...prev,
                                    [r.recurso]: isUnlimited ? 1 : -1,
                                  }))
                                }
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[9px] font-bold uppercase transition-all",
                                  isUnlimited
                                    ? "bg-emerald-500 text-white"
                                    : "bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10"
                                )}
                              >
                                ∞
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setLimites((prev) => ({
                                    ...prev,
                                    [r.recurso]: isBlocked ? 1 : 0,
                                  }))
                                }
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[9px] font-bold uppercase transition-all",
                                  isBlocked
                                    ? "bg-red-500 text-white"
                                    : "bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                )}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* ── Visualização Comercial ── */}
              <div className="exec-card rounded-[2rem] p-6 lg:p-8">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5" /> Visualização Comercial
                </h3>
                <div className="flex flex-wrap gap-8 lg:gap-10">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                      className="rounded text-emerald-500 focus:ring-emerald-500 border-slate-200 dark:border-slate-600 w-5 h-5"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 transition-colors">
                        Plano Ativo
                      </span>
                      <p className="text-[10px] text-slate-400">Visível para contratação</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.destaque}
                      onChange={(e) => setForm({ ...form, destaque: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-500 border-slate-200 dark:border-slate-600 w-5 h-5"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-amber-600 transition-colors">
                        Destaque Comercial
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Badge de &quot;Mais Popular&quot;
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.trialDisponivel}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          trialDisponivel: e.target.checked,
                        })
                      }
                      className="rounded text-sky-500 focus:ring-sky-500 border-slate-200 dark:border-slate-600 w-5 h-5"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-sky-600 transition-colors">
                        Trial Disponível
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {form.trialDisponivel
                          ? `${form.diasGratis} dias gratuitos`
                          : "Sem período de teste"}
                      </p>
                    </div>
                  </label>
                  {form.trialDisponivel && (
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                        Dias Gratuitos
                      </label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          value={form.diasGratis}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              diasGratis: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-16 bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 rounded-xl text-center text-[12px] h-auto py-1.5 focus:ring-1 focus:ring-emerald-500"
                        />
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Dias</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <p className="text-[11px] uppercase tracking-widest font-bold">
                Selecione um plano na lista
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
