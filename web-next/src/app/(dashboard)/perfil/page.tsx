"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api, type CodigoTelegramResponse } from "@/lib/api";
import {
  useCategorias,
  useCriarCategoria,
  useAtualizarCategoria,
  useRemoverCategoria,
  useAtualizarPerfil,
} from "@/hooks/use-queries";
import { formatDate, getInitials } from "@/lib/format";
import {
  atualizarPerfilSchema,
  alterarSenhaSchema,
  categoriaSchema,
  type AtualizarPerfilData,
  type AlterarSenhaData,
  type CategoriaData,
} from "@/lib/schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Calendar,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Loader2,
  Shield,
  Smartphone,
  Pencil,
  Trash2,
  Plus,
  Lock,
  Tag,
  Save,
} from "lucide-react";
import { PageShell } from "@/components/shared/page-components";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
import { toast } from "sonner";

export default function PerfilPage() {
  const telegramBotUrl = "https://t.me/facilita_finance_bot";
  const { usuario, atualizarPerfil: atualizarContexto } = useAuth();
  const [codigoTelegram, setCodigoTelegram] = useState<CodigoTelegramResponse | null>(null);
  const [gerando, setGerando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showNovaCategoria, setShowNovaCategoria] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<{ id: number; nome: string } | null>(null);
  const [removendoCategoria, setRemovendoCategoria] = useState<number | null>(null);

  const atualizarPerfilMutation = useAtualizarPerfil();
  const { data: categorias = [] } = useCategorias();
  const criarCategoria = useCriarCategoria();
  const atualizarCategoria = useAtualizarCategoria();
  const removerCategoria = useRemoverCategoria();

  const nomeForm = useForm<AtualizarPerfilData>({
    resolver: zodResolver(atualizarPerfilSchema),
    defaultValues: { nome: usuario?.nome ?? "" },
  });

  const senhaForm = useForm<AlterarSenhaData>({
    resolver: zodResolver(alterarSenhaSchema),
    defaultValues: { senhaAtual: "", novaSenha: "", confirmarSenha: "" },
  });

  const categoriaForm = useForm<CategoriaData>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nome: "" },
  });

  const editCategoriaForm = useForm<CategoriaData>({
    resolver: zodResolver(categoriaSchema),
  });

  if (!usuario) return null;

  const gerarCodigo = async () => {
    setGerando(true);
    try {
      const res = await api.auth.gerarCodigoTelegram();
      setCodigoTelegram(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar código");
    } finally {
      setGerando(false);
    }
  };

  const verificarVinculo = async () => {
    setVerificando(true);
    try {
      await atualizarContexto();
      toast.success("Perfil atualizado!");
    } catch {
      // ignore
    } finally {
      setVerificando(false);
    }
  };

  const copiarCodigo = () => {
    if (!codigoTelegram) return;
    navigator.clipboard.writeText(`/vincular ${codigoTelegram.codigo}`);
    setCopiado(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopiado(false), 2000);
  };

  const onSalvarNome = (data: AtualizarPerfilData) => {
    atualizarPerfilMutation.mutate({ nome: data.nome }, {
      onSuccess: async () => {
        setEditandoNome(false);
        await atualizarContexto();
      },
    });
  };

  const onAlterarSenha = (data: AlterarSenhaData) => {
    atualizarPerfilMutation.mutate(
      { senhaAtual: data.senhaAtual, novaSenha: data.novaSenha },
      {
        onSuccess: () => {
          setShowSenha(false);
          senhaForm.reset();
          toast.success("Senha alterada com sucesso!");
        },
      }
    );
  };

  const onCriarCategoria = (data: CategoriaData) => {
    criarCategoria.mutate({ nome: data.nome }, {
      onSuccess: () => {
        setShowNovaCategoria(false);
        categoriaForm.reset();
      },
    });
  };

  const onEditarCategoria = (data: CategoriaData) => {
    if (!editandoCategoria) return;
    atualizarCategoria.mutate(
      { id: editandoCategoria.id, data: { nome: data.nome } },
      { onSuccess: () => setEditandoCategoria(null) }
    );
  };

  const onRemoverCategoria = () => {
    if (removendoCategoria === null) return;
    removerCategoria.mutate(removendoCategoria, {
      onSuccess: () => setRemovendoCategoria(null),
    });
  };

  return (
    <PageShell>
      {/* ── Page Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas informações, segurança e categorias</p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Info Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-premium overflow-hidden">
          <div className="gradient-hero h-28 relative">
            <div className="absolute -bottom-10 left-6">
              <Avatar className="h-20 w-20 border-4 border-card shadow-xl">
                <AvatarFallback className="text-xl font-bold bg-white text-emerald-700 dark:bg-neutral-800 dark:text-emerald-400">
                  {getInitials(usuario.nome)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          <div className="p-6 pt-14 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{usuario.nome}</h3>
                <p className="text-sm text-muted-foreground">{usuario.email}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => { nomeForm.reset({ nome: usuario.nome }); setEditandoNome(true); }}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><User className="h-4 w-4" /></div>
                <div><p className="text-[11px] text-muted-foreground/60 font-medium">Nome</p><p className="text-[13px] font-semibold">{usuario.nome}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Mail className="h-4 w-4" /></div>
                <div><p className="text-[11px] text-muted-foreground/60 font-medium">E-mail</p><p className="text-[13px] font-semibold">{usuario.email}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Calendar className="h-4 w-4" /></div>
                <div><p className="text-[11px] text-muted-foreground/60 font-medium">Membro desde</p><p className="text-[13px] font-semibold">{formatDate(usuario.criadoEm)}</p></div>
              </div>
            </div>

            <Separator />

            <Button variant="outline" className="w-full gap-2 rounded-xl" onClick={() => setShowSenha(true)}>
              <Lock className="h-4 w-4" />
              Alterar senha
            </Button>
          </div>
        </motion.div>

        {/* Telegram Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-premium overflow-hidden">
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"><MessageCircle className="h-5 w-5" /></div>
              <div>
                <h3 className="font-bold tracking-tight">Telegram</h3>
                <p className="text-[11px] text-muted-foreground/60 font-medium">Integração com bot inteligente</p>
              </div>
              {usuario.telegramVinculado ? (
                <Badge className="ml-auto bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-0"><Check className="h-3 w-3 mr-1" />Vinculado</Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto">Pendente</Badge>
              )}
            </div>
            <Separator />
            <Button asChild variant="outline" className="w-full gap-2 h-11 rounded-xl">
              <a href={telegramBotUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Abrir bot no Telegram
              </a>
            </Button>
            <Separator />
            {usuario.telegramVinculado ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-5 space-y-3">
                <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /><h4 className="font-semibold text-emerald-800 dark:text-emerald-300">Telegram conectado!</h4></div>
                <p className="text-sm text-emerald-700 dark:text-emerald-400/80">Registre lançamentos, consulte saldos e faturas pelo Telegram usando linguagem natural. Cadastro e edição de cartão ficam na aba Cartões do sistema web.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">Vincule seu Telegram para registrar gastos por mensagem de voz ou texto usando inteligência artificial.</p>
                {!codigoTelegram ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {[{ step: 1, text: "Clique no botão abaixo para gerar um código" }, { step: 2, text: "Abra o bot no Telegram e envie o comando" }, { step: 3, text: "Volte aqui e clique em verificar" }].map(({ step, text }) => (
                        <div key={step} className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{step}</div>
                          <p className="text-sm">{text}</p>
                        </div>
                      ))}
                    </div>
                    <Button onClick={gerarCodigo} disabled={gerando} className="w-full gap-2 h-11 font-semibold shadow-premium">
                      {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Smartphone className="h-4 w-4" />Gerar código de vinculação</>}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-muted p-4 space-y-3">
                      <p className="text-[11px] text-muted-foreground/60 font-medium">Envie este comando no bot:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-lg bg-background px-3 py-2 text-sm font-mono font-semibold">/vincular {codigoTelegram.codigo}</code>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copiarCodigo} aria-label="Copiar código">
                          {copiado ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 font-medium">Expira em: {formatDate(codigoTelegram.expiraEm)}</p>
                    </div>
                    <Button onClick={verificarVinculo} disabled={verificando} className="w-full gap-2 h-11 font-semibold shadow-premium">
                      {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4" />Já enviei, verificar</>}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Categories Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-premium overflow-hidden lg:col-span-2">
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"><Tag className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-bold tracking-tight">Categorias</h3>
                  <p className="text-[11px] text-muted-foreground/60 font-medium">Gerencie suas categorias de lançamento</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => { categoriaForm.reset(); setShowNovaCategoria(true); }}>
                <Plus className="h-3.5 w-3.5" />
                Nova
              </Button>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {categorias.map((cat) => (
                <div key={cat.id} className="group flex items-center gap-1.5 rounded-xl bg-muted/40 border border-border/30 px-3.5 py-2.5 text-sm">
                  <Tag className="h-3 w-3 text-muted-foreground/60" />
                  <span className="font-semibold text-[13px]">{cat.nome}</span>
                  {cat.padrao ? (
                    <Badge variant="secondary" className="ml-1 text-[10px] font-semibold h-5 px-1.5">padrão</Badge>
                  ) : (
                    <TooltipProvider>
                      <div className="flex items-center gap-0.5 ml-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-background transition-colors" onClick={() => { editCategoriaForm.reset({ nome: cat.nome }); setEditandoCategoria({ id: cat.id, nome: cat.nome }); }}>
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" onClick={() => setRemovendoCategoria(cat.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Remover</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={editandoNome} onOpenChange={setEditandoNome}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Nome</DialogTitle>
            <DialogDescription>Altere seu nome de exibição</DialogDescription>
          </DialogHeader>
          <form onSubmit={nomeForm.handleSubmit(onSalvarNome)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input className="h-11 rounded-xl" {...nomeForm.register("nome")} />
              {nomeForm.formState.errors.nome && <p className="text-xs text-red-500">{nomeForm.formState.errors.nome.message}</p>}
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl gap-2 font-bold text-sm shadow-premium" disabled={atualizarPerfilMutation.isPending}>
              {atualizarPerfilMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" />Salvar</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showSenha} onOpenChange={setShowSenha}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Alterar Senha</DialogTitle>
            <DialogDescription>Informe sua senha atual e a nova senha</DialogDescription>
          </DialogHeader>
          <form onSubmit={senhaForm.handleSubmit(onAlterarSenha)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Senha atual</Label>
              <Input type="password" className="h-11 rounded-xl" {...senhaForm.register("senhaAtual")} />
              {senhaForm.formState.errors.senhaAtual && <p className="text-xs text-red-500">{senhaForm.formState.errors.senhaAtual.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nova senha</Label>
              <Input type="password" className="h-11 rounded-xl" {...senhaForm.register("novaSenha")} />
              {senhaForm.formState.errors.novaSenha && <p className="text-xs text-red-500">{senhaForm.formState.errors.novaSenha.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar nova senha</Label>
              <Input type="password" className="h-11 rounded-xl" {...senhaForm.register("confirmarSenha")} />
              {senhaForm.formState.errors.confirmarSenha && <p className="text-xs text-red-500">{senhaForm.formState.errors.confirmarSenha.message}</p>}
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl gap-2 font-bold text-sm shadow-premium" disabled={atualizarPerfilMutation.isPending}>
              {atualizarPerfilMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="h-4 w-4" />Alterar senha</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog open={showNovaCategoria} onOpenChange={setShowNovaCategoria}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Nova Categoria</DialogTitle>
            <DialogDescription>Crie uma categoria personalizada</DialogDescription>
          </DialogHeader>
          <form onSubmit={categoriaForm.handleSubmit(onCriarCategoria)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da categoria</Label>
              <Input className="h-11 rounded-xl" placeholder="Ex: Pets, Investimentos..." {...categoriaForm.register("nome")} />
              {categoriaForm.formState.errors.nome && <p className="text-xs text-red-500">{categoriaForm.formState.errors.nome.message}</p>}
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl gap-2 font-bold text-sm shadow-premium" disabled={criarCategoria.isPending}>
              {criarCategoria.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Tag className="h-4 w-4" />Criar categoria</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={editandoCategoria !== null} onOpenChange={() => setEditandoCategoria(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Categoria</DialogTitle>
            <DialogDescription>Altere o nome da categoria</DialogDescription>
          </DialogHeader>
          <form onSubmit={editCategoriaForm.handleSubmit(onEditarCategoria)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input className="h-11 rounded-xl" {...editCategoriaForm.register("nome")} />
              {editCategoriaForm.formState.errors.nome && <p className="text-xs text-red-500">{editCategoriaForm.formState.errors.nome.message}</p>}
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-bold text-sm shadow-premium" disabled={atualizarCategoria.isPending}>
              {atualizarCategoria.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={removendoCategoria !== null} onOpenChange={() => setRemovendoCategoria(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Os lançamentos vinculados a esta categoria não serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onRemoverCategoria} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2">
              {removerCategoria.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" />Remover</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
