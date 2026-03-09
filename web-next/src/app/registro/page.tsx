"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
import { AppleLoginButton } from "@/components/auth/apple-login-button";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
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
  return (
    <Suspense>
      <RegistroContent />
    </Suspense>
  );
}

function RegistroContent() {
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [socialTokenToComplete, setSocialTokenToComplete] = useState<{ provider: "google" | "apple"; token: string; nome?: string } | null>(null);
  const [celularCompletar, setCelularCompletar] = useState("");
  const { registrar, verificarRegistro, loginComGoogle, loginComApple, usuario } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const codigoConvite = searchParams.get("convite") ?? undefined;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegistroData>({
    resolver: zodResolver(registroSchema),
    defaultValues: { nome: "", email: "", celular: "", senha: "" },
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
      const res = await registrar(data.nome, data.email, data.senha, data.celular, codigoConvite);
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
    <main className="flex min-h-screen">
      {/* ── Left Panel — Brand & Visual ── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-10 bg-stone-50 overflow-hidden">
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: "radial-gradient(circle, #d6d3d1 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Soft emerald glow */}
        <div className="absolute top-1/4 right-0 w-125 h-125 bg-emerald-100/40 rounded-full blur-[150px] z-0" />
        <div className="absolute bottom-0 left-1/4 w-100 h-100 bg-emerald-50/60 rounded-full blur-[120px] z-0" />

        {/* Logo */}
        <div className="relative z-10">
          <Image src="/logo-text.png" alt="Ravier" width={100} height={30} className="object-contain" />
        </div>

        {/* Headline */}
        <div className="relative z-10 max-w-lg">
          <h1
            className="text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight text-stone-800 mb-6"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Comece sua <span className="italic text-emerald-700">jornada financeira</span>
          </h1>
          <p className="text-stone-500 text-lg leading-relaxed max-w-md">
            Transforme sua relação com o dinheiro em uma experiência visual e simplificada. Dashboard, metas e investimentos em um só lugar.
          </p>

          {/* Feature pills */}
          <div className="flex items-center gap-3 mt-8">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-stone-200/60 text-stone-600 text-xs font-semibold shadow-sm">
              <ShieldCheck className="size-3.5" />
              Dados Criptografados
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-stone-200/60 text-stone-600 text-xs font-semibold shadow-sm">
              <Zap className="size-3.5" />
              Setup Instantâneo
            </div>
          </div>
        </div>

        {/* Floating animated cards (Same as Login) */}
        <div className="relative z-10 flex gap-4">
          <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-md shadow-stone-200/50 border border-stone-100 animate-[float_6s_ease-in-out_infinite]">
            <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <BarChart3 className="size-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Dashboard</p>
              <p className="text-[11px] text-stone-400">Visão completa do mês</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-md shadow-stone-200/50 border border-stone-100 animate-[float_5s_ease-in-out_infinite_0.5s]">
            <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Wallet className="size-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Meta: 85%</p>
              <p className="text-[11px] text-emerald-600 font-semibold">Reserva concluída</p>
            </div>
          </div>
        </div>

        {/* CSS Animation */}
        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
        `}</style>
      </div>

      {/* ── Right Panel — Form ── */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <Image src="/logo-text.png" alt="Ravier" width={100} height={30} className="object-contain" />
          </div>

          <AnimatePresence mode="wait">
            {socialTokenToComplete ? (
              <motion.div
                key="social-celular"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full"
              >
                <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-100 flex items-start gap-3">
                  <div className="p-2 bg-orange-100/50 rounded-lg text-orange-600 mt-0.5">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-orange-900 mb-1">Quase lá!</h3>
                    <p className="text-xs text-orange-700/90 leading-relaxed">
                      Precisamos do seu celular (WhatsApp/Telegram) para enviar alertas de orçamento e garantir suporte via nosso assistente IA.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!celularCompletar || celularCompletar.replace(/\D/g, "").length < 10) {
                      toast.error("Por favor, informe um celular válido.");
                      return;
                    }
                    try {
                      if (socialTokenToComplete.provider === "google") {
                        await loginComGoogle(socialTokenToComplete.token, celularCompletar);
                      } else {
                        await loginComApple(socialTokenToComplete.token, celularCompletar, socialTokenToComplete.nome);
                      }
                      toast.success("Conta criada com sucesso!");
                      router.replace("/dashboard");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Erro ao finalizar cadastro");
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="celularCompletar"
                      className="block text-[11px] font-semibold tracking-widest text-stone-500 uppercase mb-1.5"
                    >
                      Celular <span className="text-stone-400 font-normal lowercase">(WhatsApp/Telegram)</span>
                    </label>
                    <Input
                      id="celularCompletar"
                      type="tel"
                      value={celularCompletar}
                      onChange={(e) => setCelularCompletar(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="bg-stone-50 border-stone-200 h-11 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 rounded-xl"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full relative group overflow-hidden bg-stone-900 text-white rounded-xl h-11 text-[13px] font-bold tracking-wide flex items-center justify-center transition-all duration-300 hover:bg-stone-800 hover:shadow-lg hover:shadow-stone-900/10 active:scale-[0.98]"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Concluir Cadastro
                      <ArrowRight className="size-4 opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSocialTokenToComplete(null)}
                    className="w-full text-center text-[12px] font-semibold text-stone-500 hover:text-stone-800 transition-colors py-2"
                  >
                    Voltar e tentar outra opção
                  </button>
                </form>
              </motion.div>
            ) : step === "form" ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {/* Heading */}
                <h2
                  className="text-2xl sm:text-3xl font-bold text-stone-800 mb-2"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Crie sua conta
                </h2>
                <p className="text-sm text-stone-400 mb-8">
                  Junte-se a milhares de usuários organizados.
                </p>

                <div className="mb-6 w-full">
                  <GoogleLoginButton
                    text="signup_with"
                    onSuccess={async (credential) => {
                      try {
                        await loginComGoogle(credential);
                        toast.success("Conta criada com Google!");
                        router.replace("/dashboard");
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : "";
                        if (msg.includes("Cadastro incompleto") || msg.includes("celular é obrigatório")) {
                          setSocialTokenToComplete({ provider: "google", token: credential });
                        } else {
                          toast.error(msg || "Erro ao entrar com Google");
                        }
                      }
                    }}
                    onError={() => {
                      toast.error("Erro ao autenticar com o Google");
                    }}
                  />

                  <div className="mt-3">
                    <AppleLoginButton
                      text="signup"
                      onSuccess={async (idToken, nome) => {
                        try {
                          await loginComApple(idToken, undefined, nome);
                          toast.success("Conta criada com Apple!");
                          router.replace("/dashboard");
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : "";
                          if (msg.includes("Cadastro incompleto") || msg.includes("celular é obrigatório")) {
                            setSocialTokenToComplete({ provider: "apple", token: idToken, nome });
                          } else {
                            toast.error(msg || "Erro ao entrar com Apple");
                          }
                        }
                      }}
                      onError={() => toast.error("Erro ao autenticar com a Apple")}
                    />
                  </div>

                  <div className="relative mt-6 mb-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-stone-200"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                      <span className="bg-white px-3 text-stone-400">
                        Ou crie com seu e-mail
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label
                      htmlFor="nome"
                      className="block text-[11px] font-semibold tracking-widest text-stone-500 uppercase mb-1.5"
                    >
                      Nome Completo
                    </label>
                    <input
                      id="nome"
                      type="text"
                      autoComplete="name"
                      placeholder="Como quer ser chamado?"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                      {...register("nome")}
                    />
                    {errors.nome && (
                      <p className="text-xs text-red-500 mt-1">{errors.nome.message}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-[11px] font-semibold tracking-widest text-stone-500 uppercase mb-1.5"
                    >
                      E-mail
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Celular */}
                  <div>
                    <label
                      htmlFor="celular"
                      className="block text-[11px] font-semibold tracking-widest text-stone-500 uppercase mb-1.5"
                    >
                      Celular (WhatsApp)
                    </label>
                    <input
                      id="celular"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="(11) 99999-9999"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                      {...register("celular")}
                    />
                    <p className="text-[10px] text-stone-400 mt-1">
                      Usado para comandos rápidos.
                    </p>
                    {errors.celular && (
                      <p className="text-xs text-red-500 mt-1">{errors.celular.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="senha"
                      className="block text-[11px] font-semibold tracking-widest text-stone-500 uppercase mb-1.5"
                    >
                      Senha
                    </label>
                    <div className="relative group">
                      <input
                        id="senha"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-12 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                        {...register("senha")}
                      />
                      <button
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.senha && (
                      <p className="text-xs text-red-500 mt-1">{errors.senha.message}</p>
                    )}

                    {/* Password strength */}
                    <AnimatePresence>
                      {senha && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-3 pb-1 overflow-hidden"
                        >
                          <div className="flex gap-1 mb-2">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className={`h-1 rounded-full flex-1 transition-colors ${strength >= level
                                  ? strength <= 2
                                    ? "bg-amber-400"
                                    : strength === 3
                                      ? "bg-yellow-400"
                                      : "bg-emerald-500"
                                  : "bg-stone-200"
                                  }`}
                              />
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {passedRules.map((rule) => (
                              <div
                                key={rule.label}
                                className={`flex items-center gap-1.5 text-[10px] font-bold tracking-wide ${rule.passed ? "text-emerald-600" : "text-stone-400"
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

                  {/* Submit */}
                  <button
                    className="w-full mt-6 py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                    type="submit"
                    disabled={isSubmitting || !allPassed}
                  >
                    {isSubmitting ? "Criando..." : (
                      <>
                        Criar Conta
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                {/* Login link */}
                <p className="text-center text-sm text-stone-500 mt-8">
                  Já tem uma conta?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    Fazer login
                  </Link>
                </p>
              </motion.div>
            ) : (
              /* ═══════════════════════════════
                 STEP 2 — Email Verification
                ═══════════════════════════════ */
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Icon + Title */}
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 mb-5">
                    <MailCheck className="h-8 w-8 text-emerald-700" />
                  </div>
                  <h2
                    className="text-2xl sm:text-3xl font-bold text-stone-800"
                    style={{ fontFamily: "'Georgia', serif" }}
                  >
                    Verifique seu e-mail
                  </h2>
                  <p className="mt-3 text-sm text-stone-500 leading-relaxed max-w-sm">
                    Enviamos um código de 6 dígitos para{" "}
                    <span className="font-semibold text-stone-800">{pendingEmail}</span>.
                  </p>
                </div>

                <form onSubmit={verifyForm.handleSubmit(onVerify)} className="space-y-6">
                  {/* Code input */}
                  <div>
                    <label
                      htmlFor="codigo"
                      className="block text-[11px] font-semibold tracking-widest text-stone-500 uppercase mb-2 text-center"
                    >
                      Código de verificação
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-stone-400" />
                      </div>
                      <input
                        id="codigo"
                        placeholder="000000"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        className="block w-full pl-12 h-14 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all text-center text-xl font-mono tracking-[0.5em] placeholder:text-stone-300 placeholder:tracking-[0.5em] font-bold"
                        {...verifyForm.register("codigo")}
                      />
                    </div>
                    {verifyForm.formState.errors.codigo && (
                      <p className="text-xs text-red-500 mt-2 text-center">{verifyForm.formState.errors.codigo.message}</p>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    type="submit"
                    disabled={verifying}
                  >
                    {verifying ? "Verificando..." : (
                      <>
                        Verificar e acessar
                        <Check className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Resend & Back */}
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-stone-500">
                    <span>Não recebeu?</span>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || resending}
                      className="font-semibold text-emerald-700 hover:text-emerald-800 disabled:text-stone-300 transition-colors flex items-center gap-1.5"
                    >
                      {resending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : "Reenviar"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    className="flex items-center justify-center gap-1.5 mx-auto text-sm text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Voltar ao formulário
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-center gap-4 mt-12 text-[11px] text-stone-400">
            <span>Termos de uso</span>
            <span className="text-stone-200">·</span>
            <span>Privacidade</span>
            <span className="text-stone-200">·</span>
            <span>© {new Date().getFullYear()} Ravier</span>
          </div>
        </div>
      </div>
    </main>
  );
}
