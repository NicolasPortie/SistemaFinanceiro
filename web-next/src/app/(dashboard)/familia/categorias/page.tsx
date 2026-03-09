"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Edit3, FolderOpen, Plus, RefreshCw, Tag, Trash2 } from "lucide-react";

import type { CategoriaFamiliar } from "@/lib/api";
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
import {
  useAtualizarCategoriaFamilia,
  useCriarCategoriaFamilia,
  useFamiliaCategoriasComp,
  useRemoverCategoriaFamilia,
} from "@/hooks/use-queries";

export default function FamiliaCategoriasPage() {
  const { data: categorias = [], isLoading, isError, error, refetch } = useFamiliaCategoriasComp();
  const criarCategoria = useCriarCategoriaFamilia();
  const atualizarCategoria = useAtualizarCategoriaFamilia();
  const removerCategoria = useRemoverCategoriaFamilia();

  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [editCat, setEditCat] = useState<CategoriaFamiliar | null>(null);
  const [editNome, setEditNome] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleCriar = () => {
    if (!nome.trim()) return;
    criarCategoria.mutate(nome.trim(), {
      onSuccess: () => {
        setNome("");
        setShowForm(false);
      },
    });
  };

  const handleAtualizar = () => {
    if (!editCat || !editNome.trim()) return;
    atualizarCategoria.mutate(
      { id: editCat.id, nome: editNome.trim() },
      { onSuccess: () => setEditCat(null) }
    );
  };

  const handleRemover = () => {
    if (!deleteId) return;
    removerCategoria.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  };

  return (
    <TooltipProvider>
      <FamilyShell>
        <FamilyHero
          icon={<FolderOpen className="h-6 w-6" />}
          title="Categorias Compartilhadas"
          description="Mantenha a mesma taxonomia financeira entre titular e membro, sem perder o ritmo visual do layout novo."
          eyebrow="Módulo Família"
          backHref="/familia"
          backLabel="Família"
          tone="blue"
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
                onClick={() => {
                  setNome("");
                  setShowForm(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Nova categoria
              </FamilyPrimaryAction>
            </>
          }
        />

        {isLoading ? (
          <CardSkeleton count={4} />
        ) : isError ? (
          <ErrorState message={error?.message ?? "Erro ao carregar categorias"} onRetry={refetch} />
        ) : categorias.length > 0 ? (
          <>
            <FamilyMetricCard
              title="Categorias Ativas"
              value={String(categorias.length)}
              subtitle={`Estrutura compartilhada${categorias.length !== 1 ? "s" : ""} pronta${categorias.length !== 1 ? "s" : ""} para uso`}
              icon={<Tag className="h-5 w-5" />}
              tone="blue"
            />

            <FamilyPanel
              title="Catálogo compartilhado"
              description="Edite nomes, revise o criador de cada categoria e retire do compartilhamento quando necessário."
              icon={<FolderOpen className="h-5 w-5" />}
              tone="blue"
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence>
                  {categorias.map((cat, index) => (
                    <motion.div
                      key={cat.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ delay: index * 0.04, duration: 0.35 }}
                      className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/70 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/8 dark:bg-slate-900/35"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {cat.nome}
                          </h3>
                          {cat.criadorNome && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              por {cat.criadorNome}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  setEditCat(cat);
                                  setEditNome(cat.nome);
                                }}
                                aria-label="Editar categoria"
                                className="rounded-xl border border-transparent p-2 text-slate-400 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:border-blue-500/15 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setDeleteId(cat.id)}
                                aria-label="Descompartilhar categoria"
                                className="rounded-xl border border-transparent p-2 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-500/15 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Descompartilhar</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </FamilyPanel>
          </>
        ) : (
          <FamilyPanel tone="slate" className="p-10 lg:p-12">
            <EmptyState
              icon={<FolderOpen className="h-6 w-6" />}
              title="Nenhuma categoria compartilhada"
              description="Crie categorias para organizar os gastos compartilhados da família."
              action={
                <FamilyPrimaryAction onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4" />
                  Criar categoria
                </FamilyPrimaryAction>
              }
            />
          </FamilyPanel>
        )}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="sr-only">Nova categoria</DialogTitle>
              <DialogDescription className="sr-only">
                Crie uma nova categoria compartilhada com a família.
              </DialogDescription>
              <FamilyDialogHeader
                icon={<FolderOpen className="h-5 w-5 sm:h-6 sm:w-6" />}
                title="Nova categoria"
                description="Crie uma categoria para o catálogo compartilhado da família."
                tone="blue"
              />
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nome da categoria
                </Label>
                <Input
                  placeholder="Ex: Mercado"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCriar()}
                  className="h-11 rounded-xl"
                />
              </div>

              <FamilyPrimaryAction
                onClick={handleCriar}
                disabled={!nome.trim()}
                loading={criarCategoria.isPending}
                className="h-12 w-full"
              >
                <FolderOpen className="h-5 w-5" />
                Criar categoria
              </FamilyPrimaryAction>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={editCat !== null} onOpenChange={(open) => !open && setEditCat(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="sr-only">Editar categoria</DialogTitle>
              <DialogDescription className="sr-only">
                Altere o nome de uma categoria compartilhada.
              </DialogDescription>
              <FamilyDialogHeader
                icon={<Edit3 className="h-5 w-5 sm:h-6 sm:w-6" />}
                title="Editar categoria"
                description="Atualize o nome sem quebrar o compartilhamento atual."
                tone="blue"
              />
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nome
                </Label>
                <Input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAtualizar()}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditCat(null)}
                  className="h-12 flex-1 rounded-xl font-semibold"
                >
                  Cancelar
                </Button>
                <FamilyPrimaryAction
                  onClick={handleAtualizar}
                  disabled={!editNome.trim()}
                  loading={atualizarCategoria.isPending}
                  className="h-12 flex-1"
                >
                  Salvar
                </FamilyPrimaryAction>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader className="items-start text-left">
              <AlertDialogTitle className="sr-only">Descompartilhar categoria?</AlertDialogTitle>
              <AlertDialogDescription className="sr-only">
                A categoria será removida do compartilhamento familiar, mas continuará existindo
                para quem a criou.
              </AlertDialogDescription>
              <FamilyDialogHeader
                icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
                title="Descompartilhar categoria?"
                description="A categoria será removida do compartilhamento familiar, mas continuará existindo para quem a criou."
                tone="rose"
              />
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemover}
                loading={removerCategoria.isPending}
                className="gap-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="h-4 w-4" />
                Descompartilhar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </FamilyShell>
    </TooltipProvider>
  );
}
