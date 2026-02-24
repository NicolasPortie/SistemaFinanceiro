"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registroSchema,
  verificarRegistroSchema,
  type RegistroData,
  type VerificarRegistroData,
} from "@/lib/schemas";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Loader2,
  KeyRound,
  ShieldCheck,
  RefreshCw,
  MailCheck,
  Shield,
  Zap,
  Wallet,
  Lock as LockIcon,
  BarChart3,
  Maximize2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Step = "form" | "verify";

const passwordRules = [
  { label: "8+ caracteres", test: (s: string) => s.length >= 8 },
  { label: "Letra maiúscula", test: (s: string) => /[A-Z]/.test(s) },
  { label: "Letra minúscula", test: (s: string) => /[a-z]/.test(s) },
  { label: "Número", test: (s: string) => /\d/.test(s) },
];

export default function RegistroPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { registrar, verificarRegistro, usuario } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegistroData>({
    resolver: zodResolver(registroSchema),
    defaultValues: { nome: "", email: "", senha: "", codigoConvite: "" },
  });

  const verifyForm = useForm<VerificarRegistroData>({
    resolver: zodResolver(verificarRegistroSchema),
    defaultValues: { codigo: "" },
  });

  const senha = useWatch({ control, name: "senha" });
  const passedRules = useMemo(
    () => passwordRules.map((r) => ({ ...r, passed: r.test(senha || "") })),
    [senha]
  );
  const allPassed = passedRules.every((r) => r.passed);
  const strength = passedRules.filter((r) => r.passed).length;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    try {
      await api.auth.reenviarCodigoRegistro({ email: pendingEmail });
      setResendCooldown(60);
      verifyForm.reset();
      toast.success("Novo código enviado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reenviar código");
    } finally {
      setResending(false);
    }
  }, [pendingEmail, resendCooldown, resending, verifyForm]);

  useEffect(() => {
    if (usuario) {
      router.replace("/dashboard");
    }
  }, [usuario, router]);

  if (usuario) {
    return null;
  }

  const onSubmit = async (data: RegistroData) => {
    if (!allPassed) return;
    try {
      const res = await registrar(data.nome, data.email, data.senha, data.codigoConvite);
      if (res.pendente) {
        setPendingEmail(res.email);
        setStep("verify");
        setResendCooldown(60);
        toast.success("Código de verificação enviado para seu e-mail!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar conta");
    }
  };

  const onVerify = async (data: VerificarRegistroData) => {
    setVerifying(true);
    try {
      await verificarRegistro(pendingEmail, data.codigo);
      toast.success("Conta criada com sucesso!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="bg-auth-gradient font-sans text-slate-900 dark:text-slate-100 antialiased min-h-screen overflow-y-auto relative">
      {/* Background blurs */}
      <div className="absolute top-[-20%] left-[-10%] w-200 h-200 bg-emerald-500/30 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-150 h-150 bg-teal-500/20 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 h-full w-full flex flex-col p-6 sm:p-8 lg:p-12">
        {/* Header / Logo */}
        <header className="flex items-center gap-3 text-white/90">
          <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg shadow-black/10">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-white text-xl font-bold tracking-tight">
            Control Finance
          </h2>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 xl:gap-24 w-full max-w-6xl mx-auto">
          {/* ── Left: Hero text ── */}
          <div className="w-full lg:w-120 xl:w-135 shrink-0 text-center lg:text-left pt-8 lg:pt-0">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-white text-4xl sm:text-5xl lg:text-6xl xl:text-8xl font-black leading-[1.1] tracking-[-0.04em] mb-6 lg:mb-8"
            >
              Comece sua <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-300 to-teal-200">
                jornada financeira
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-emerald-100/70 text-base sm:text-lg lg:text-xl xl:text-2xl font-light max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              Transforme sua relação com o dinheiro em uma experiência visual e
              simplificada. Dashboard, metas e investimentos em um só lugar.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-10 lg:mt-12 hidden lg:flex items-center gap-8 opacity-60"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <span className="text-sm font-medium text-white">
                  Dados Criptografados
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-emerald-300" />
                <span className="text-sm font-medium text-white">
                  Setup Instantâneo
                </span>
              </div>
            </motion.div>
          </div>

          {/* ── Right: Registration card ── */}
          <div className="w-full lg:w-auto flex justify-center items-center py-4 lg:py-0">
            <AnimatePresence mode="wait">
              {step === "form" ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="w-full max-w-120 registration-glass-card p-7 sm:p-8 lg:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] relative"
                >
                  {/* Card header */}
                  <div className="mb-6 lg:mb-8">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-emerald-600/10 text-emerald-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                        Passo 01 de 02
                      </span>
                    </div>
                    <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Crie sua conta
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                      Junte-se a milhares de usuários organizados.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1"
                        htmlFor="nome"
                      >
                        Nome Completo
                      </label>
                      <input
                        className="block w-full px-4 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400"
                        id="nome"
                        placeholder="Como quer ser chamado?"
                        type="text"
                        autoComplete="name"
                        {...register("nome")}
                      />
                      {errors.nome && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 pl-1 font-medium"
                        >
                          {errors.nome.message}
                        </motion.p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1"
                        htmlFor="email"
                      >
                        E-mail
                      </label>
                      <input
                        className="block w-full px-4 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400"
                        id="email"
                        placeholder="seu@email.com"
                        type="email"
                        autoComplete="email"
                        {...register("email")}
                      />
                      {errors.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 pl-1 font-medium"
                        >
                          {errors.email.message}
                        </motion.p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1"
                        htmlFor="senha"
                      >
                        Senha
                      </label>
                      <div className="relative group">
                        <input
                          className="block w-full px-4 pr-12 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400"
                          id="senha"
                          placeholder="••••••••"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          {...register("senha")}
                        />
                        <button
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      {errors.senha && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 pl-1 font-medium"
                        >
                          {errors.senha.message}
                        </motion.p>
                      )}

                      {/* Password strength */}
                      <AnimatePresence>
                        {senha && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2 pt-2 px-1 overflow-hidden"
                          >
                            <div className="flex gap-1 mb-2">
                              {[1, 2, 3, 4].map((level) => (
                                <div
                                  key={level}
                                  className={`password-strength-bar flex-1 ${
                                    strength >= level
                                      ? strength <= 2
                                        ? "bg-yellow-400"
                                        : strength === 3
                                          ? "bg-yellow-400"
                                          : "bg-green-500"
                                      : "bg-slate-200 dark:bg-slate-700"
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {passedRules.map((rule) => (
                                <div
                                  key={rule.label}
                                  className={`flex items-center gap-1.5 text-[10px] font-bold ${
                                    rule.passed
                                      ? "text-green-500"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {rule.passed ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <X className="h-3.5 w-3.5" />
                                  )}
                                  {rule.label}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Invite Code */}
                    <div className="space-y-1.5">
                      <label
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1"
                        htmlFor="codigoConvite"
                      >
                        Código de Convite
                      </label>
                      <input
                        className="block w-full px-4 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400 font-mono tracking-wider uppercase"
                        id="codigoConvite"
                        placeholder="X8Y-Z2W"
                        type="text"
                        autoComplete="off"
                        {...register("codigoConvite")}
                      />
                      {errors.codigoConvite && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 pl-1 font-medium"
                        >
                          {errors.codigoConvite.message}
                        </motion.p>
                      )}
                    </div>

                    {/* Submit */}
                    <button
                      className="w-full h-14 bg-emerald-600 text-white text-lg font-bold rounded-2xl hover:bg-emerald-600/90 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 mt-4 shadow-xl shadow-emerald-600/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      type="submit"
                      disabled={isSubmitting || !allPassed}
                    >
                      {isSubmitting ? (
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Criar Conta
                          <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Login link */}
                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Já tem uma conta?
                      </span>
                      <Link
                        className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                        href="/login"
                      >
                        Fazer login
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* ═══════════════════════════════
                   STEP 2 — Email Verification
                  ═══════════════════════════════ */
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.5 }}
                  className="w-full max-w-110 registration-glass-card p-7 sm:p-8 lg:p-10 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] relative"
                >
                  {/* Step badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-emerald-600/10 text-emerald-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                      Passo 02 de 02
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="flex flex-col items-center text-center mb-8">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, type: "spring" }}
                      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/10 mb-5"
                    >
                      <MailCheck className="h-8 w-8 text-emerald-600" />
                    </motion.div>
                    <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Verifique seu e-mail
                    </h2>
                    <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                      Enviamos um código de 6 dígitos para{" "}
                      <span className="font-bold text-slate-900 dark:text-white">
                        {pendingEmail}
                      </span>
                      .<br />
                      Insira o código abaixo para concluir seu cadastro.
                    </p>
                  </div>

                  <form
                    onSubmit={verifyForm.handleSubmit(onVerify)}
                    className="space-y-6"
                  >
                    {/* Code input */}
                    <div className="space-y-2">
                      <label
                        htmlFor="codigo"
                        className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center block"
                      >
                        Código de verificação
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <KeyRound className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                        </div>
                        <input
                          className="block w-full pl-12 h-16 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all text-center text-2xl font-mono tracking-[0.5em] placeholder:text-slate-300 placeholder:tracking-[0.5em] font-bold"
                          id="codigo"
                          placeholder="000000"
                          maxLength={6}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          autoFocus
                          {...verifyForm.register("codigo")}
                        />
                      </div>
                      {verifyForm.formState.errors.codigo && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 text-center font-medium"
                        >
                          {verifyForm.formState.errors.codigo.message}
                        </motion.p>
                      )}
                    </div>

                    <button
                      className="w-full h-14 bg-emerald-600 text-white text-lg font-bold rounded-2xl hover:bg-emerald-600/90 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      type="submit"
                      disabled={verifying}
                    >
                      {verifying ? (
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Verificar e criar conta
                          <Check className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Resend + Back */}
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <span className="text-[13px] text-slate-500 dark:text-slate-400">
                        Não recebeu?
                      </span>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || resending}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        {resending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        {resendCooldown > 0
                          ? `Reenviar (${resendCooldown}s)`
                          : "Reenviar"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep("form")}
                      className="flex items-center justify-center gap-1.5 mx-auto text-[13px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors font-medium cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Voltar ao formulário
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto flex items-end justify-between gap-12 pb-2 max-w-6xl mx-auto w-full">
          {/* Preview cards (desktop only) */}
          <div className="hidden xl:flex flex-row gap-6 w-full max-w-4xl auth-subtle-preview">
            {/* Dashboard preview */}
            <div className="auth-glass-card rounded-t-3xl p-6 flex-1 flex flex-col justify-between min-h-40 opacity-40 hover:opacity-100 transition-all duration-700 translate-y-8 hover:translate-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-white/70" />
                  <span className="text-white font-bold text-xs uppercase tracking-widest">
                    Dashboard Mensal
                  </span>
                </div>
                <Maximize2 className="h-3.5 w-3.5 text-white/50" />
              </div>
              <div className="flex items-end gap-3 h-16">
                <div className="flex-1 bg-white/10 rounded-t-lg h-[40%]" />
                <div className="flex-1 bg-white/20 rounded-t-lg h-[70%]" />
                <div className="flex-1 bg-emerald-400/50 rounded-t-lg h-[95%] border-t border-white/30" />
                <div className="flex-1 bg-white/10 rounded-t-lg h-[55%]" />
                <div className="flex-1 bg-white/15 rounded-t-lg h-[30%]" />
                <div className="flex-1 bg-white/25 rounded-t-lg h-[80%]" />
              </div>
            </div>

            {/* Goals & Investment previews */}
            <div className="flex-1 flex flex-row gap-4 translate-y-8 hover:translate-y-4 transition-all duration-700">
              <div className="auth-glass-card rounded-t-3xl p-6 flex items-center gap-5 flex-1 opacity-40 hover:opacity-100 transition-all">
                <div className="size-14 rounded-full border-[3px] border-emerald-400 border-t-white/10 flex items-center justify-center shadow-lg">
                  <span className="text-xs text-white font-black">85%</span>
                </div>
                <div>
                  <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">
                    Metas
                  </p>
                  <p className="text-white text-sm font-bold">
                    Reserva Emergência
                  </p>
                </div>
              </div>
              <div className="auth-glass-card rounded-t-3xl p-6 flex items-center gap-5 flex-1 opacity-40 hover:opacity-100 transition-all">
                <div className="size-14 rounded-full border-[3px] border-emerald-400 border-t-white/10 flex items-center justify-center shadow-lg">
                  <span className="text-xs text-white font-black">42%</span>
                </div>
                <div>
                  <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">
                    Investimento
                  </p>
                  <p className="text-white text-sm font-bold">
                    Carteira Global
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="flex flex-col items-center lg:items-end justify-center pb-4 opacity-40">
            <p className="text-white text-[10px] tracking-[0.2em] mb-2 uppercase font-bold">
              © {new Date().getFullYear()} Control Finance Inc.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-white text-[10px] hover:underline cursor-pointer">
                Privacidade
              </span>
              <span className="text-white text-[10px] hover:underline cursor-pointer">
                Termos
              </span>
              <div className="flex items-center gap-1.5">
                <LockIcon className="h-3 w-3 text-white" />
                <span className="text-white text-[10px] font-medium">
                  SSL 256-bit
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
