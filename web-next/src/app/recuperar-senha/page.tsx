"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  recuperarSenhaSchema,
  redefinirSenhaSchema,
  type RecuperarSenhaData,
  type RedefinirSenhaData,
} from "@/lib/schemas";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Step = "email" | "code" | "done";

export default function RecuperarSenhaPage() {
  const [step, setStep] = useState<Step>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfPassword, setShowConfPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");

  const emailForm = useForm<RecuperarSenhaData>({
    resolver: zodResolver(recuperarSenhaSchema),
    defaultValues: { email: "" },
  });

  const codeForm = useForm<RedefinirSenhaData>({
    resolver: zodResolver(redefinirSenhaSchema),
    defaultValues: { email: "", codigo: "", novaSenha: "", confirmarSenha: "" },
  });

  const onEmailSubmit = async (data: RecuperarSenhaData) => {
    try {
      await api.auth.recuperarSenha(data);
      setPendingEmail(data.email);
      codeForm.setValue("email", data.email);
      setStep("code");
      toast.success("Código de recuperação enviado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar código");
    }
  };

  const onCodeSubmit = async (data: RedefinirSenhaData) => {
    try {
      await api.auth.redefinirSenha(data);
      setStep("done");
      toast.success("Senha redefinida com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao redefinir senha");
    }
  };

  // ── Shared field wrapper ──
  const fieldWrap = (id: string, hasError: boolean) =>
    `relative rounded-xl border-2 transition-all duration-300 ${
      focusedField === id
        ? "border-emerald-500/50 ring-4 ring-emerald-500/8 shadow-lg shadow-emerald-500/5"
        : hasError
          ? "border-red-400/50 ring-4 ring-red-500/5"
          : "border-border/50 hover:border-border/80"
    }`;

  const iconCls = (id: string) =>
    `absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 transition-all duration-300 ${
      focusedField === id ? "text-emerald-500 scale-110" : "text-muted-foreground/40"
    }`;

  const stepLabels: Record<Step, { title: string; desc: string }> = {
    email: {
      title: "Recuperar senha",
      desc: "Informe o e-mail da sua conta para receber o código",
    },
    code: {
      title: "Nova senha",
      desc: "Insira o código recebido e defina sua nova senha",
    },
    done: {
      title: "Tudo certo!",
      desc: "Sua senha foi redefinida com sucesso",
    },
  };

  return (
    <div className="flex min-h-svh bg-background">
      {/* ════════════════════════════════════════════
          LEFT PANEL — Desktop only
         ════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-emerald-950 via-teal-900 to-cyan-950" />

        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Orbs */}
        <motion.div
          className="absolute top-[15%] right-[18%] w-72 h-72 rounded-full bg-emerald-400/8 blur-3xl"
          animate={{ y: [0, -25, 0], x: [0, 12, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[22%] left-[10%] w-52 h-52 rounded-full bg-teal-400/6 blur-3xl"
          animate={{ y: [0, 18, 0], x: [0, -8, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        <motion.div
          className="absolute top-[50%] left-[45%] w-36 h-36 rounded-full bg-cyan-400/5 blur-3xl"
          animate={{ y: [0, -10, 0], x: [0, 15, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        />

        {/* Accents */}
        <div className="absolute top-[16%] right-10 w-px h-32 bg-linear-to-b from-transparent via-emerald-400/25 to-transparent" />
        <div className="absolute bottom-[30%] left-12 w-20 h-px bg-linear-to-r from-transparent via-teal-400/25 to-transparent" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-linear-to-bl from-emerald-400/8 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-linear-to-tr from-cyan-400/6 to-transparent rounded-tr-full" />

        <div className="relative flex flex-col justify-between p-10 xl:p-14 text-white w-full z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 border border-white/10 backdrop-blur-sm shadow-lg shadow-black/10">
              <TrendingUp className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight leading-none">ControlFinance</span>
              <span className="text-[10px] text-emerald-300/50 font-medium tracking-[0.15em] uppercase mt-0.5">Financial Platform</span>
            </div>
          </div>

          {/* Hero */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-400/8 border border-emerald-400/15 mb-7">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300/80" />
                <span className="text-[11px] text-emerald-300/80 font-semibold tracking-wide">Recuperação segura</span>
              </div>

              <h2 className="text-[2rem] xl:text-[2.4rem] font-extrabold leading-[1.1] tracking-tight">
                Sem preocupações,
                <br />
                <span className="bg-linear-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                  nós ajudamos.
                </span>
              </h2>
              <p className="mt-5 text-[14px] text-white/35 leading-relaxed max-w-85">
                Redefina sua senha de forma rápida e segura. Basta verificar seu e-mail e criar uma nova senha.
              </p>
            </motion.div>

            {/* Steps preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl bg-white/3 border border-white/6 p-5 space-y-4"
            >
              <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider">Etapas do processo</p>
              {[
                { icon: Mail, text: "Informe seu e-mail cadastrado", active: step === "email" },
                { icon: KeyRound, text: "Insira o código e nova senha", active: step === "code" },
                { icon: CheckCircle2, text: "Pronto! Acesse sua conta", active: step === "done" },
              ].map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ${
                      item.active
                        ? "bg-emerald-400/15 border border-emerald-400/30"
                        : "bg-white/4"
                    }`}
                  >
                    <item.icon className={`h-3.5 w-3.5 ${item.active ? "text-emerald-300" : "text-white/30"}`} />
                  </div>
                  <span className={`text-[13px] font-medium ${item.active ? "text-white/80" : "text-white/35"}`}>
                    {item.text}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/25">© {new Date().getFullYear()} ControlFinance</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-emerald-400/40" />
              <div className="w-1 h-1 rounded-full bg-teal-400/40" />
              <div className="w-1 h-1 rounded-full bg-cyan-400/40" />
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          RIGHT PANEL — Form
         ════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/3 dark:bg-emerald-500/5 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-teal-500/3 dark:bg-teal-500/5 blur-[100px] pointer-events-none" />

        {/* ── Mobile Hero Header ── */}
        <div className="lg:hidden relative overflow-hidden">
          <div className="bg-linear-to-br from-emerald-950 via-teal-900 to-cyan-950 px-6 pt-safe-top relative">
            <div className="pt-8 pb-10">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-teal-400/8 blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
                    <TrendingUp className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-white tracking-tight leading-none">ControlFinance</span>
                    <span className="text-[9px] text-emerald-300/50 font-medium tracking-[0.15em] uppercase mt-0.5">Financial Platform</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white/90 tracking-tight">
                  {stepLabels[step].title}
                </h2>
                <p className="text-[13px] text-white/35 mt-1.5 max-w-xs">
                  {stepLabels[step].desc}
                </p>
              </div>
            </div>
          </div>
          <div className="h-5 bg-background relative -mt-5 rounded-t-[1.5rem]" />
        </div>

        {/* ── Form Area ── */}
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-12 lg:py-0">
          <AnimatePresence mode="wait">
            {/* ── Step 1: Email ── */}
            {step === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-105"
              >
                {/* Desktop header */}
                <div className="hidden lg:block mb-8">
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-[1.85rem] font-extrabold tracking-tight text-foreground"
                  >
                    Recuperar senha
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mt-2 text-[14px] text-muted-foreground/70"
                  >
                    Informe o e-mail da sua conta para receber o código
                  </motion.p>
                </div>

                {/* Mobile header */}
                <div className="lg:hidden mb-5">
                  <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                    Recuperar senha
                  </h1>
                  <p className="mt-1 text-[13px] text-muted-foreground/70">
                    Informe seu e-mail cadastrado
                  </p>
                </div>

                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-5">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                  >
                    <label htmlFor="email" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">
                      E-mail
                    </label>
                    <div className={fieldWrap("email", !!emailForm.formState.errors.email)}>
                      <Mail className={iconCls("email")} />
                      <Input
                        id="email"
                        type="email"
                        placeholder="nome@exemplo.com"
                        className="pl-12 h-13 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/30 font-medium"
                        autoComplete="email"
                        autoFocus
                        {...emailForm.register("email")}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField(null)}
                      />
                    </div>
                    {emailForm.formState.errors.email && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 pl-1 font-medium">
                        {emailForm.formState.errors.email.message}
                      </motion.p>
                    )}
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <Button
                      type="submit"
                      disabled={emailForm.formState.isSubmitting}
                      className="w-full h-13 text-[15px] font-bold rounded-xl bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 border-0 gap-2.5 group"
                    >
                      {emailForm.formState.isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Enviar código
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>

                {/* Back to login */}
                <div className="my-8 flex items-center gap-4">
                  <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/60 to-transparent" />
                  <span className="text-[11px] text-muted-foreground/40 font-semibold">Lembrou a senha?</span>
                  <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/60 to-transparent" />
                </div>

                <Link href="/login">
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl text-sm font-semibold gap-2 border-border/40 hover:border-emerald-500/30 hover:bg-emerald-500/3 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </Button>
                </Link>

                {/* Trust */}
                <div className="mt-8 flex items-center justify-center gap-4 text-[10px] text-muted-foreground/40">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Shield className="h-3 w-3" />
                    <span>SSL Seguro</span>
                  </div>
                  <div className="w-px h-3 bg-border/30" />
                  <div className="flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Dados protegidos</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Code + New Password ── */}
            {step === "code" && (
              <motion.div
                key="code"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-105"
              >
                {/* Desktop header */}
                <div className="hidden lg:block mb-8">
                  <h1 className="text-[1.85rem] font-extrabold tracking-tight text-foreground">
                    Redefinir senha
                  </h1>
                  <p className="mt-2 text-[14px] text-muted-foreground/70">
                    Código enviado para <span className="font-bold text-foreground">{pendingEmail}</span>
                  </p>
                </div>

                {/* Mobile header */}
                <div className="lg:hidden mb-5">
                  <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                    Redefinir senha
                  </h1>
                  <p className="mt-1 text-[13px] text-muted-foreground/70">
                    Código enviado para <span className="font-semibold text-foreground">{pendingEmail}</span>
                  </p>
                </div>

                <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-4">
                  {/* Code */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                  >
                    <label htmlFor="codigo" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">
                      Código de verificação
                    </label>
                    <div className={fieldWrap("codigo", !!codeForm.formState.errors.codigo)}>
                      <KeyRound className={iconCls("codigo")} />
                      <Input
                        id="codigo"
                        placeholder="000000"
                        className="pl-12 h-14 border-0 bg-transparent shadow-none focus-visible:ring-0 text-xl font-mono tracking-[0.4em] placeholder:text-muted-foreground/20 placeholder:tracking-[0.4em] font-bold"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        {...codeForm.register("codigo")}
                        onFocus={() => setFocusedField("codigo")}
                        onBlur={() => setFocusedField(null)}
                      />
                    </div>
                    {codeForm.formState.errors.codigo && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 pl-1 font-medium">
                        {codeForm.formState.errors.codigo.message}
                      </motion.p>
                    )}
                  </motion.div>

                  {/* Separator */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/50 to-transparent" />
                    <span className="text-[10px] text-muted-foreground/35 uppercase tracking-widest font-bold">Nova senha</span>
                    <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/50 to-transparent" />
                  </div>

                  {/* New Password */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="space-y-2"
                  >
                    <label htmlFor="novaSenha" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">
                      Nova senha
                    </label>
                    <div className={fieldWrap("novaSenha", !!codeForm.formState.errors.novaSenha)}>
                      <Lock className={iconCls("novaSenha")} />
                      <Input
                        id="novaSenha"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-12 pr-12 h-13 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/30 font-medium"
                        autoComplete="new-password"
                        {...codeForm.register("novaSenha")}
                        onFocus={() => setFocusedField("novaSenha")}
                        onBlur={() => setFocusedField(null)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground/60 transition-colors p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {codeForm.formState.errors.novaSenha && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 pl-1 font-medium">
                        {codeForm.formState.errors.novaSenha.message}
                      </motion.p>
                    )}
                  </motion.div>

                  {/* Confirm Password */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-2"
                  >
                    <label htmlFor="confirmarSenha" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">
                      Confirmar senha
                    </label>
                    <div className={fieldWrap("confirmarSenha", !!codeForm.formState.errors.confirmarSenha)}>
                      <Lock className={iconCls("confirmarSenha")} />
                      <Input
                        id="confirmarSenha"
                        type={showConfPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-12 pr-12 h-13 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/30 font-medium"
                        autoComplete="new-password"
                        {...codeForm.register("confirmarSenha")}
                        onFocus={() => setFocusedField("confirmarSenha")}
                        onBlur={() => setFocusedField(null)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfPassword(!showConfPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground/60 transition-colors p-1"
                        tabIndex={-1}
                      >
                        {showConfPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {codeForm.formState.errors.confirmarSenha && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 pl-1 font-medium">
                        {codeForm.formState.errors.confirmarSenha.message}
                      </motion.p>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="pt-1"
                  >
                    <Button
                      type="submit"
                      disabled={codeForm.formState.isSubmitting}
                      className="w-full h-13 text-[15px] font-bold rounded-xl bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 border-0 gap-2.5 group"
                    >
                      {codeForm.formState.isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Redefinir senha
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>

                {/* Back */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="flex items-center justify-center gap-1.5 mx-auto text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors font-medium"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Usar outro e-mail
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Done ── */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-105 text-center"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
                  className="flex h-20 w-20 items-center justify-center mx-auto rounded-3xl bg-emerald-500/10 dark:bg-emerald-400/10 mb-6"
                >
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-[1.85rem] font-extrabold tracking-tight text-foreground"
                >
                  Senha redefinida!
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mt-3 text-[14px] text-muted-foreground/70 max-w-xs mx-auto"
                >
                  Sua senha foi alterada com sucesso. Agora você pode acessar sua conta.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="mt-8"
                >
                  <Link href="/login">
                    <Button
                      className="w-full h-13 text-[15px] font-bold rounded-xl bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 border-0 gap-2.5 group"
                    >
                      Ir para o login
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
