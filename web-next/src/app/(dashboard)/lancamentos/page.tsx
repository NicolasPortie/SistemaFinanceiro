"use client";

import { useState, useMemo } from "react";
import {
  useResumo,
  useCategorias,
  useCartoes,
  useCriarLancamento,
  useLancamentos,
  useAtualizarLancamento,
  useRemoverLancamento,
  queryKeys,
} from "@/hooks/use-queries";
import { formatCurrency, formatDate, formatFormaPagamento } from "@/lib/format";
import {
  lancamentoSchema,
  editarLancamentoSchema,
  type LancamentoData,
  type EditarLancamentoData,
} from "@/lib/schemas";
import type { Lancamento } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Receipt,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  Pencil,
  Trash2,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  CreditCard,
  Banknote,
  Smartphone,
  Calendar,
  Tag,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  StatCard,
  EmptyState,
  ErrorState,
  CardSkeleton,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useQueryClient } from "@tanstack/react-query";

export default function LancamentosPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Lancamento | null>(null);
  const [viewingItem, setViewingItem] = useState<Lancamento | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const queryClient = useQueryClient();

  const { data: resumo, isLoading: loadingResumo, isError, error } = useResumo();
  const { data: categorias = [] } = useCategorias();
  const { data: cartoes = [] } = useCartoes();
  const criarLancamento = useCriarLancamento();
  const atualizarLancamento = useAtualizarLancamento();
  const removerLancamento = useRemoverLancamento();

  const listParams = useMemo(
    () => ({
      tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
      categoriaId:
        filtroCategoria !== "todas"
          ? categorias.find((c) => c.nome === filtroCategoria)?.id
          : undefined,
      busca: busca.trim() ? busca.trim() : undefined,
      pagina,
      tamanhoPagina: 15,
    }),
    [filtroTipo, filtroCategoria, busca, pagina, categorias]
  );

  const { data: lancamentosData, isLoading: loadingLancamentos } = useLancamentos(listParams);

  const form = useForm<LancamentoData>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: { descricao: "", valor: "", tipo: "despesa", categoria: "", cartaoId: "", formaPagamento: "", numeroParcelas: "" },
  });

  const editForm = useForm<EditarLancamentoData>({
    resolver: zodResolver(editarLancamentoSchema),
  });

  const tipoSelecionado = useWatch({ control: form.control, name: "tipo" });
  const categoriaSelecionada = useWatch({ control: form.control, name: "categoria" });
  const cartaoSelecionado = useWatch({ control: form.control, name: "cartaoId" });
  const formaPagamentoSelecionada = useWatch({ control: form.control, name: "formaPagamento" });

  const onSubmit = async (data: LancamentoData) => {
    const valor = parseFloat(data.valor.replace(",", "."));

    // Determinar forma de pagamento
    let formaPagamento: 1 | 2 | 3 = 2;
    let cartaoId: number | undefined;
    let parcelas = 1;

    if (data.tipo === "receita") {
      formaPagamento = 1; // receita não tem forma de pagamento relevante
    } else if (data.formaPagamento === "credito") {
      formaPagamento = 3;
      cartaoId = data.cartaoId ? parseInt(data.cartaoId, 10) : undefined;
      parcelas = data.numeroParcelas ? parseInt(data.numeroParcelas, 10) : 1;
      if (parcelas < 1 || isNaN(parcelas)) parcelas = 1;
    } else if (data.formaPagamento === "pix") {
      formaPagamento = 1;
    } else if (data.formaPagamento === "debito") {
      formaPagamento = 2;
    }

    criarLancamento.mutate(
      {
        descricao: data.descricao,
        valor,
        tipo: data.tipo === "despesa" ? 1 : 2,
        formaPagamento,
        categoria: data.categoria || "Outros",
        numeroParcelas: parcelas,
        cartaoCreditoId: cartaoId,
        data: data.data || undefined,
      },
      {
      onSuccess: () => {
        form.reset();
        setShowForm(false);
      },
    });
  };

  const onEdit = async (data: EditarLancamentoData) => {
    if (!editingItem) return;
    atualizarLancamento.mutate(
      {
        id: editingItem.id,
        data: {
          descricao: data.descricao,
          valor: parseFloat(data.valor.replace(",", ".")),
          categoria: data.categoria || undefined,
          data: data.data || undefined,
        },
      },
      { onSuccess: () => setEditingItem(null) }
    );
  };

  const onDelete = () => {
    if (deletingId === null) return;
    removerLancamento.mutate(deletingId, { onSuccess: () => setDeletingId(null) });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.resumo() });
    queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
  };

  const openEdit = (lancamento: Lancamento) => {
    editForm.reset({
      descricao: lancamento.descricao,
      valor: lancamento.valor.toFixed(2).replace(".", ","),
      categoria: lancamento.categoria,
      data: lancamento.data?.split("T")[0] ?? "",
    });
    setEditingItem(lancamento);
  };

  return (
    <PageShell>
      <PageHeader title="Lançamentos" description="Registre e acompanhe suas receitas e despesas">
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </PageHeader>

      {/* Stats */}
      {loadingResumo ? (
        <CardSkeleton count={3} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={handleRefresh} />
      ) : resumo ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Receitas" value={formatCurrency(resumo.totalReceitas)} icon={<TrendingUp className="h-5 w-5" />} trend="up" delay={0} />
          <StatCard title="Despesas" value={formatCurrency(resumo.totalGastos)} icon={<TrendingDown className="h-5 w-5" />} trend="down" delay={1} />
          <StatCard title="Saldo" value={formatCurrency(resumo.saldo)} icon={<Wallet className="h-5 w-5" />} trend={resumo.saldo >= 0 ? "up" : "down"} delay={2} className="sm:col-span-2 lg:col-span-1" />
        </div>
      ) : null}

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-premium p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
              className="pl-9 h-9"
            />
            {busca && (
              <button onClick={() => { setBusca(""); setPagina(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" aria-label="Limpar busca">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select value={filtroTipo} onValueChange={(v) => { setFiltroTipo(v); setPagina(1); }}>
              <SelectTrigger className="w-32.5 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="gasto">Despesas</SelectItem>
                <SelectItem value="receita">Receitas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroCategoria} onValueChange={(v) => { setFiltroCategoria(v); setPagina(1); }}>
              <SelectTrigger className="w-37.5 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {categorias.map((c) => (<SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* Transaction List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-premium overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 text-primary">
              <Receipt className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-sm font-bold tracking-tight">Histórico de Lançamentos</h3>
          </div>
        </div>

        {loadingLancamentos ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : lancamentosData && lancamentosData.items.length > 0 ? (
          <>
            <div className="divide-y divide-border/50">
              <AnimatePresence>
                {lancamentosData.items.map((l, i) => (
                    <motion.div key={l.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.02 * i }} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => setViewingItem(l)}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${l.tipo === "receita" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"}`}>
                      {l.tipo === "receita" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{l.descricao}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground/60 font-medium">{formatDate(l.data)}</span>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">{l.categoria}</Badge>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{formatFormaPagamento(l.formaPagamento)}</Badge>
                        {l.parcelado && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{l.numeroParcelas}x</Badge>}
                      </div>
                    </div>
                    <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${l.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {l.tipo === "receita" ? "+" : "-"} {formatCurrency(l.valor)}
                    </span>
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setViewingItem(l)} aria-label="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(l)} aria-label="Editar lançamento"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => setDeletingId(l.id)} aria-label="Excluir lançamento"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {lancamentosData.totalPaginas > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/50">
                <span className="text-[11px] text-muted-foreground/60 font-medium">{lancamentosData.total} lançamentos · Página {lancamentosData.pagina} de {lancamentosData.totalPaginas}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-9 w-9" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-9 w-9" disabled={pagina >= lancamentosData.totalPaginas} onClick={() => setPagina((p) => p + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8">
            <EmptyState icon={<Receipt className="h-6 w-6" />} title="Nenhum lançamento" description="Registre seu primeiro lançamento para ver o histórico aqui" action={<Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="h-4 w-4" />Registrar lançamento</Button>} />
          </div>
        )}
      </motion.div>

      {/* New Transaction Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lançamento</DialogTitle>
            <DialogDescription>Registre uma receita ou despesa manualmente</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={tipoSelecionado === "receita" ? "default" : "outline"} className="h-11 gap-2" onClick={() => { form.setValue("tipo", "receita"); form.setValue("cartaoId", ""); form.setValue("formaPagamento", ""); form.setValue("numeroParcelas", ""); }}><ArrowUpCircle className="h-4 w-4" />Receita</Button>
              <Button type="button" variant={tipoSelecionado === "despesa" ? "default" : "outline"} className="h-11 gap-2" onClick={() => form.setValue("tipo", "despesa")}><ArrowDownCircle className="h-4 w-4" />Despesa</Button>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input placeholder="Ex: Supermercado, Salário..." className="h-11" {...form.register("descricao")} />
              {form.formState.errors.descricao && <p className="text-xs text-red-500">{form.formState.errors.descricao.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input placeholder="0,00" className="h-11 tabular-nums" {...form.register("valor")} />
              {form.formState.errors.valor && <p className="text-xs text-red-500">{form.formState.errors.valor.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoriaSelecionada} onValueChange={(v) => form.setValue("categoria", v)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>{categorias.map((c) => (<SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {tipoSelecionado === "despesa" && (
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={formaPagamentoSelecionada ?? ""} onValueChange={(v) => { form.setValue("formaPagamento", v); if (v !== "credito") { form.setValue("cartaoId", ""); form.setValue("numeroParcelas", ""); } }}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                    {cartoes.length > 0 && <SelectItem value="credito">Cartão de Crédito</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tipoSelecionado === "despesa" && formaPagamentoSelecionada === "credito" && cartoes.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Cartão</Label>
                  <Select value={cartaoSelecionado} onValueChange={(v) => form.setValue("cartaoId", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                    <SelectContent>{cartoes.map((c) => (<SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Select value={form.watch("numeroParcelas") ?? ""} onValueChange={(v) => form.setValue("numeroParcelas", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="À vista (1x)" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (<SelectItem key={n} value={n.toString()}>{n}x{n === 1 ? " (à vista)" : ""}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Data (opcional)</Label>
              <Input type="date" className="h-11" {...form.register("data")} />
            </div>
            <Button type="submit" className="w-full h-11 gap-2 font-semibold shadow-premium" disabled={criarLancamento.isPending}>
              {criarLancamento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Receipt className="h-4 w-4" />Registrar</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editingItem !== null} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Lançamento</DialogTitle>
            <DialogDescription>Altere os dados do lançamento</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-5">
            {editingItem && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${editingItem.tipo === "receita" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"}`}>
                  {editingItem.tipo === "receita" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium capitalize">{editingItem.tipo}</span>
                  <span className="text-xs text-muted-foreground ml-2">· {formatFormaPagamento(editingItem.formaPagamento)}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input className="h-11" {...editForm.register("descricao")} />
              {editForm.formState.errors.descricao && <p className="text-xs text-red-500">{editForm.formState.errors.descricao.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input className="h-11 tabular-nums" {...editForm.register("valor")} />
              {editForm.formState.errors.valor && <p className="text-xs text-red-500">{editForm.formState.errors.valor.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={editForm.watch("categoria") ?? ""} onValueChange={(v) => editForm.setValue("categoria", v)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categorias.map((c) => (<SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" className="h-11" {...editForm.register("data")} />
            </div>
            <Button type="submit" className="w-full h-11 gap-2 font-semibold shadow-premium" disabled={atualizarLancamento.isPending}>
              {atualizarLancamento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={viewingItem !== null} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Lançamento</DialogTitle>
            <DialogDescription>Informações completas do lançamento</DialogDescription>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${viewingItem.tipo === "receita" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"}`}>
                  {viewingItem.tipo === "receita" ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{viewingItem.descricao}</p>
                  <Badge variant={viewingItem.tipo === "receita" ? "default" : "destructive"} className="text-[11px] mt-1 capitalize">{viewingItem.tipo}</Badge>
                </div>
                <span className={`text-lg font-bold tabular-nums ${viewingItem.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {viewingItem.tipo === "receita" ? "+" : "-"} {formatCurrency(viewingItem.valor)}
                </span>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                  <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium">Categoria</p>
                    <p className="text-sm font-semibold">{viewingItem.categoria}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                  {viewingItem.formaPagamento?.toLowerCase() === "pix" ? <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" /> :
                   viewingItem.formaPagamento?.toLowerCase() === "credito" ? <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" /> :
                   <Banknote className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium">Forma de Pagamento</p>
                    <p className="text-sm font-semibold">{formatFormaPagamento(viewingItem.formaPagamento)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium">Data</p>
                    <p className="text-sm font-semibold">{formatDate(viewingItem.data)}</p>
                  </div>
                </div>

                {viewingItem.parcelado && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium">Parcelas</p>
                      <p className="text-sm font-semibold">{viewingItem.numeroParcelas}x de {formatCurrency(viewingItem.valor / viewingItem.numeroParcelas)}</p>
                    </div>
                  </div>
                )}

                {viewingItem.criadoEm && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium">Criado em</p>
                      <p className="text-sm font-semibold">{formatDate(viewingItem.criadoEm)}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { setViewingItem(null); openEdit(viewingItem); }}>
                  <Pencil className="h-4 w-4" />Editar
                </Button>
                <Button variant="destructive" className="flex-1 gap-2" onClick={() => { setViewingItem(null); setDeletingId(viewingItem.id); }}>
                  <Trash2 className="h-4 w-4" />Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deletingId !== null} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O lançamento será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removerLancamento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
