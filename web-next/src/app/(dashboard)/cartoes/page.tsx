"use client";

import { useState } from "react";
import {
  useCartoes,
  useCriarCartao,
  useAtualizarCartao,
  useDesativarCartao,
  useAdicionarLimiteExtra,
  useResgatarLimiteExtra,
} from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/format";
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
  Wifi,
  TrendingUp,
  DollarSign,
  Wallet,
  ArrowDownToLine,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  StatCard,
  EmptyState,
  CardSkeleton,
} from "@/components/shared/page-components";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FaturaView } from "@/components/cartoes/fatura-view";

const cardGradients = [
  "from-violet-600 to-purple-700",
  "from-blue-600 to-indigo-700",
  "from-emerald-600 to-teal-700",
  "from-rose-600 to-pink-700",
  "from-amber-600 to-orange-700",
  "from-cyan-600 to-sky-700",
];

export default function CartoesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Cartao | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingFaturaId, setViewingFaturaId] = useState<{ id: number; nome: string } | null>(null);
  const [ajusteLimiteCard, setAjusteLimiteCard] = useState<Cartao | null>(null);
  const [resgatarLimiteCard, setResgatarLimiteCard] = useState<Cartao | null>(null);

  const { data: cartoes = [], isLoading } = useCartoes();
  const criarCartao = useCriarCartao();
  const atualizarCartao = useAtualizarCartao();
  const desativarCartao = useDesativarCartao();
  const adicionarLimiteExtra = useAdicionarLimiteExtra();
  const resgatarLimiteExtra = useResgatarLimiteExtra();

  const form = useForm<CartaoData>({
    resolver: zodResolver(cartaoSchema),
    defaultValues: { nome: "", limite: "", diaFechamento: "", diaVencimento: "" },
  });

  const editFormState = useForm<CartaoData>({
    resolver: zodResolver(cartaoSchema),
  });

  const ajusteForm = useForm<{ valorAdicional: string; percentualExtra: string }>({
    defaultValues: { valorAdicional: "", percentualExtra: "40" }
  });

  const valorAdicionalWatch = parseFloat(ajusteForm.watch("valorAdicional")?.replace(",", ".") || "0");
  const percentualExtraWatch = parseFloat(ajusteForm.watch("percentualExtra")?.replace(",", ".") || "0");
  const valorExtraCalculado = valorAdicionalWatch * (percentualExtraWatch / 100);
  const novoLimiteCalculado = (ajusteLimiteCard?.limite || 0) + valorAdicionalWatch + valorExtraCalculado;

  // ── Resgate form ──
  const resgateForm = useForm<{ valorResgate: string }>({ defaultValues: { valorResgate: "" } });
  const PERCENTUAL_BONUS_FIXO = 40;
  const valorResgateRaw = parseFloat(resgateForm.watch("valorResgate")?.replace(",", ".") || "0");
  const valorResgateBase = Math.floor(valorResgateRaw);  // Backend usa Math.Floor
  const reducaoLimite = valorResgateBase * (1 + PERCENTUAL_BONUS_FIXO / 100);
  const novoLimiteResgate = (resgatarLimiteCard?.limite || 0) - reducaoLimite;

  const onSubmitCreate = (data: CartaoData) => {
    criarCartao.mutate(
      {
        nome: data.nome,
        limite: parseFloat(data.limite.replace(",", ".")),
        diaFechamento: parseInt(data.diaFechamento),
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
          diaFechamento: parseInt(data.diaFechamento),
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
      diaFechamento: cartao.diaFechamento.toString(),
      diaVencimento: cartao.diaVencimento.toString(),
    });
    setEditingCard(cartao);
  };

  const openAjuste = (cartao: Cartao) => {
    ajusteForm.reset({ valorAdicional: "", percentualExtra: "40" });
    setAjusteLimiteCard(cartao);
  };

  const onSubmitAjuste = (data: { valorAdicional: string; percentualExtra: string }) => {
    if (!ajusteLimiteCard) return;
    adicionarLimiteExtra.mutate(
      {
        id: ajusteLimiteCard.id,
        data: {
          valorAdicional: parseFloat(data.valorAdicional.replace(",", ".")),
          percentualExtra: parseFloat(data.percentualExtra.replace(",", ".")),
        },
      },
      {
        onSuccess: () => setAjusteLimiteCard(null),
      }
    );
  };

  const openResgate = (cartao: Cartao) => {
    resgateForm.reset({ valorResgate: "" });
    setResgatarLimiteCard(cartao);
  };

  const onSubmitResgate = (data: { valorResgate: string }) => {
    if (!resgatarLimiteCard) return;
    resgatarLimiteExtra.mutate(
      {
        id: resgatarLimiteCard.id,
        data: {
          valorResgate: parseFloat(data.valorResgate.replace(",", ".")),
          percentualBonus: PERCENTUAL_BONUS_FIXO,
        },
      },
      {
        onSuccess: () => setResgatarLimiteCard(null),
      }
    );
  };

  const totalLimite = cartoes.reduce((s, c) => s + c.limite, 0);
  const totalUsado = cartoes.reduce((s, c) => s + c.limiteUsado, 0);
  const totalDisponivel = cartoes.reduce((s, c) => s + (c.limiteDisponivel ?? c.limite), 0);

  return (
    <PageShell>
      {/* ── Page Header ── */}
      <PageHeader title="Cartões de Crédito" description="Gerencie seus cartões e visualize faturas">
        <Button onClick={() => setShowForm(true)} className="gap-2 h-10 px-5 rounded-xl shadow-premium font-semibold">
          <Plus className="h-4 w-4" />
          Novo Cartão
        </Button>
      </PageHeader>

      {/* ── Stat Cards ── */}
      {!isLoading && cartoes.length > 0 && (
        <div className="grid gap-2 sm:gap-4 grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Cartões"
            value={cartoes.length}
            icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="neutral"
            delay={0}
          />
          <StatCard
            title="Limite Total"
            value={formatCurrency(totalLimite)}
            icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="neutral"
            delay={1}
          />
          <StatCard
            title="Fatura Atual"
            value={formatCurrency(totalUsado)}
            icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="down"
            delay={2}
          />
          <StatCard
            title="Disponível"
            value={formatCurrency(totalDisponivel)}
            icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="up"
            delay={3}
          />
        </div>
      )}

      {
        isLoading ? (
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
                  <div className={`rounded-2xl bg-linear-to-br ${cardGradients[i % cardGradients.length]} p-6 text-white shadow-xl shadow-black/20 dark:shadow-black/40 relative overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:scale-[1.01] noise-overlay`}>
                    {/* Background pattern */}
                    <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-white/4 -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/4 translate-y-1/2 -translate-x-1/2" />
                    {/* Holographic shimmer overlay */}
                    <div className="absolute inset-0 holographic opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-overlay" />
                    {/* Subtle line pattern */}
                    <div className="absolute top-0 left-1/4 w-px h-full bg-linear-to-b from-transparent via-white/6 to-transparent" />
                    <div className="absolute top-0 right-1/3 w-px h-full bg-linear-to-b from-transparent via-white/4 to-transparent" />

                    <div className="relative z-10 space-y-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {/* Chip pattern */}
                          <div className="chip-pattern" />
                          <Wifi className="h-5 w-5 opacity-50 rotate-90" />
                        </div>
                        <TooltipProvider>
                          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/15 backdrop-blur-sm" onClick={() => setViewingFaturaId({ id: cartao.id, nome: cartao.nome })}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver fatura</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/15 backdrop-blur-sm" onClick={() => openEdit(cartao)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-emerald-300 hover:bg-white/15 backdrop-blur-sm" onClick={() => openAjuste(cartao)}>
                                  <TrendingUp className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Limite extra
                                {cartao.garantia > 0 && <span className="block text-emerald-300 font-semibold tabular-nums text-[10px] mt-0.5">Inv.: {formatCurrency(cartao.garantia)}</span>}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-amber-300 hover:bg-white/15 backdrop-blur-sm" onClick={() => openResgate(cartao)}>
                                  <ArrowDownToLine className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Resgatar garantia
                                {cartao.garantia > 0 && <span className="block text-amber-300 font-semibold tabular-nums text-[10px] mt-0.5">Inv.: {formatCurrency(cartao.garantia)}</span>}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-red-300 hover:bg-white/15 backdrop-blur-sm" onClick={() => setDeletingId(cartao.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Desativar</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
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
            action={<Button onClick={() => setShowForm(true)} className="gap-2 rounded-xl font-semibold shadow-premium btn-premium"><Plus className="h-4 w-4" />Adicionar cartão</Button>}
          />
        )}

      {/* Create Sheet */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="w-full sm:w-125 sm:max-w-125 overflow-hidden">
          {/* Accent line */}
          <div className="h-1 w-full shrink-0 bg-linear-to-r from-violet-400 via-purple-500 to-indigo-500" />

          {/* Header */}
          <SheetHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-violet-500/10 text-violet-500 transition-all duration-500">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg sm:text-xl font-semibold">Novo Cartão</SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">Adicione um cartão de crédito à sua conta</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={form.handleSubmit(onSubmitCreate)} className="px-5 sm:px-7 pb-8 space-y-4 sm:space-y-5">
              {/* Main fields */}
              <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome do cartão</Label>
                  <Input placeholder="Ex: Nubank, Inter..." className="h-11 rounded-xl border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" {...form.register("nome")} />
                  {form.formState.errors.nome && <p className="text-xs text-red-500 font-medium">{form.formState.errors.nome.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Limite (R$)</Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-violet-500/10 text-violet-500">R$</div>
                    <Input placeholder="0,00" className="h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" {...form.register("limite")} />
                  </div>
                  {form.formState.errors.limite && <p className="text-xs text-red-500 font-medium">{form.formState.errors.limite.message}</p>}
                </div>

                <div className="border-t border-border/20" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dia de fechamento</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                      <Input placeholder="Ex: 15" className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" {...form.register("diaFechamento")} />
                    </div>
                    {form.formState.errors.diaFechamento && <p className="text-xs text-red-500 font-medium">{form.formState.errors.diaFechamento.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dia de vencimento</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                      <Input placeholder="Ex: 25" className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" {...form.register("diaVencimento")} />
                    </div>
                    {form.formState.errors.diaVencimento && <p className="text-xs text-red-500 font-medium">{form.formState.errors.diaVencimento.message}</p>}
                  </div>
                </div>
              </div>

              {/* Info card */}
              <div className="rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span><strong>Fechamento:</strong> dia em que a fatura fecha. Compras após essa data entram na fatura seguinte.</span>
                </p>
              </div>

              {/* Submit */}
              <div className="pt-2 sm:pt-3 pb-safe">
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-semibold text-sm sm:text-[15px] bg-linear-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 text-white transition-all duration-300 cursor-pointer active:scale-[0.98]"
                  disabled={criarCartao.isPending}
                >
                  {criarCartao.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CreditCard className="h-5 w-5" />Criar Cartão</>}
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={editingCard !== null} onOpenChange={() => setEditingCard(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Editar Cartão</DialogTitle>
            <DialogDescription>Altere os dados do cartão</DialogDescription>
          </DialogHeader>
          <form onSubmit={editFormState.handleSubmit(onSubmitEdit)} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome do cartão</Label>
              <Input className="h-11 rounded-xl" {...editFormState.register("nome")} />
              {editFormState.formState.errors.nome && <p className="text-xs text-red-500">{editFormState.formState.errors.nome.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Limite (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input className="h-11 rounded-xl pl-9 tabular-nums font-semibold" {...editFormState.register("limite")} />
              </div>
              {editFormState.formState.errors.limite && <p className="text-xs text-red-500">{editFormState.formState.errors.limite.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia de fechamento</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input className="h-11 rounded-xl pl-9" {...editFormState.register("diaFechamento")} />
                </div>
                {editFormState.formState.errors.diaFechamento && <p className="text-xs text-red-500">{editFormState.formState.errors.diaFechamento.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia de vencimento</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input className="h-11 rounded-xl pl-9" {...editFormState.register("diaVencimento")} />
                </div>
                {editFormState.formState.errors.diaVencimento && <p className="text-xs text-red-500">{editFormState.formState.errors.diaVencimento.message}</p>}
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-4 border border-border/30">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span><strong>Fechamento:</strong> dia em que a fatura fecha. Compras após essa data entram na fatura seguinte.</span>
              </p>
            </div>
            <Button type="submit" className="w-full h-13 rounded-2xl font-bold text-[15px] shadow-premium btn-premium" disabled={atualizarCartao.isPending}>
              {atualizarCartao.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : "Salvar alterações"}
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
              <FaturaView cartaoId={viewingFaturaId.id} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Ajuste Limite Dialog */}
      <Dialog open={ajusteLimiteCard !== null} onOpenChange={() => setAjusteLimiteCard(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Limite Extra</DialogTitle>
            <DialogDescription>
              Adicione um valor ao limite e aplique um percentual extra.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={ajusteForm.handleSubmit(onSubmitAjuste)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor Adicional (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    className="h-11 rounded-xl pl-9 tabular-nums font-semibold"
                    placeholder="0,00"
                    {...ajusteForm.register("valorAdicional", { required: true })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Percentual Extra (%)</Label>
                <Input
                  className="h-11 rounded-xl tabular-nums font-semibold"
                  placeholder="40"
                  {...ajusteForm.register("percentualExtra", { required: true })}
                />
              </div>
            </div>

            {/* Live Calculation Preview */}
            <div className="rounded-xl bg-muted/20 p-5 space-y-3 border border-border/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground/70 font-medium">Limite Atual:</span>
                <span className="font-bold tabular-nums">{formatCurrency(ajusteLimiteCard?.limite || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground/70 font-medium">Valor Base:</span>
                <span className="font-bold tabular-nums">+ {formatCurrency(valorAdicionalWatch)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground/70 font-medium">Extra ({percentualExtraWatch}%):</span>
                <span className="font-bold tabular-nums">+ {formatCurrency(valorExtraCalculado)}</span>
              </div>
              <div className="h-px bg-border/30 my-2" />
              <div className="flex justify-between items-center text-base">
                <span className="font-extrabold text-foreground">Novo Limite:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(novoLimiteCalculado)}</span>
              </div>
            </div>

            <Button type="submit" className="w-full h-13 rounded-2xl font-bold text-[15px] gap-2 shadow-premium btn-premium" disabled={adicionarLimiteExtra.isPending}>
              {adicionarLimiteExtra.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <><TrendingUp className="h-4.5 w-4.5" /> Aplicar Limite Extra</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resgatar Limite Dialog */}
      <Dialog open={resgatarLimiteCard !== null} onOpenChange={() => setResgatarLimiteCard(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Resgatar Garantia</DialogTitle>
            <DialogDescription>
              Retire uma garantia do cartão <strong>{resgatarLimiteCard?.nome}</strong> e libere o saldo comprometido.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={resgateForm.handleSubmit(onSubmitResgate)} className="space-y-6">
            {/* Show Available Guarantee */}
            <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2 text-violet-500">
                <Wallet className="h-4 w-4" />
                <span className="text-sm font-semibold">Garantia Investida</span>
              </div>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(resgatarLimiteCard?.garantia || 0)}
              </span>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor a Resgatar (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  className="h-11 rounded-xl pl-9 tabular-nums font-semibold"
                  placeholder="0,00"
                  {...resgateForm.register("valorResgate", { required: true })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Percentual Bônus (%)</Label>
              <Input
                className="h-11 rounded-xl tabular-nums font-semibold bg-muted/30 cursor-not-allowed"
                value={PERCENTUAL_BONUS_FIXO}
                disabled
                readOnly
              />
              <p className="text-[11px] text-muted-foreground/60">Fixo em {PERCENTUAL_BONUS_FIXO}% — mesmo valor usado na adição.</p>
            </div>

            {/* Live Calculation Preview */}
            <div className="rounded-xl bg-muted/20 p-5 space-y-3 border border-border/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground/70 font-medium">Limite Atual:</span>
                <span className="font-bold tabular-nums">{formatCurrency(resgatarLimiteCard?.limite || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground/70 font-medium">Garantia devolvida:</span>
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+ {formatCurrency(valorResgateBase)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground/70 font-medium">Bônus removido ({PERCENTUAL_BONUS_FIXO}%):</span>
                <span className="font-bold tabular-nums text-red-500">- {formatCurrency(valorResgateBase * (PERCENTUAL_BONUS_FIXO / 100))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground/70 font-medium">Redução total no limite:</span>
                <span className="font-bold tabular-nums text-red-500">- {formatCurrency(reducaoLimite)}</span>
              </div>
              <div className="h-px bg-border/30 my-2" />
              <div className="flex justify-between items-center text-base">
                <span className="font-extrabold text-foreground">Novo Limite:</span>
                <span className={`font-extrabold tabular-nums ${novoLimiteResgate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{formatCurrency(novoLimiteResgate)}</span>
              </div>
            </div>

            {novoLimiteResgate < 0 && valorResgateBase > 0 && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-xs text-red-500 font-medium">⚠️ O novo limite ficaria negativo. Reduza o valor de resgate.</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-13 rounded-2xl font-bold text-[15px] gap-2 shadow-premium bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
              disabled={resgatarLimiteExtra.isPending || novoLimiteResgate < 0 || valorResgateBase < 1}
            >
              {resgatarLimiteExtra.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <><ArrowDownToLine className="h-4.5 w-4.5" /> Resgatar Garantia</>}
            </Button>
          </form>
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
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2">
              {desativarCartao.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" />Desativar</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
