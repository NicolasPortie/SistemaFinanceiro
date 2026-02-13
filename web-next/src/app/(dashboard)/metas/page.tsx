"use client";

import { useState } from "react";
import {
  useMetas,
  useCategorias,
  useCriarMeta,
  useAtualizarMeta,
  useRemoverMeta,
} from "@/hooks/use-queries";
import type { CriarMetaRequest, MetaFinanceira } from "@/lib/api";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Plus,
  Trash2,
  Edit3,
  Pause,
  Play,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Trophy,
} from "lucide-react";
import { PageShell, PageHeader, StatCard, EmptyState } from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

const tiposLabel: Record<string, string> = {
  juntar_valor: "Juntar Valor",
  reduzir_gasto: "Reduzir Gasto",
  reserva_mensal: "Reserva Mensal",
};

const prioridadeBadge: Record<string, string> = {
  alta: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  media: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  baixa: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
};

const desvioIcon = (desvio: string) => {
  if (desvio?.includes("adiantada")) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (desvio?.includes("atrasada")) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-amber-500" />;
};

export default function MetasPage() {
  const { data: metas = [], isLoading: loading } = useMetas();
  const { data: categorias = [] } = useCategorias();
  const criarMeta = useCriarMeta();
  const atualizarMeta = useAtualizarMeta();
  const removerMeta = useRemoverMeta();

  const [tab, setTab] = useState("metas");

  // Create form
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("juntar_valor");
  const [prioridade, setPrioridade] = useState("media");
  const [valorAlvo, setValorAlvo] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [prazo, setPrazo] = useState("");
  const [categoria, setCategoria] = useState("");

  // Edit/Delete
  const [editMeta, setEditMeta] = useState<MetaFinanceira | null>(null);
  const [editValor, setEditValor] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    const alvo = parseFloat(valorAlvo.replace(",", "."));
    const atual = parseFloat(valorAtual.replace(",", ".") || "0");
    if (isNaN(alvo) || alvo <= 0) {
      toast.error("Informe um valor alvo válido");
      return;
    }
    const data: CriarMetaRequest = {
      nome,
      tipo,
      valorAlvo: alvo,
      valorAtual: atual,
      prazo,
      prioridade,
      categoria: tipo === "reduzir_gasto" ? categoria : undefined,
    };
    criarMeta.mutate(data, {
      onSuccess: () => {
        setNome("");
        setTipo("juntar_valor");
        setPrioridade("media");
        setValorAlvo("");
        setValorAtual("");
        setPrazo("");
        setCategoria("");
        setTab("metas");
      },
    });
  };

  const handleAtualizar = async () => {
    if (!editMeta) return;
    const val = parseFloat(editValor.replace(",", "."));
    if (isNaN(val)) return;
    setActionLoading(editMeta.id);
    atualizarMeta.mutate(
      { id: editMeta.id, data: { valorAtual: val } },
      {
        onSuccess: () => setEditMeta(null),
        onSettled: () => setActionLoading(null),
      }
    );
  };

  const handlePausarResumir = async (meta: MetaFinanceira) => {
    setActionLoading(meta.id);
    const novoStatus = meta.status === "pausada" ? "ativa" : "pausada";
    atualizarMeta.mutate(
      { id: meta.id, data: { status: novoStatus } },
      { onSettled: () => setActionLoading(null) }
    );
  };

  const handleRemover = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    removerMeta.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
      onSettled: () => setActionLoading(null),
    });
  };

  const ativas = metas.filter((m) => m.status === "ativa");
  const pausadas = metas.filter((m) => m.status === "pausada");
  const concluidas = metas.filter((m) => m.status === "concluida");

  return (
    <PageShell>
      <PageHeader
        title="Metas Financeiras"
        description="Defina e acompanhe suas metas financeiras"
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="metas" className="gap-2">
            <Target className="h-4 w-4" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="nova" className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Meta
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Metas ── */}
        <TabsContent value="metas" className="space-y-6">
          {/* Summary */}
          <div className="grid gap-5 sm:grid-cols-3">
            <StatCard
              title="Ativas"
              value={ativas.length.toString()}
              icon={<Target className="h-5 w-5" />}
              delay={0}
            />
            <StatCard
              title="Concluídas"
              value={concluidas.length.toString()}
              icon={<Trophy className="h-5 w-5" />}
              trend="up"
              delay={1}
            />
            <StatCard
              title="Pausadas"
              value={pausadas.length.toString()}
              icon={<Pause className="h-5 w-5" />}
              delay={2}
            />
          </div>

          {/* Active Goals */}
          {ativas.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
                Metas Ativas
              </h3>
              {ativas.map((meta, i) => (
                <MetaCard
                  key={meta.id}
                  meta={meta}
                  index={i}
                  actionLoading={actionLoading}
                  onEdit={() => {
                    setEditMeta(meta);
                    setEditValor(meta.valorAtual.toString());
                  }}
                  onPausar={() => handlePausarResumir(meta)}
                  onRemover={() => setDeleteId(meta.id)}
                />
              ))}
            </div>
          )}

          {/* Paused Goals */}
          {pausadas.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
                Pausadas
              </h3>
              {pausadas.map((meta, i) => (
                <MetaCard
                  key={meta.id}
                  meta={meta}
                  index={i}
                  actionLoading={actionLoading}
                  onEdit={() => {
                    setEditMeta(meta);
                    setEditValor(meta.valorAtual.toString());
                  }}
                  onPausar={() => handlePausarResumir(meta)}
                  onRemover={() => setDeleteId(meta.id)}
                />
              ))}
            </div>
          )}

          {/* Completed Goals */}
          {concluidas.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
                Concluídas
              </h3>
              {concluidas.map((meta) => (
                <motion.div
                  key={meta.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 card-premium p-4"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{meta.nome}</p>
                    <p className="text-[11px] text-muted-foreground/60 font-medium">
                      {formatCurrency(meta.valorAlvo)}
                    </p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Concluída
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}

          {metas.length === 0 && !loading && (
            <EmptyState
              icon={<Target className="h-6 w-6" />}
              title="Nenhuma meta"
              description="Crie sua primeira meta financeira para começar a acompanhar seu progresso"
              action={
                <Button onClick={() => setTab("nova")} className="gap-2">
                  <Plus className="h-4 w-4" /> Criar meta
                </Button>
              }
            />
          )}
        </TabsContent>

        {/* ── Tab Nova Meta ── */}
        <TabsContent value="nova">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium p-6"
          >
            <form onSubmit={handleCriar} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome da Meta</Label>
                  <Input
                    placeholder="Ex: Reserva de emergência"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="juntar_valor">Juntar Valor</SelectItem>
                      <SelectItem value="reduzir_gasto">Reduzir Gasto</SelectItem>
                      <SelectItem value="reserva_mensal">Reserva Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={prioridade} onValueChange={setPrioridade}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor Alvo (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={valorAlvo}
                    onChange={(e) => setValorAlvo(e.target.value)}
                    required
                    className="h-11 tabular-nums"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Já guardado (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={valorAtual}
                    onChange={(e) => setValorAtual(e.target.value)}
                    className="h-11 tabular-nums"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <AnimatePresence>
                  {tipo === "reduzir_gasto" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <Label>Categoria</Label>
                      <Select value={categoria} onValueChange={setCategoria}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((c) => (
                            <SelectItem key={c.id} value={c.nome}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Button
                type="submit"
                disabled={criarMeta.isPending}
                className="w-full sm:w-auto gap-2 h-11 font-semibold shadow-premium"
              >
                {criarMeta.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Target className="h-4 w-4" />
                    Criar Meta
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editMeta !== null} onOpenChange={() => setEditMeta(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar valor</DialogTitle>
            <DialogDescription>
              Informe o novo valor atual da meta &quot;{editMeta?.nome}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Valor Atual (R$)</Label>
            <Input
              value={editValor}
              onChange={(e) => setEditValor(e.target.value)}
              className="h-11 tabular-nums"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMeta(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAtualizar}
              disabled={actionLoading === editMeta?.id}
              className="gap-2"
            >
              {actionLoading === editMeta?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover meta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta meta? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemover}
              disabled={actionLoading === deleteId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {actionLoading === deleteId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

// ── Meta Card Component ──
function MetaCard({
  meta,
  index,
  actionLoading,
  onEdit,
  onPausar,
  onRemover,
}: {
  meta: MetaFinanceira;
  index: number;
  actionLoading: number | null;
  onEdit: () => void;
  onPausar: () => void;
  onRemover: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card-premium p-5 space-y-4 transition-all hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold tracking-tight">{meta.nome}</h4>
            <Badge variant="secondary" className={prioridadeBadge[meta.prioridade]}>
              {meta.prioridade}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 font-medium">
            <span>{tiposLabel[meta.tipo] || meta.tipo}</span>
            {meta.categoriaNome && (
              <>
                <span>•</span>
                <span>{meta.categoriaNome}</span>
              </>
            )}
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatShortDate(meta.prazo)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPausar}
            disabled={actionLoading === meta.id}
          >
            {meta.status === "pausada" ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onRemover}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Progress value={Math.min(meta.percentualConcluido, 100)} className="h-2" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground tabular-nums">
            {formatCurrency(meta.valorAtual)} de {formatCurrency(meta.valorAlvo)}
          </span>
          <span className="font-bold tabular-nums">{meta.percentualConcluido.toFixed(0)}%</span>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60 font-medium flex-wrap">
        <span className="flex items-center gap-1">
          {desvioIcon(meta.desvio)}
          {meta.desvio}
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span className="tabular-nums">{formatCurrency(meta.valorMensalNecessario)}/mês</span>
        <Separator orientation="vertical" className="h-4" />
        <span>
          {meta.mesesRestantes} {meta.mesesRestantes === 1 ? "mês" : "meses"} restantes
        </span>
      </div>
    </motion.div>
  );
}
