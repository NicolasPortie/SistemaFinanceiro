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
  ArrowUpFromLine,
  Shield,
  Info,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { CurrencyInput } from "@/components/ui/currency-input";
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
  const [garantiaCard, setGarantiaCard] = useState<Cartao | null>(null);
  const [garantiaTab, setGarantiaTab] = useState<string>("adicionar");

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
  const novoLimiteCalculado = (garantiaCard?.limite || 0) + valorAdicionalWatch + valorExtraCalculado;

  // ── Resgate form ──
  const resgateForm = useForm<{ valorResgate: string }>({ defaultValues: { valorResgate: "" } });
  const PERCENTUAL_BONUS_FIXO = 40;
  const valorResgateRaw = parseFloat(resgateForm.watch("valorResgate")?.replace(",", ".") || "0");
  const valorResgateBase = Math.floor(valorResgateRaw);  // Backend usa Math.Floor
  const garantiaDisponivel = garantiaCard?.garantia || 0;
  const resgateExcedeGarantia = valorResgateBase > garantiaDisponivel;
  const reducaoLimite = valorResgateBase * (1 + PERCENTUAL_BONUS_FIXO / 100);
  const novoLimiteResgate = (garantiaCard?.limite || 0) - reducaoLimite;
  const maxResgatePermitido = Math.min(garantiaDisponivel, Math.floor((garantiaCard?.limite || 0) / (1 + PERCENTUAL_BONUS_FIXO / 100)));

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
      limite: cartao.limiteBase.toFixed(2).replace(".", ","),
      diaFechamento: cartao.diaFechamento.toString(),
      diaVencimento: cartao.diaVencimento.toString(),
    });
    setEditingCard(cartao);
  };

  const openGarantia = (cartao: Cartao, tab: string = "adicionar") => {
    ajusteForm.reset({ valorAdicional: "", percentualExtra: "40" });
    resgateForm.reset({ valorResgate: "" });
    setGarantiaTab(tab);
    setGarantiaCard(cartao);
  };

  const onSubmitAjuste = (data: { valorAdicional: string; percentualExtra: string }) => {
    if (!garantiaCard) return;
    adicionarLimiteExtra.mutate(
      {
        id: garantiaCard.id,
        data: {
          valorAdicional: parseFloat(data.valorAdicional.replace(",", ".")),
          percentualExtra: parseFloat(data.percentualExtra.replace(",", ".")),
        },
      },
      {
        onSuccess: () => setGarantiaCard(null),
      }
    );
  };

  const onSubmitResgate = (data: { valorResgate: string }) => {
    if (!garantiaCard) return;
    if (resgateExcedeGarantia || novoLimiteResgate < 0) return;
    resgatarLimiteExtra.mutate(
      {
        id: garantiaCard.id,
        data: {
          valorResgate: parseFloat(data.valorResgate.replace(",", ".")),
          percentualBonus: PERCENTUAL_BONUS_FIXO,
        },
      },
      {
        onSuccess: () => setGarantiaCard(null),
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
        <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Cartões"
            value={cartoes.length}
            icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="neutral"
            delay={0}
          />
          <StatCard
            title="Limite Total (todos)"
            value={formatCurrency(totalLimite)}
            icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="neutral"
            delay={1}
          />
          <StatCard
            title="Fatura Aberta Atual"
            value={formatCurrency(totalUsado)}
            icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            trend="down"
            delay={2}
          />
          <StatCard
            title="Crédito Disponível"
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
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-white/70 hover:text-emerald-300 hover:bg-white/15 backdrop-blur-sm" onClick={() => openGarantia(cartao)}>
                                  <Shield className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Garantia</TooltipContent>
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
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] opacity-60 mb-1">
                            <span>Usado: {formatCurrency(cartao.limiteUsado)}</span>
                            <span>de {formatCurrency(cartao.limite)}</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/20 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-white/70 transition-all duration-500"
                              style={{ width: `${Math.min((cartao.limiteUsado / cartao.limite) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold tracking-tight truncate">{cartao.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] opacity-40 font-medium">Fecha dia {cartao.diaFechamento} · Vence dia {cartao.diaVencimento}</p>
                          </div>
                        </div>
                        {cartao.garantia > 0 && (
                          <div className="flex items-center gap-1 bg-emerald-500/20 rounded-lg px-2 py-1 backdrop-blur-sm shrink-0">
                            <Shield className="h-3 w-3 text-emerald-300" />
                            <span className="text-[10px] font-semibold text-emerald-300 tabular-nums">{formatCurrency(cartao.garantia)}</span>
                          </div>
                        )}
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
                    <CurrencyInput
                      placeholder="0,00"
                      className="h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                      value={form.watch("limite")}
                      onValueChange={(v) => form.setValue("limite", v, { shouldValidate: form.formState.isSubmitted })}
                    />
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
                <CurrencyInput
                  className="h-11 rounded-xl pl-9 tabular-nums font-semibold"
                  value={editFormState.watch("limite") ?? ""}
                  onValueChange={(v) => editFormState.setValue("limite", v, { shouldValidate: editFormState.formState.isSubmitted })}
                />
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

      {/* Garantia / Limite Extra — Dialog unificado */}
      <Dialog open={garantiaCard !== null} onOpenChange={() => setGarantiaCard(null)}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          {/* Header com infos do cartão */}
          <div className="px-6 pt-6 pb-4 space-y-3">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-500" />
                Garantia — {garantiaCard?.nome}
              </DialogTitle>
              <DialogDescription>
                Adicione ou resgate a garantia deste cartão.
              </DialogDescription>
            </DialogHeader>

            {/* Explicação da Garantia */}
            <div className="rounded-xl bg-blue-500/8 border border-blue-500/15 p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Como funciona?
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A garantia é um valor que você deposita para aumentar o limite do cartão. O banco concede um bônus de {PERCENTUAL_BONUS_FIXO}% sobre o valor depositado. 
                Exemplo: depositar R$ 1.000 aumenta seu limite em R$ 1.400 (R$ 1.000 + 40% de bônus).
              </p>
            </div>

            {/* Resumo compacto */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/20 border border-border/30 p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Limite Atual</p>
                <p className="text-base font-extrabold tabular-nums mt-0.5">{formatCurrency(garantiaCard?.limite || 0)}</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-semibold">Garantia Investida</p>
                <p className="text-base font-extrabold tabular-nums mt-0.5 text-emerald-600 dark:text-emerald-400">{formatCurrency(garantiaDisponivel)}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={garantiaTab} onValueChange={(v) => setGarantiaTab(v)} className="gap-0">
            <div className="px-6">
              <TabsList className="w-full">
                <TabsTrigger value="adicionar" className="gap-1.5">
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                  Adicionar
                </TabsTrigger>
                <TabsTrigger value="resgatar" className="gap-1.5">
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  Resgatar
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Tab: Adicionar ── */}
            <TabsContent value="adicionar" className="px-6 pb-6 pt-4">
              <form onSubmit={ajusteForm.handleSubmit(onSubmitAjuste)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor da garantia (R$)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <CurrencyInput
                      className="h-12 rounded-xl pl-9 tabular-nums font-bold text-lg"
                      placeholder="0,00"
                      value={ajusteForm.watch("valorAdicional")}
                      onValueChange={(v) => ajusteForm.setValue("valorAdicional", v)}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/60">Bônus de {percentualExtraWatch}% será aplicado automaticamente (+{formatCurrency(valorExtraCalculado)}).</p>
                </div>

                {/* Preview */}
                <div className="rounded-xl bg-muted/20 p-4 space-y-2.5 border border-border/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground/70 font-medium">Aumento no limite (×{(1 + percentualExtraWatch / 100).toFixed(1)}):</span>
                    <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+ {formatCurrency(valorAdicionalWatch + valorExtraCalculado)}</span>
                  </div>
                  <div className="h-px bg-border/30" />
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-foreground text-sm">Novo Limite:</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums text-base">{formatCurrency(novoLimiteCalculado)}</span>
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 rounded-2xl font-bold text-[15px] gap-2 shadow-premium btn-premium" disabled={adicionarLimiteExtra.isPending || valorAdicionalWatch <= 0}>
                  {adicionarLimiteExtra.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <><ArrowUpFromLine className="h-4.5 w-4.5" /> Adicionar Garantia</>}
                </Button>
              </form>
            </TabsContent>

            {/* ── Tab: Resgatar ── */}
            <TabsContent value="resgatar" className="px-6 pb-6 pt-4">
              {garantiaDisponivel <= 0 ? (
                <div className="text-center py-8 space-y-3">
                  <div className="mx-auto h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhuma garantia investida para resgatar.</p>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setGarantiaTab("adicionar")}>
                    Adicionar garantia
                  </Button>
                </div>
              ) : (
                <form onSubmit={resgateForm.handleSubmit(onSubmitResgate)} className="space-y-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor a Resgatar (R$)</Label>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        onClick={() => resgateForm.setValue("valorResgate", maxResgatePermitido.toString().replace(".", ","))}
                      >
                        Máx: {formatCurrency(maxResgatePermitido)}
                      </button>
                    </div>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                      <CurrencyInput
                        className={`h-11 rounded-xl pl-9 tabular-nums font-semibold ${resgateExcedeGarantia && valorResgateBase > 0 ? 'border-red-500 focus-visible:ring-red-500/30' : ''}`}
                        placeholder="0,00"
                        value={resgateForm.watch("valorResgate")}
                        onValueChange={(v) => resgateForm.setValue("valorResgate", v)}
                      />
                    </div>
                    {resgateExcedeGarantia && valorResgateBase > 0 && (
                      <p className="text-[11px] text-red-500 font-medium">Valor excede a garantia disponível ({formatCurrency(garantiaDisponivel)})</p>
                    )}
                  </div>

                  {/* Preview */}
                  <div className="rounded-xl bg-muted/20 p-4 space-y-2.5 border border-border/30">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground/70 font-medium">Valor devolvido:</span>
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+ {formatCurrency(valorResgateBase)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground/70 font-medium">Limite reduzido (×{(1 + PERCENTUAL_BONUS_FIXO / 100).toFixed(1)}):</span>
                      <span className="font-bold tabular-nums text-red-500">- {formatCurrency(reducaoLimite)}</span>
                    </div>
                    <div className="h-px bg-border/30" />
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-foreground text-sm">Novo Limite:</span>
                      <span className={`font-extrabold tabular-nums text-base ${novoLimiteResgate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{formatCurrency(novoLimiteResgate)}</span>
                    </div>
                  </div>

                  {novoLimiteResgate < 0 && valorResgateBase > 0 && !resgateExcedeGarantia && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                      <p className="text-[11px] text-red-500 font-medium">O limite ficaria negativo. Reduza o valor.</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-2xl font-bold text-[15px] gap-2 shadow-premium bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                    disabled={resgatarLimiteExtra.isPending || novoLimiteResgate < 0 || valorResgateBase < 1 || resgateExcedeGarantia}
                  >
                    {resgatarLimiteExtra.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <><ArrowDownToLine className="h-4.5 w-4.5" /> Resgatar Garantia</>}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
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
