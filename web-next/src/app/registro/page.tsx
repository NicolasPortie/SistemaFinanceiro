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
  TrendingUp,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  User,
  Check,
  X,
  Loader2,
  KeyRound,
  ShieldCheck,
  PieChart,
  Bot,
  Target,
  CreditCard,
  RefreshCw,
  MailCheck,
  Shield,
  Zap,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Step = "form" | "verify";

const passwordRules = [
  { label: "Mínimo 8 caracteres", test: (s: string) => s.length >= 8 },
  { label: "Letra maiúscula", test: (s: string) => /[A-Z]/.test(s) },
  { label: "Letra minúscula", test: (s: string) => /[a-z]/.test(s) },
  { label: "Um número", test: (s: string) => /\d/.test(s) },
];

export default function RegistroPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
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

  if (usuario) {
    router.replace("/dashboard");
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

  // ── Shared field renderer ──
  const renderField = (
    id: string,
    label: string,
    icon: React.ReactNode,
    inputProps: React.InputHTMLAttributes<HTMLInputElement>,
    error?: string,
    rightElement?: React.ReactNode,
    labelExtra?: React.ReactNode
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">
          {label}
        </label>
        {labelExtra}
      </div>
      <div
        className={`relative rounded-xl border-2 transition-all duration-300 ${
          focusedField === id
            ? "border-emerald-500/50 ring-4 ring-emerald-500/8 shadow-lg shadow-emerald-500/5"
            : error
              ? "border-red-400/50 ring-4 ring-red-500/5"
              : "border-border/50 hover:border-border/80"
        }`}
      >
        <div
          className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${
            focusedField === id ? "text-emerald-500 scale-110" : "text-muted-foreground/40"
          }`}
        >
          {icon}
        </div>
        <Input
          id={id}
          className={`pl-12 ${rightElement ? "pr-12" : ""} h-[52px] border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/30 font-medium`}
          onFocus={() => setFocusedField(id)}
          onBlur={() => setFocusedField(null)}
          {...inputProps}
        />
        {rightElement && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 pl-1 font-medium">
          {error}
        </motion.p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-svh bg-background">
      {/* ════════════════════════════════════════════
          LEFT PANEL — Desktop only
         ════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-emerald-950 via-teal-900 to-cyan-950" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Animated floating orbs */}
        <motion.div
          className="absolute top-[12%] right-[15%] w-72 h-72 rounded-full bg-emerald-400/8 blur-3xl"
          animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[18%] left-[8%] w-56 h-56 rounded-full bg-teal-400/6 blur-3xl"
          animate={{ y: [0, 20, 0], x: [0, -10, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute top-[48%] left-[45%] w-40 h-40 rounded-full bg-cyan-400/5 blur-3xl"
          animate={{ y: [0, -15, 0], x: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        />

        {/* Geometric accents */}
        <div className="absolute top-[18%] right-10 w-px h-36 bg-linear-to-b from-transparent via-emerald-400/25 to-transparent" />
        <div className="absolute bottom-[28%] left-14 w-24 h-px bg-linear-to-r from-transparent via-teal-400/25 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-bl from-emerald-400/8 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-linear-to-tr from-cyan-400/6 to-transparent rounded-tr-full" />

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
                <span className="text-[11px] text-emerald-300/80 font-semibold tracking-wide">Acesso por convite</span>
              </div>

              <h2 className="text-[2rem] xl:text-[2.5rem] font-extrabold leading-[1.1] tracking-tight">
                Comece sua jornada
                <br />
                <span className="bg-linear-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                  financeira hoje.
                </span>
              </h2>
              <p className="mt-5 text-[14px] text-white/40 leading-relaxed max-w-[340px]">
                Plataforma exclusiva com acesso por convite. Use o código recebido para criar sua conta.
              </p>
            </motion.div>

            {/* What you get */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3.5"
            >
              <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider">O que você terá acesso</p>
              {[
                { icon: PieChart, text: "Dashboard completo com gráficos" },
                { icon: Bot, text: "Bot no Telegram com IA" },
                { icon: Target, text: "Metas e limites financeiros" },
                { icon: CreditCard, text: "Gestão de cartões e faturas" },
              ].map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/8">
                    <item.icon className="h-3.5 w-3.5 text-emerald-400/60" />
                  </div>
                  <span className="text-[13px] text-white/50 font-medium">{item.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/20">© {new Date().getFullYear()} ControlFinance</p>
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
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-teal-500/[0.03] dark:bg-teal-500/[0.05] blur-[100px] pointer-events-none" />

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
                  Crie sua conta
                </h2>
                <p className="text-[13px] text-white/40 mt-1.5 max-w-xs">
                  Acesso exclusivo por convite
                </p>
              </div>
            </div>
          </div>
          <div className="h-5 bg-background relative -mt-5 rounded-t-[1.5rem]" />
        </div>

        {/* ── Form Area ── */}
        <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-8 lg:px-12 lg:py-0">
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-[420px]"
              >
                {/* Desktop header */}
                <div className="hidden lg:block mb-8">
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-[1.85rem] font-extrabold tracking-tight text-foreground"
                  >
                    Criar conta
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mt-2 text-[14px] text-muted-foreground/70"
                  >
                    Preencha os dados e informe seu código de convite
                  </motion.p>
                </div>

                {/* Mobile header */}
                <div className="lg:hidden mb-5">
                  <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Criar conta</h1>
                  <p className="mt-1 text-[13px] text-muted-foreground/70">
                    Preencha seus dados para começar
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Invite Code — highlight */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-2"
                  >
                    <label htmlFor="codigoConvite" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em] flex items-center gap-1.5">
                      <KeyRound className="h-3 w-3 text-emerald-500" />
                      Código de convite
                    </label>
                    <div
                      className={`relative rounded-xl border-2 transition-all duration-300 ${
                        focusedField === "codigoConvite"
                          ? "border-emerald-500/50 ring-4 ring-emerald-500/8 shadow-lg shadow-emerald-500/5"
                          : errors.codigoConvite
                            ? "border-red-400/50 ring-4 ring-red-500/5"
                            : "border-emerald-500/20 bg-emerald-500/[0.02]"
                      }`}
                    >
                      <ShieldCheck
                        className={`absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] transition-all duration-300 ${
                          focusedField === "codigoConvite" ? "text-emerald-500 scale-110" : "text-emerald-500/40"
                        }`}
                      />
                      <Input
                        id="codigoConvite"
                        placeholder="Insira o código recebido"
                        className="pl-12 h-[52px] border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/30 font-mono tracking-wider uppercase font-semibold"
                        autoComplete="off"
                        {...register("codigoConvite")}
                        onFocus={() => setFocusedField("codigoConvite")}
                        onBlur={() => setFocusedField(null)}
                      />
                    </div>
                    {errors.codigoConvite && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 pl-1 font-medium">
                        {errors.codigoConvite.message}
                      </motion.p>
                    )}
                    <p className="text-[10px] text-muted-foreground/40 pl-1 font-medium">
                      Código fornecido pelo administrador da plataforma
                    </p>
                  </motion.div>

                  {/* Separator */}
                  <div className="flex items-center gap-3 py-0.5">
                    <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/50 to-transparent" />
                    <span className="text-[10px] text-muted-foreground/35 uppercase tracking-widest font-bold">Dados pessoais</span>
                    <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/50 to-transparent" />
                  </div>

                  {/* Name */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    {renderField(
                      "nome",
                      "Nome completo",
                      <User className="h-[18px] w-[18px]" />,
                      { placeholder: "Seu nome completo", autoComplete: "name", ...register("nome") },
                      errors.nome?.message
                    )}
                  </motion.div>

                  {/* Email */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    {renderField(
                      "email",
                      "E-mail",
                      <Mail className="h-[18px] w-[18px]" />,
                      { type: "email", placeholder: "nome@exemplo.com", autoComplete: "email", ...register("email") },
                      errors.email?.message
                    )}
                  </motion.div>

                  {/* Password */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="space-y-2"
                  >
                    <label htmlFor="senha" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">
                      Senha
                    </label>
                    <div
                      className={`relative rounded-xl border-2 transition-all duration-300 ${
                        focusedField === "senha"
                          ? "border-emerald-500/50 ring-4 ring-emerald-500/8 shadow-lg shadow-emerald-500/5"
                          : errors.senha
                            ? "border-red-400/50 ring-4 ring-red-500/5"
                            : "border-border/50 hover:border-border/80"
                      }`}
                    >
                      <Lock
                        className={`absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] transition-all duration-300 ${
                          focusedField === "senha" ? "text-emerald-500 scale-110" : "text-muted-foreground/40"
                        }`}
                      />
                      <Input
                        id="senha"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-12 pr-12 h-[52px] border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/30 font-medium"
                        autoComplete="new-password"
                        {...register("senha")}
                        onFocus={() => setFocusedField("senha")}
                        onBlur={() => setFocusedField(null)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground/60 transition-colors p-1"
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Password strength */}
                    <AnimatePresence>
                      {senha && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2.5 pt-1 overflow-hidden"
                        >
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                                  strength >= level
                                    ? strength <= 2
                                      ? "bg-red-400"
                                      : strength === 3
                                        ? "bg-amber-400"
                                        : "bg-emerald-500"
                                    : "bg-muted/40"
                                }`}
                              />
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {passedRules.map((rule) => (
                              <div
                                key={rule.label}
                                className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                                  rule.passed
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground/40"
                                }`}
                              >
                                {rule.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                {rule.label}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Submit */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="pt-1"
                  >
                    <Button
                      type="submit"
                      disabled={isSubmitting || !allPassed}
                      className="w-full h-[52px] text-[15px] font-bold rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-600/15 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 border-0 gap-2.5 group"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Criar conta
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>

                {/* Divider */}
                <div className="my-6 flex items-center gap-4">
                  <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/60 to-transparent" />
                  <span className="text-[11px] text-muted-foreground/40 font-semibold">Já tem conta?</span>
                  <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/60 to-transparent" />
                </div>

                <Link href="/login">
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl text-sm font-semibold border-border/40 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
                  >
                    Fazer login
                  </Button>
                </Link>

                {/* Trust */}
                <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
                  {[
                    { icon: Shield, text: "SSL Seguro" },
                    { icon: Zap, text: "Acesso rápido" },
                    { icon: Sparkles, text: "IA integrada" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30 font-medium">
                      <item.icon className="h-3 w-3" />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* ════════════════════════════════════════
                 STEP 2 — Email Verification
                ════════════════════════════════════════ */
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-md"
              >
                {/* Icon + Title */}
                <div className="flex flex-col items-center text-center mb-8">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring" }}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10 mb-5"
                  >
                    <MailCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </motion.div>
                  <h1 className="text-[1.75rem] font-extrabold tracking-tight text-foreground">
                    Verifique seu e-mail
                  </h1>
                  <p className="mt-3 text-[13px] text-muted-foreground/70 leading-relaxed max-w-sm">
                    Enviamos um código de 6 dígitos para{" "}
                    <span className="font-bold text-foreground">{pendingEmail}</span>.
                    <br />
                    Insira o código abaixo para concluir seu cadastro.
                  </p>
                </div>

                <form onSubmit={verifyForm.handleSubmit(onVerify)} className="space-y-6">
                  {/* Code input */}
                  <div className="space-y-2">
                    <label htmlFor="codigo" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em] text-center block">
                      Código de verificação
                    </label>
                    <div
                      className={`relative rounded-xl border-2 transition-all duration-300 ${
                        focusedField === "codigo"
                          ? "border-emerald-500/50 ring-4 ring-emerald-500/8 shadow-lg shadow-emerald-500/5"
                          : verifyForm.formState.errors.codigo
                            ? "border-red-400/50 ring-4 ring-red-500/5"
                            : "border-border/50 hover:border-border/80"
                      }`}
                    >
                      <KeyRound
                        className={`absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] transition-all duration-300 ${
                          focusedField === "codigo" ? "text-emerald-500 scale-110" : "text-muted-foreground/40"
                        }`}
                      />
                      <Input
                        id="codigo"
                        placeholder="000000"
                        className="pl-12 h-[60px] border-0 bg-transparent shadow-none focus-visible:ring-0 text-center text-2xl font-mono tracking-[0.5em] placeholder:text-muted-foreground/20 placeholder:tracking-[0.5em] font-bold"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        {...verifyForm.register("codigo")}
                        onFocus={() => setFocusedField("codigo")}
                        onBlur={() => setFocusedField(null)}
                      />
                    </div>
                    {verifyForm.formState.errors.codigo && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 text-center font-medium">
                        {verifyForm.formState.errors.codigo.message}
                      </motion.p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={verifying}
                    className="w-full h-[52px] text-[15px] font-bold rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-600/15 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 border-0 gap-2.5"
                  >
                    {verifying ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Verificar e criar conta
                        <Check className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Resend + Back */}
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className="text-[13px] text-muted-foreground/60">Não recebeu?</span>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || resending}
                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 disabled:text-muted-foreground/30 disabled:cursor-not-allowed transition-colors"
                    >
                      {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : "Reenviar"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    className="flex items-center justify-center gap-1.5 mx-auto text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors font-medium"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Voltar ao formulário
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
