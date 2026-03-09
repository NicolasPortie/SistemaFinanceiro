"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, RefreshCw, Tag, Trash2 } from "lucide-react";

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
import {
  useAtualizarCategoria,
  useCategorias,
  useCriarCategoria,
  useRemoverCategoria,
} from "@/hooks/use-queries";

export default function CategoriasPage() {
  const { data: categorias = [], isLoading, isError, error, refetch } = useCategorias();
  const criarCategoria = useCriarCategoria();
  const atualizarCategoria = useAtualizarCategoria();
  const removerCategoria = useRemoverCategoria();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState("");
  const [editingCategoria, setEditingCategoria] = useState<{ id: number; nome: string } | null>(null);
  const [editingName, setEditingName] = useState("");
  const [removingCategoriaId, setRemovingCategoriaId] = useState<number | null>(null);

  const handleCreate = () => {
    if (!createName.trim()) return;
    criarCategoria.mutate(
      { nome: createName.trim() },
      {
        onSuccess: () => {
          setCreateName("");
          setShowCreateDialog(false);
        },
      }
    );
  };

  const handleUpdate = () => {
    if (!editingCategoria || !editingName.trim()) return;
    atualizarCategoria.mutate(
      { id: editingCategoria.id, data: { nome: editingName.trim() } },
      { onSuccess: () => setEditingCategoria(null) }
    );
  };

  const handleRemove = () => {
    if (removingCategoriaId === null) return;
    removerCategoria.mutate(removingCategoriaId, {
      onSuccess: () => setRemovingCategoriaId(null),
    });
  };

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="exec-card rounded-[2rem] p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
              Organização financeira
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Categorias
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Mantenha seu plano de contas limpo em uma guia dedicada. Aqui você cria, ajusta e revisa as categorias que alimentam lançamentos, metas e limites.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => refetch()} className="gap-2 rounded-2xl">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Nova categoria
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message ?? "Erro ao carregar categorias."} onRetry={refetch} />
      ) : categorias.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categorias.map((categoria, index) => (
            <motion.article
              key={categoria.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.3 }}
              className="exec-card rounded-[1.75rem] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {categoria.nome}
                    </h2>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {categoria.padrao ? "Categoria padrão" : "Categoria personalizada"}
                    </p>
                  </div>
                </div>

                {!categoria.padrao && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingCategoria({ id: categoria.id, nome: categoria.nome });
                        setEditingName(categoria.nome);
                      }}
                      className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                      aria-label="Editar categoria"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setRemovingCategoriaId(categoria.id)}
                      className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                      aria-label="Remover categoria"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.article>
          ))}
        </section>
      ) : (
        <section className="exec-card rounded-[2rem] p-8 sm:p-10">
          <EmptyState
            icon={<Tag className="h-6 w-6" />}
            title="Nenhuma categoria cadastrada"
            description="Crie a primeira categoria para organizar lançamentos, limites e metas com mais clareza."
            action={
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
                Criar categoria
              </Button>
            }
          />
        </section>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription>
              Adicione uma nova categoria para refletir melhor sua estrutura financeira.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-categoria">Nome</Label>
              <Input
                id="nova-categoria"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleCreate()}
                placeholder="Ex: Assinaturas"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={!createName.trim() || criarCategoria.isPending}
              className="h-11 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Criar categoria
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingCategoria !== null} onOpenChange={(open) => !open && setEditingCategoria(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
            <DialogDescription>
              Atualize o nome desta categoria sem impactar os lançamentos existentes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editar-categoria">Nome</Label>
              <Input
                id="editar-categoria"
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleUpdate()}
              />
            </div>
            <Button
              onClick={handleUpdate}
              disabled={!editingName.trim() || atualizarCategoria.isPending}
              className="h-11 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removingCategoriaId !== null} onOpenChange={() => setRemovingCategoriaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Revise os lançamentos vinculados antes de confirmar a remoção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-red-600 text-white hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}