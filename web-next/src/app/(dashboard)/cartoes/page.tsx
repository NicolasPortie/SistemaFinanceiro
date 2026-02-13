"use client";

import { useState } from "react";
import {
  useCartoes,
  useCriarCartao,
  useAtualizarCartao,
  useDesativarCartao,
  useFaturas,
} from "@/hooks/use-queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { cartaoSchema, type CartaoData } from "@/lib/schemas";
import type { Cartao } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  Calendar,
  DollarSign,
  X,
  ChevronDown,
  ChevronUp,
  Receipt,
  Wifi,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  EmptyState,
  CardSkeleton,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

const cardGradients = [
  "from-violet-600 to-purple-700",
  "from-blue-600 to-indigo-700",
  "from-emerald-600 to-teal-700",
  "from-rose-600 to-pink-700",
  "from-amber-600 to-orange-700",
  "from-cyan-600 to-sky-700",
];

function FaturaSection({ fatura, defaultOpen }: { fatura: import("@/lib/api").FaturaResumo; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const vencida = new Date(fatura.dataVencimento) < new Date() && fatura.status !== "Paga";
  const statusLabel = vencida ? "Vencida" : fatura.status;
  const statusClass = vencida
    ? "text-red-600 dark:text-red-400 font-bold"
    : fatura.status === "Aberta"
      ? "text-amber-600 dark:text-amber-400 font-medium"
      : "text-blue-600 dark:text-blue-400 font-medium";
  const iconBg = vencida
    ? "bg-red-100 dark:bg-red-900/30"
    : "bg-violet-100 dark:bg-violet-900/30";
  const iconColor = vencida
    ? "text-red-600 dark:text-red-400"
    : "text-violet-600 dark:text-violet-400";

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-sm ${vencida ? "border-red-300 dark:border-red-800" : "border-border/40"}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-all duration-300 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
            <Receipt className={`h-3.5 w-3.5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{fatura.mesReferencia}</p>
            <p className="text-[11px] text-muted-foreground">
              Venc. {formatDate(fatura.dataVencimento)} · <span className={statusClass}>{statusLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums">{formatCurrency(fatura.total)}</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && fatura.parcelas.length > 0 && (
        <div className="border-t border-border/40 overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/30">
                <th className="text-left font-medium px-4 py-2">Lançamento</th>
                <th className="text-right font-medium px-4 py-2 w-24">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {fatura.parcelas.map((p, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate max-w-[200px]">{p.descricao}</span>
                      {p.totalParcelas > 1 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium shrink-0">
                          {p.numeroParcela}/{p.totalParcelas}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{formatDate(p.dataCompra)}</span>
                      {p.categoria && <span className="text-[11px] text-muted-foreground">· {p.categoria}</span>}
                      {p.totalParcelas > 1 && (
                        <span className="text-[11px] text-muted-foreground">· Total {formatCurrency(p.valorTotal)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-semibold tabular-nums">{formatCurrency(p.valor)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && fatura.parcelas.length === 0 && (
        <div className="border-t border-border/40 px-4 py-3">
          <p className="text-xs text-muted-foreground text-center">Nenhum lançamento nesta fatura.</p>
        </div>
      )}
    </div>
  );
}

function FaturaView({ cartaoId, cartaoNome }: { cartaoId: number; cartaoNome: string }) {
  const { data: faturas, isLoading, isError } = useFaturas(cartaoId);

  if (isLoading) return <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (isError || !faturas || faturas.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">Sem faturas pendentes para este cartão.</p>;

  const totalGeral = faturas.reduce((s, f) => s + f.total, 0);
  const totalLancamentos = faturas.reduce((s, f) => s + f.parcelas.length, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Total pendente</p>
          <p className="text-xl font-bold tracking-tight">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="text-right space-y-0.5">
          <p className="text-xs text-muted-foreground">{faturas.length} {faturas.length === 1 ? "fatura" : "faturas"}</p>
          <p className="text-xs text-muted-foreground">{totalLancamentos} {totalLancamentos === 1 ? "lançamento" : "lançamentos"}</p>
        </div>
      </div>

      {/* Accordion faturas */}
      <div className="space-y-2">
        {faturas.map((fatura, i) => (
          <FaturaSection key={fatura.faturaId} fatura={fatura} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}

export default function CartoesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Cartao | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingFaturaId, setViewingFaturaId] = useState<{ id: number; nome: string } | null>(null);

  const { data: cartoes = [], isLoading } = useCartoes();
  const criarCartao = useCriarCartao();
  const atualizarCartao = useAtualizarCartao();
  const desativarCartao = useDesativarCartao();

  const form = useForm<CartaoData>({
    resolver: zodResolver(cartaoSchema),
    defaultValues: { nome: "", limite: "", diaVencimento: "" },
  });

  const editFormState = useForm<CartaoData>({
    resolver: zodResolver(cartaoSchema),
  });

  const onSubmitCreate = (data: CartaoData) => {
    criarCartao.mutate(
      {
        nome: data.nome,
        limite: parseFloat(data.limite.replace(",", ".")),
        diaVencimento: parseInt(data.diaVencimento),
      },
      {
        onSuccess: () => {
          form.reset();
          setShowForm(false);
        },
      }
    );
  };

  const onSubmitEdit = (data: CartaoData) => {
    if (!editingCard) return;
    atualizarCartao.mutate(
      {
        id: editingCard.id,
        data: {
          nome: data.nome,
          limite: parseFloat(data.limite.replace(",", ".")),
          diaVencimento: parseInt(data.diaVencimento),
        },
      },
      { onSuccess: () => setEditingCard(null) }
    );
  };

  const onDelete = () => {
    if (deletingId === null) return;
    desativarCartao.mutate(deletingId, { onSuccess: () => setDeletingId(null) });
  };

  const openEdit = (cartao: Cartao) => {
    editFormState.reset({
      nome: cartao.nome,
      limite: cartao.limite.toFixed(2).replace(".", ","),
      diaVencimento: cartao.diaVencimento.toString(),
    });
    setEditingCard(cartao);
  };

  return (
    <PageShell>
      <PageHeader title="Cartões de Crédito" description="Gerencie seus cartões e visualize faturas">
        <Button onClick={() => setShowForm(true)} className="gap-2 shadow-premium">
          <Plus className="h-4 w-4" />
          Novo Cartão
        </Button>
      </PageHeader>

      {isLoading ? (
        <CardSkeleton count={3} />
      ) : cartoes.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {cartoes.map((cartao, i) => (
              <motion.div
                key={cartao.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
                className="group relative"
              >
                {/* Card visual */}
                <div className={`rounded-2xl bg-linear-to-br ${cardGradients[i % cardGradients.length]} p-6 text-white shadow-xl shadow-black/20 dark:shadow-black/40 relative overflow-hidden transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl noise-overlay`}>
                  {/* Background pattern */}
                  <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-white/[0.04] -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/[0.04] translate-y-1/2 -translate-x-1/2" />
                  {/* Holographic shimmer overlay */}
                  <div className="absolute inset-0 holographic opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-overlay" />
                  {/* Subtle line pattern */}
                  <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />
                  <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-white/[0.04] to-transparent" />

                  <div className="relative z-10 space-y-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* Chip pattern */}
                        <div className="chip-pattern" />
                        <Wifi className="h-5 w-5 opacity-50 rotate-90" />
                      </div>
                      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/15 backdrop-blur-sm" onClick={() => setViewingFaturaId({ id: cartao.id, nome: cartao.nome })}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/15 backdrop-blur-sm" onClick={() => openEdit(cartao)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-red-300 hover:bg-white/15 backdrop-blur-sm" onClick={() => setDeletingId(cartao.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] opacity-50 font-semibold">Limite disponível</p>
                      <p className="text-2xl font-extrabold tabular-nums mt-1 tracking-tight">{formatCurrency(cartao.limiteDisponivel ?? cartao.limite)}</p>
                      {cartao.limiteUsado > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] opacity-60 mb-1">
                            <span>Usado: {formatCurrency(cartao.limiteUsado)}</span>
                            <span>{((cartao.limiteUsado / cartao.limite) * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/20 overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-white/70 transition-all duration-500" 
                              style={{ width: `${Math.min((cartao.limiteUsado / cartao.limite) * 100, 100)}%` }} 
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <p className="text-sm font-bold tracking-tight">{cartao.nome}</p>
                        <p className="text-[10px] opacity-40 mt-0.5 font-medium">Fechamento: 1º dia útil</p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 backdrop-blur-sm">
                        <Calendar className="h-3 w-3 opacity-70" />
                        <span className="text-xs font-semibold opacity-90">Dia {cartao.diaVencimento}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" />}
          title="Nenhum cartão"
          description="Adicione um cartão de crédito para começar a rastrear suas faturas"
          action={<Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="h-4 w-4" />Adicionar cartão</Button>}
        />
      )}

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cartão</DialogTitle>
            <DialogDescription>Adicione um cartão de crédito à sua conta</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-5">
            <div className="space-y-2">
              <Label>Nome do cartão</Label>
              <Input placeholder="Ex: Nubank, Inter..." className="h-11" {...form.register("nome")} />
              {form.formState.errors.nome && <p className="text-xs text-red-500">{form.formState.errors.nome.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Limite (R$)</Label>
              <Input placeholder="0,00" className="h-11 tabular-nums" {...form.register("limite")} />
              {form.formState.errors.limite && <p className="text-xs text-red-500">{form.formState.errors.limite.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Dia de vencimento</Label>
              <Input placeholder="Ex: 10" className="h-11" {...form.register("diaVencimento")} />
              {form.formState.errors.diaVencimento && <p className="text-xs text-red-500">{form.formState.errors.diaVencimento.message}</p>}
            </div>
            <div className="rounded-lg bg-muted/60 p-3 border border-border">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span><strong>Fechamento:</strong> 1º dia útil do mês (automático)</span>
              </p>
            </div>
            <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={criarCartao.isPending}>
              {criarCartao.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4" />Criar cartão</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editingCard !== null} onOpenChange={() => setEditingCard(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cartão</DialogTitle>
            <DialogDescription>Altere os dados do cartão</DialogDescription>
          </DialogHeader>
          <form onSubmit={editFormState.handleSubmit(onSubmitEdit)} className="space-y-5">
            <div className="space-y-2">
              <Label>Nome do cartão</Label>
              <Input className="h-11" {...editFormState.register("nome")} />
              {editFormState.formState.errors.nome && <p className="text-xs text-red-500">{editFormState.formState.errors.nome.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Limite (R$)</Label>
              <Input className="h-11 tabular-nums" {...editFormState.register("limite")} />
              {editFormState.formState.errors.limite && <p className="text-xs text-red-500">{editFormState.formState.errors.limite.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Dia de vencimento</Label>
              <Input className="h-11" {...editFormState.register("diaVencimento")} />
              {editFormState.formState.errors.diaVencimento && <p className="text-xs text-red-500">{editFormState.formState.errors.diaVencimento.message}</p>}
            </div>
            <div className="rounded-lg bg-muted/60 p-3 border border-border">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span><strong>Fechamento:</strong> 1º dia útil do mês (automático)</span>
              </p>
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={atualizarCartao.isPending}>
              {atualizarCartao.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fatura Dialog */}
      <Dialog open={viewingFaturaId !== null} onOpenChange={() => setViewingFaturaId(null)}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {viewingFaturaId?.nome}
            </DialogTitle>
            <DialogDescription>Faturas pendentes</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-5 pb-5 pt-2">
            {viewingFaturaId && (
              <FaturaView cartaoId={viewingFaturaId.id} cartaoNome={viewingFaturaId.nome} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cartão?</AlertDialogTitle>
            <AlertDialogDescription>O cartão será desativado e não aparecerá mais na listagem. As faturas existentes serão mantidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {desativarCartao.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
