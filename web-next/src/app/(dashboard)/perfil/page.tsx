"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  rendaMensalSchema,
  type AtualizarPerfilData,
  type AlterarSenhaData,
  type CategoriaData,
  type RendaMensalData,
} from "@/lib/schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  User,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Shield,
  Smartphone,
  Pencil,
  Trash2,
  Plus,
  Lock,
  Tag,
  Save,
  AlertTriangle,
  Send,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

/* ────────────────────────────────────────────── */

export default function PerfilPage() {
  const telegramBotUrl = "https://t.me/facilita_finance_bot";
  const router = useRouter();
  const { usuario, atualizarPerfil: atualizarContexto, logout } = useAuth();

  /* ── state ── */
  const [codigoTelegram, setCodigoTelegram] = useState<CodigoTelegramResponse | null>(null);
  const [gerando, setGerando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [editandoRenda, setEditandoRenda] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showNovaCategoria, setShowNovaCategoria] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<{ id: number; nome: string } | null>(null);
  const [removendoCategoria, setRemovendoCategoria] = useState<number | null>(null);
  const [showExcluirConta, setShowExcluirConta] = useState(false);
  const [excluirTexto, setExcluirTexto] = useState("");
  const [excluindoConta, setExcluindoConta] = useState(false);

  /* ── mutations / queries ── */
  const atualizarPerfilMutation = useAtualizarPerfil();
  const { data: categorias = [] } = useCategorias();
  const criarCategoria = useCriarCategoria();
  const atualizarCategoria = useAtualizarCategoria();
  const removerCategoria = useRemoverCategoria();

  /* ── forms ── */
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

  const rendaForm = useForm<RendaMensalData>({
    resolver: zodResolver(rendaMensalSchema),
    defaultValues: {
      rendaMensal: usuario?.rendaMensal
        ? usuario.rendaMensal.toFixed(2).replace(".", ",")
        : "0,00",
    },
  });

  const editCategoriaForm = useForm<CategoriaData>({
    resolver: zodResolver(categoriaSchema),
  });

  if (!usuario) return null;

  /* ── handlers ── */
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
    navigator.clipboard.writeText(codigoTelegram.codigo);
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

  const onSalvarRenda = (data: RendaMensalData) => {
    const raw = data.rendaMensal.replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(raw);
    atualizarPerfilMutation.mutate(
      { rendaMensal: isNaN(valor) || valor === 0 ? 0 : valor },
      {
        onSuccess: async () => {
          setEditandoRenda(false);
          await atualizarContexto();
          toast.success("Renda mensal atualizada!");
        },
      },
    );
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
      },
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
      { onSuccess: () => setEditandoCategoria(null) },
    );
  };

  const onRemoverCategoria = () => {
    if (removendoCategoria === null) return;
    removerCategoria.mutate(removendoCategoria, {
      onSuccess: () => setRemovendoCategoria(null),
    });
  };

  const onExcluirConta = async () => {
    if (excluirTexto !== "EXCLUIR MINHA CONTA") return;
    setExcluindoConta(true);
    try {
      await api.auth.excluirConta();
      toast.success("Conta excluída permanentemente.");
      logout();
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir conta.");
      setExcluindoConta(false);
    }
  };

  /* ── render ── */
  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">Ajustes</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Gerencie suas informações pessoais, integrações e categorias.
        </p>
      </div>

      {/* ═══════════════════════════════════════════
          SEÇÃO 1 — MINHA CONTA
      ═══════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-2">
          <User className="h-6 w-6 text-emerald-600" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Minha Conta</h2>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-4 sm:p-6 lg:p-8"
        >
          {/* Top: avatar + info */}
          <div className="flex items-start justify-between flex-wrap gap-4 sm:gap-6">
            <div className="flex gap-4 sm:gap-6 items-center">
              <div className="relative">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 border-4 border-white dark:border-slate-700 shadow-lg">
                  <AvatarFallback className="text-2xl font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {getInitials(usuario.nome)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{usuario.nome}</h3>
                <p className="text-slate-500 dark:text-slate-400">{usuario.email}</p>
              </div>
            </div>
            <div className="text-right text-sm text-slate-400 hidden sm:block">
              <p>Membro desde</p>
              <p className="font-medium text-slate-600 dark:text-slate-300">{formatDate(usuario.criadoEm)}</p>
            </div>
          </div>

          {/* Grid: Info + Security */}
          <div className="border-t border-slate-100 dark:border-slate-700/50 pt-8 mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Personal info */}
            <div className="flex flex-col gap-4">
              <h4 className="font-semibold text-slate-700 dark:text-slate-200">Informações Pessoais</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Nome Completo</label>
                  <div className="flex gap-2">
                    <input
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-600 dark:text-slate-300"
                      disabled
                      type="text"
                      value={usuario.nome}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                  <div className="flex gap-2">
                    <input
                      className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                      disabled
                      type="email"
                      value={usuario.email}
                    />
                    <button
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-emerald-600 hover:border-emerald-600/30 font-medium text-sm transition-all whitespace-nowrap shadow-sm"
                      onClick={() => {
                        nomeForm.reset({ nome: usuario.nome });
                        setEditandoNome(true);
                      }}
                    >
                      Editar
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Renda Mensal</label>
                  <div className="flex gap-2">
                    <div className="w-full flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2">
                      <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300">
                        {usuario.rendaMensal
                          ? `R$ ${usuario.rendaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "Não informada"}
                      </span>
                    </div>
                    <button
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-emerald-600 hover:border-emerald-600/30 font-medium text-sm transition-all whitespace-nowrap shadow-sm"
                      onClick={() => {
                        rendaForm.reset({
                          rendaMensal: usuario.rendaMensal
                            ? usuario.rendaMensal.toFixed(2).replace(".", ",")
                            : "0,00",
                        });
                        setEditandoRenda(true);
                      }}
                    >
                      Editar
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Usada como base nas projeções e simulações financeiras
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Security */}
            <div className="flex flex-col gap-4">
              <h4 className="font-semibold text-slate-700 dark:text-slate-200">Segurança</h4>
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200">Senha</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Altere sua senha de acesso</p>
                  </div>
                  <button
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                    onClick={() => setShowSenha(true)}
                  >
                    Alterar Senha
                  </button>
                </div>
                <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">Zona de Perigo</p>
                    <p className="text-xs text-red-500 dark:text-red-400/70">Ação irreversível</p>
                  </div>
                  <button
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 font-medium text-sm transition-colors shadow-sm"
                    onClick={() => setShowExcluirConta(true)}
                  >
                    Excluir Conta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* ═══════════════════════════════════════════
          SEÇÃO 2 — INTEGRAÇÃO TELEGRAM
      ═══════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-2 mt-4">
          <Send className="h-6 w-6 text-emerald-600" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Integração Telegram</h2>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-2xl p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6 lg:gap-8"
        >
          {/* Left: info & instructions */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-500">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Bot do Telegram</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Receba notificações e adicione gastos rápidos pelo Telegram.
                </p>
              </div>
              {usuario.telegramVinculado ? (
                <Badge className="ml-auto bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-0">
                  <Check className="h-3 w-3 mr-1" />Vinculado
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-auto">Pendente</Badge>
              )}
            </div>

            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className="mb-1">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Como funciona:</span>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Clique no botão abaixo para abrir o Telegram.</li>
                <li>Envie o código exibido ao lado para o nosso bot.</li>
                <li>Pronto! Sua conta estará vinculada automaticamente.</li>
              </ul>
            </div>

            <div className="flex gap-4 pt-2">
              <a
                href={telegramBotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors flex items-center gap-2 shadow-sm"
              >
                Link para o Bot
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Right: code panel */}
          <div className="w-full md:w-100 lg:w-120 bg-white/60 dark:bg-slate-800/40 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-white/50 dark:border-slate-700/30 flex flex-col gap-6 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute -top-16 -right-16 size-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

            {usuario.telegramVinculado ? (
              /* Connected state */
              <div className="relative z-10 flex flex-col items-center gap-4 text-center py-6">
                <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-emerald-800 dark:text-emerald-300">Telegram conectado!</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                    Registre lançamentos, consulte saldos e faturas pelo Telegram usando linguagem natural.
                  </p>
                </div>
              </div>
            ) : !codigoTelegram ? (
              /* No code yet — prompt to generate */
              <div className="relative z-10 flex flex-col items-center gap-6 text-center py-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold tracking-wide uppercase border border-emerald-100 dark:border-emerald-800">
                    Segurança
                  </span>
                </div>
                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Código de vinculação</p>
                <p className="text-sm text-slate-400">Gere um código para vincular seu Telegram.</p>
                <Button
                  onClick={gerarCodigo}
                  loading={gerando}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-600 text-white rounded-xl text-lg font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <Smartphone className="h-5 w-5" />
                  Gerar código
                </Button>
              </div>
            ) : (
              /* Code generated — OTP display */
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex flex-col gap-2 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold tracking-wide uppercase border border-emerald-100 dark:border-emerald-800">
                      Segurança
                    </span>
                  </div>
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Seu código de vinculação</p>
                  <p className="text-sm text-slate-400">Envie este código no bot do Telegram.</p>
                </div>

                {/* OTP boxes */}
                <div className="my-4">
                  <div className="flex justify-center items-center gap-3 sm:gap-4">
                    {codigoTelegram.codigo.split("").map((char, i, arr) => (
                      <span key={i}>
                        <div className="w-12 h-14 sm:w-14 sm:h-16 text-center text-3xl font-mono font-bold bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-800 dark:text-white flex items-center justify-center select-all">
                          {char}
                        </div>
                        {i === Math.floor(arr.length / 2) - 1 && (
                          <div className="w-4 h-1 bg-slate-200 dark:bg-slate-600 rounded-full mx-1 inline-block" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={copiarCodigo}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-600 text-white rounded-xl text-lg font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                  >
                    {copiado ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      <Copy className="h-6 w-6 group-hover:rotate-12 transition-transform" />
                    )}
                    {copiado ? "Copiado!" : "Copiar Código"}
                  </button>

                  <Button
                    onClick={verificarVinculo}
                    loading={verificando}
                    variant="outline"
                    className="w-full py-3 rounded-xl font-semibold gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Já enviei, verificar
                  </Button>

                  <div className="flex items-center justify-center gap-3 py-2">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      Expira em: <span className="text-slate-800 dark:text-white font-bold">{formatDate(codigoTelegram.expiraEm)}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.section>
      </div>

      {/* ═══════════════════════════════════════════
          SEÇÃO 3 — CATEGORIAS
      ═══════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-2 mt-4">
          <Tag className="h-6 w-6 text-emerald-600" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Categorias</h2>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Categorias de Despesas</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Personalize como você organiza suas finanças.</p>
            </div>
            <button
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-600 hover:text-emerald-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-medium shadow-sm transition-all active:scale-95 flex items-center gap-2 text-sm"
              onClick={() => {
                categoriaForm.reset();
                setShowNovaCategoria(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova Categoria
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700/50">
                  <th className="p-5 w-1/3">Nome da Categoria</th>
                  <th className="p-5">Tipo</th>
                  <th className="p-5">Criada em</th>
                  <th className="p-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30 text-sm">
                {categorias.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-emerald-600/10 flex items-center justify-center text-emerald-600 shrink-0">
                          <Tag className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-200">{cat.nome}</span>
                      </div>
                    </td>
                    <td className="p-5">
                      {cat.padrao ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400">
                          Padrão do Sistema
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                          Personalizada
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-slate-500 dark:text-slate-400">
                      {cat.padrao ? "--" : "--"}
                    </td>
                    <td className="p-5 text-right">
                      {cat.padrao ? (
                        <span className="text-slate-300 dark:text-slate-600 text-xs italic">Não editável</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-600/10 rounded-lg transition-colors"
                            title="Editar"
                            onClick={() => {
                              editCategoriaForm.reset({ nome: cat.nome });
                              setEditandoCategoria({ id: cat.id, nome: cat.nome });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Excluir"
                            onClick={() => setRemovendoCategoria(cat.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {categorias.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 dark:text-slate-500">
                      Nenhuma categoria encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>

      {/* ═══════════════════════════════════════════
          DIALOGS
      ═══════════════════════════════════════════ */}

      {/* Edit Name Dialog */}
      <Dialog open={editandoNome} onOpenChange={setEditandoNome}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Editar Nome</DialogTitle>
            <DialogDescription>Altere seu nome de exibição</DialogDescription>
          </DialogHeader>
          <form onSubmit={nomeForm.handleSubmit(onSalvarNome)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input className="h-11 rounded-xl" {...nomeForm.register("nome")} />
              {nomeForm.formState.errors.nome && (
                <p className="text-xs text-red-500">{nomeForm.formState.errors.nome.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              loading={atualizarPerfilMutation.isPending}
            >
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Renda Mensal Dialog */}
      <Dialog open={editandoRenda} onOpenChange={setEditandoRenda}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Renda Mensal</DialogTitle>
            <DialogDescription>
              Informe sua renda mensal base. Ela será usada como piso nas projeções financeiras.
              Deixe R$ 0,00 para limpar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={rendaForm.handleSubmit(onSalvarRenda)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
              <CurrencyInput
                className="h-11 rounded-xl"
                value={rendaForm.watch("rendaMensal")}
                onValueChange={(v) => rendaForm.setValue("rendaMensal", v, { shouldValidate: true })}
              />
              {rendaForm.formState.errors.rendaMensal && (
                <p className="text-xs text-red-500">{rendaForm.formState.errors.rendaMensal.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              loading={atualizarPerfilMutation.isPending}
            >
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showSenha} onOpenChange={setShowSenha}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Alterar Senha</DialogTitle>
            <DialogDescription>Informe sua senha atual e a nova senha</DialogDescription>
          </DialogHeader>
          <form onSubmit={senhaForm.handleSubmit(onAlterarSenha)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Senha atual</Label>
              <Input type="password" className="h-11 rounded-xl" {...senhaForm.register("senhaAtual")} />
              {senhaForm.formState.errors.senhaAtual && (
                <p className="text-xs text-red-500">{senhaForm.formState.errors.senhaAtual.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nova senha</Label>
              <Input type="password" className="h-11 rounded-xl" {...senhaForm.register("novaSenha")} />
              {senhaForm.formState.errors.novaSenha && (
                <p className="text-xs text-red-500">{senhaForm.formState.errors.novaSenha.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar nova senha</Label>
              <Input type="password" className="h-11 rounded-xl" {...senhaForm.register("confirmarSenha")} />
              {senhaForm.formState.errors.confirmarSenha && (
                <p className="text-xs text-red-500">{senhaForm.formState.errors.confirmarSenha.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              loading={atualizarPerfilMutation.isPending}
            >
              <Lock className="h-4 w-4" />
              Alterar senha
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog open={showNovaCategoria} onOpenChange={setShowNovaCategoria}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Nova Categoria</DialogTitle>
            <DialogDescription>Crie uma categoria personalizada</DialogDescription>
          </DialogHeader>
          <form onSubmit={categoriaForm.handleSubmit(onCriarCategoria)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da categoria</Label>
              <Input className="h-11 rounded-xl" placeholder="Ex: Pets, Investimentos..." {...categoriaForm.register("nome")} />
              {categoriaForm.formState.errors.nome && (
                <p className="text-xs text-red-500">{categoriaForm.formState.errors.nome.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              loading={criarCategoria.isPending}
            >
              <Tag className="h-4 w-4" />
              Criar categoria
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={editandoCategoria !== null} onOpenChange={() => setEditandoCategoria(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Editar Categoria</DialogTitle>
            <DialogDescription>Altere o nome da categoria</DialogDescription>
          </DialogHeader>
          <form onSubmit={editCategoriaForm.handleSubmit(onEditarCategoria)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input className="h-11 rounded-xl" {...editCategoriaForm.register("nome")} />
              {editCategoriaForm.formState.errors.nome && (
                <p className="text-xs text-red-500">{editCategoriaForm.formState.errors.nome.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              loading={atualizarCategoria.isPending}
            >
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={removendoCategoria !== null} onOpenChange={() => setRemovendoCategoria(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os lançamentos vinculados a esta categoria não serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemoverCategoria}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2"
              loading={removerCategoria.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Dialog */}
      <Dialog
        open={showExcluirConta}
        onOpenChange={(open) => {
          setShowExcluirConta(open);
          if (!open) setExcluirTexto("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir conta permanentemente
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todos os seus dados serão deletados definitivamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive/80 space-y-1">
              <p className="font-semibold">Serão excluídos permanentemente:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Todos os lançamentos e transações</li>
                <li>Cartões, metas e limites</li>
                <li>Categorias personalizadas</li>
                <li>Configurações e integração com Telegram</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Digite <span className="text-foreground font-bold">EXCLUIR MINHA CONTA</span> para confirmar:
              </Label>
              <Input
                value={excluirTexto}
                onChange={(e) => setExcluirTexto(e.target.value)}
                placeholder="EXCLUIR MINHA CONTA"
                className="h-11 rounded-xl font-mono"
                disabled={excluindoConta}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setShowExcluirConta(false);
                  setExcluirTexto("");
                }}
                disabled={excluindoConta}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl font-bold"
                disabled={excluirTexto !== "EXCLUIR MINHA CONTA"}
                loading={excluindoConta}
                onClick={onExcluirConta}
              >
                Excluir definitivamente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
