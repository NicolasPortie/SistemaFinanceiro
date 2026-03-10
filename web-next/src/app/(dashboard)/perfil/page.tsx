"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAtualizarPerfil } from "@/hooks/use-queries";
import { getInitials } from "@/lib/format";
import {
  atualizarPerfilSchema,
  alterarSenhaSchema,
  type AtualizarPerfilData,
  type AlterarSenhaData,
} from "@/lib/schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle,
  Diamond,
  LogOut,
  MessageCircle,
  Smartphone,
  Shield,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PerfilPage() {
  const { usuario, atualizarPerfil: atualizarContexto, logout } = useAuth();
  const [showSenha, setShowSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [encerrandoSessoes, setEncerrandoSessoes] = useState(false);
  const [verificando, setVerificando] = useState(false);

  const atualizarPerfilMutation = useAtualizarPerfil();

  const { data: minha } = useQuery({
    queryKey: ["assinatura-minha"],
    queryFn: () => api.assinaturas.minha(),
    staleTime: 5 * 60 * 1000,
  });
  const assinatura = minha?.assinatura;

  const perfilForm = useForm<AtualizarPerfilData>({
    resolver: zodResolver(atualizarPerfilSchema),
    defaultValues: { nome: usuario?.nome ?? "", celular: usuario?.celular ?? "" },
  });

  const senhaForm = useForm<AlterarSenhaData>({
    resolver: zodResolver(alterarSenhaSchema),
    defaultValues: { senhaAtual: "", novaSenha: "", confirmarSenha: "" },
  });

  if (!usuario) return null;

  /* ─── handlers ─── */
  const onSalvarPerfil = (data: AtualizarPerfilData) => {
    setSalvando(true);
    atualizarPerfilMutation.mutate(
      { nome: data.nome, celular: data.celular },
      {
        onSuccess: async () => {
          await atualizarContexto();
          toast.success("Perfil atualizado!");
          setSalvando(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erro ao salvar");
          setSalvando(false);
        },
      }
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
      }
    );
  };

  const verificarVinculo = async () => {
    setVerificando(true);
    try {
      await atualizarContexto();
      toast.success("Status atualizado!");
    } catch {
      // ignore
    } finally {
      setVerificando(false);
    }
  };

  const onEncerrarSessoes = async () => {
    setEncerrandoSessoes(true);
    try {
      logout();
      toast.success("Sessões encerradas.");
    } finally {
      setEncerrandoSessoes(false);
    }
  };

  const onAbrirSuporte = () => {
    const supportButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Abrir suporte"]'
    );

    if (supportButton) {
      supportButton.click();
      return;
    }

    toast.info("Use o botão flutuante para falar com o suporte.");
  };

  /* ─── plan data ─── */
  const planNome = assinatura?.planoNome ?? "Gratuito";
  const planStatus = assinatura?.statusNome ?? "Inativo";
  const planValor = assinatura?.valorMensal ?? 0;
  const planAtivo = assinatura?.status === "Ativa" || assinatura?.emTrial;

  const planBeneficios: Record<string, string[]> = {
    Individual: [
      "Lançamentos ilimitados",
      "Importação de extratos",
      "Telegram ilimitado",
      "Suporte prioritário",
    ],
    Familia: [
      "Tudo do Individual",
      "Titular + 1 membro",
      "Recursos compartilhados opcionais",
      "Suporte VIP",
    ],
    Gratuito: ["50 lançamentos/mês", "Categorias básicas", "Dashboard básico", "Sem importação"],
  };
  const beneficios = planBeneficios[assinatura?.plano ?? "Gratuito"] ?? planBeneficios["Gratuito"];

  /* ─── input class ─── */
  const inputCls =
    "w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500";
  const labelCls =
    "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block dark:text-slate-500";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight serif-italic">
          Perfil
        </h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mono-data uppercase tracking-[0.15em]">
          Gestão de Identidade Financeira
        </p>
      </div>

      {/* ── 12-col grid ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* ════ Left column (8 cols) ════ */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Identity card */}
          <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-12">
            {/* Avatar row */}
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 sm:justify-between mb-6 sm:mb-10">
              <div className="flex items-center gap-4 sm:gap-6">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 rounded-full bg-slate-100 border-4 border-white dark:bg-slate-800 dark:border-slate-900 shadow-2xl flex items-center justify-center">
                    <span className="text-2xl sm:text-4xl lg:text-5xl font-bold text-slate-400 dark:text-slate-500">
                      {getInitials(usuario.nome)}
                    </span>
                  </div>
                  {/* verified badge */}
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 dark:text-white">
                    {usuario.nome}
                  </h2>
                  <p className="mono-data text-xs text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">
                    {assinatura?.plano === "Familia" ? "CONTA FAMÍLIA" : "CONTA INDIVIDUAL"}
                  </p>
                </div>
              </div>

              {/* Save button */}
              <button
                type="submit"
                form="perfil-form"
                disabled={salvando || atualizarPerfilMutation.isPending}
                className="bg-slate-900 text-white rounded-full px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {salvando || atualizarPerfilMutation.isPending
                  ? "Salvando..."
                  : "Salvar Alterações"}
              </button>
            </div>

            {/* Profile form */}
            <form id="perfil-form" onSubmit={perfilForm.handleSubmit(onSalvarPerfil)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 lg:gap-x-8 gap-y-6">
                {/* Nome Completo */}
                <div className="col-span-2">
                  <label htmlFor="perfil-nome" className={labelCls}>
                    Nome Completo
                  </label>
                  <input
                    id="perfil-nome"
                    autoComplete="name"
                    {...perfilForm.register("nome")}
                    className={inputCls}
                    placeholder="Seu nome completo"
                  />
                  {perfilForm.formState.errors.nome && (
                    <p className="text-rose-500 text-xs mt-1">
                      {perfilForm.formState.errors.nome.message}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="perfil-email" className={labelCls}>
                    Email
                  </label>
                  <input
                    id="perfil-email"
                    name="email"
                    value={usuario.email}
                    readOnly
                    autoComplete="email"
                    className={cn(
                      inputCls,
                      "cursor-not-allowed text-slate-400 dark:text-slate-400"
                    )}
                  />
                </div>

                {/* Celular */}
                <div>
                  <label htmlFor="perfil-celular" className={labelCls}>
                    Celular (WhatsApp)
                  </label>
                  <input
                    id="perfil-celular"
                    autoComplete="tel"
                    {...perfilForm.register("celular")}
                    className={inputCls}
                    placeholder="(11) 99999-9999"
                    type="tel"
                    inputMode="tel"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Usado para vincular automaticamente Telegram e WhatsApp
                  </p>
                  {perfilForm.formState.errors.celular && (
                    <p className="text-rose-500 text-xs mt-1">
                      {perfilForm.formState.errors.celular.message}
                    </p>
                  )}
                </div>

                {/* Senha */}
                <div>
                  <label htmlFor="perfil-password" className={labelCls}>
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="perfil-password"
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      value="••••••••"
                      readOnly
                      className={cn(inputCls, "pr-24")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(true)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
                    >
                      Alterar
                    </button>
                  </div>
                </div>

                {/* CPF */}
                <div>
                  <label htmlFor="perfil-cpf" className={labelCls}>
                    CPF
                  </label>
                  <input
                    id="perfil-cpf"
                    name="cpf"
                    value={usuario.temCpf ? "•••.•••.•••-••" : "Não informado"}
                    readOnly
                    autoComplete="off"
                    className={cn(
                      inputCls,
                      "cursor-not-allowed mono-data text-slate-500 dark:text-slate-400"
                    )}
                  />
                </div>

                {/* Membro desde */}
                <div>
                  <label htmlFor="perfil-membro-desde" className={labelCls}>
                    Membro Desde
                  </label>
                  <input
                    id="perfil-membro-desde"
                    name="membro_desde"
                    value={new Date(usuario.criadoEm).toLocaleDateString("pt-BR")}
                    readOnly
                    autoComplete="off"
                    className={cn(
                      inputCls,
                      "cursor-not-allowed mono-data text-slate-500 dark:text-slate-400"
                    )}
                  />
                </div>
              </div>
            </form>
          </div>

          {/* Serviços Conectados */}
          <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-12">
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white serif-italic">
                Serviços Conectados
              </h3>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Vinculação automática pelo celular cadastrado
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Telegram tile */}
              <div
                className={cn(
                  "rounded-3xl bg-slate-50 border p-6 flex flex-col gap-3 dark:bg-slate-800/70",
                  usuario.telegramVinculado
                    ? "border-slate-100 dark:border-slate-700"
                    : "border-dashed border-slate-200 dark:border-slate-700/80"
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "#0088cc" }}
                  >
                    <MessageCircle className="text-white w-5 h-5" />
                  </div>
                  {usuario.telegramVinculado ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 rounded-full px-3 py-1 uppercase tracking-widest">
                      Conectado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/70 rounded-full px-3 py-1 uppercase tracking-widest">
                      Pendente
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Telegram Bot
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    @facilita_finance_bot
                  </p>
                </div>

                {usuario.telegramVinculado ? (
                  <button
                    type="button"
                    onClick={verificarVinculo}
                    disabled={verificando}
                    className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-colors text-left"
                  >
                    {verificando ? "Verificando..." : "Verificar Status"}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Envie uma mensagem ao bot e compartilhe seu contato para vincular
                      automaticamente.
                    </p>
                    <a
                      href="https://t.me/facilita_finance_bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
                    >
                      Abrir Telegram <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* WhatsApp tile */}
              <div
                className={cn(
                  "rounded-3xl bg-slate-50 border p-6 flex flex-col gap-3 dark:bg-slate-800/70",
                  usuario.whatsAppVinculado
                    ? "border-slate-100 dark:border-slate-700"
                    : "border-dashed border-slate-200 dark:border-slate-700/80"
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <Smartphone className="text-white w-5 h-5" />
                  </div>
                  {usuario.whatsAppVinculado ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 rounded-full px-3 py-1 uppercase tracking-widest">
                      Conectado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/70 rounded-full px-3 py-1 uppercase tracking-widest">
                      Pendente
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    WhatsApp Bot
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Falcon Finance</p>
                </div>

                {usuario.whatsAppVinculado ? (
                  <button
                    type="button"
                    onClick={verificarVinculo}
                    disabled={verificando}
                    className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-colors text-left"
                  >
                    {verificando ? "Verificando..." : "Verificar Status"}
                  </button>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Envie uma mensagem ao nosso WhatsApp — a vinculação é automática pelo seu
                    celular cadastrado.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════ Right column (4 cols) ════ */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Premium card */}
          <div className="relative bg-white dark:bg-[#161B22] border border-slate-200/70 dark:border-slate-700/70 border-l-4 border-l-emerald-500 rounded-[2rem] p-8 shadow-sm overflow-hidden">
            {/* Ghost icon bg */}
            <div className="absolute top-4 right-4 opacity-[0.03] pointer-events-none">
              <Diamond className="w-32 h-32 text-slate-900 dark:text-white" />
            </div>

            <div className="relative z-10 space-y-5">
              {/* Plan identity */}
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-2">
                  Plano Atual
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 dark:text-white serif-italic">
                    {planNome}
                  </h3>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1 border",
                      planAtivo
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                        : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    )}
                  >
                    {planStatus}
                  </span>
                </div>
                {planValor > 0 && (
                  <p className="mono-data text-lg text-emerald-600 mt-2">
                    R${" "}
                    {planValor.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    / mês
                  </p>
                )}
              </div>

              {/* Benefits */}
              <ul className="space-y-2">
                {beneficios.map((b) => (
                  <li key={b} className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-slate-600 dark:text-slate-300">{b}</span>
                  </li>
                ))}
              </ul>

              {/* Actions */}
              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  className="w-full py-4 rounded-2xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
                  onClick={() => toast.info("Upgrade disponível em breve")}
                >
                  Upgrade de Plano
                </button>
                <button
                  type="button"
                  className="w-full text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1"
                  onClick={() => toast.info("Histórico disponível em breve")}
                >
                  Ver Histórico de Faturas
                </button>
              </div>
            </div>
          </div>

          {/* Segurança Crítica */}
          <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Segurança Crítica
              </h3>
            </div>
            <button
              type="button"
              onClick={onEncerrarSessoes}
              disabled={encerrandoSessoes}
              className="w-full p-6 bg-slate-50 dark:bg-slate-800/80 rounded-[2rem] border border-transparent dark:border-slate-700/70 hover:border-rose-500/30 transition-all flex items-center gap-4 group"
            >
              <LogOut className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-rose-500 transition-colors shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Encerrar Sessões
                </p>
                <p className="text-xs text-rose-400 mt-0.5">
                  {encerrandoSessoes ? "Encerrando..." : "Fará logout desta conta"}
                </p>
              </div>
            </button>
          </div>

          {/* Help */}
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center px-4">
            Precisa de ajuda?{" "}
            <button
              type="button"
              className="text-emerald-600 hover:text-emerald-700 font-semibold"
              onClick={onAbrirSuporte}
            >
              Fale com o suporte
            </button>
          </p>
        </div>
      </div>

      {/* ── Alterar Senha modal ── */}
      <Dialog
        open={showSenha}
        onOpenChange={(open) => {
          if (!open) {
            setShowSenha(false);
            senhaForm.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <DialogTitle className="text-lg sm:text-xl font-semibold">
                  Alterar Senha
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">
                  Informe sua senha atual e a nova senha
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={senhaForm.handleSubmit(onAlterarSenha)} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="perfil-senha-atual"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Senha atual
              </Label>
              <Input
                id="perfil-senha-atual"
                type="password"
                autoComplete="current-password"
                className="h-11 rounded-xl"
                {...senhaForm.register("senhaAtual")}
              />
              {senhaForm.formState.errors.senhaAtual && (
                <p className="text-xs text-red-500">
                  {senhaForm.formState.errors.senhaAtual.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="perfil-nova-senha"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Nova senha
              </Label>
              <Input
                id="perfil-nova-senha"
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-xl"
                {...senhaForm.register("novaSenha")}
              />
              {senhaForm.formState.errors.novaSenha && (
                <p className="text-xs text-red-500">
                  {senhaForm.formState.errors.novaSenha.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="perfil-confirmar-senha"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Confirmar nova senha
              </Label>
              <Input
                id="perfil-confirmar-senha"
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-xl"
                {...senhaForm.register("confirmarSenha")}
              />
              {senhaForm.formState.errors.confirmarSenha && (
                <p className="text-xs text-red-500">
                  {senhaForm.formState.errors.confirmarSenha.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              loading={atualizarPerfilMutation.isPending}
            >
              <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
              Alterar senha
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
