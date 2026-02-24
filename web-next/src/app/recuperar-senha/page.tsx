"use client";

import { useState, useRef, useEffect } from "react";
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
  Wallet,
  Mail,
  MailCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Shield,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

type Step = "email" | "verify" | "reset" | "done";

export default function RecuperarSenhaPage() {
  const [step, setStep] = useState<Step>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfPassword, setShowConfPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Verify step: 6 digit inputs
  const [verifyDigits, setVerifyDigits] = useState(["", "", "", "", "", ""]);
  const verifyRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset step: 6 digit inputs (pre-filled from verify)
  const [resetDigits, setResetDigits] = useState(["", "", "", "", "", ""]);
  const resetRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Forms
  const emailForm = useForm<RecuperarSenhaData>({
    resolver: zodResolver(recuperarSenhaSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<RedefinirSenhaData>({
    resolver: zodResolver(redefinirSenhaSchema),
    defaultValues: { email: "", codigo: "", novaSenha: "", confirmarSenha: "" },
  });

  // Resend timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  // Password match
  const novaSenha = resetForm.watch("novaSenha");
  const confirmarSenha = resetForm.watch("confirmarSenha");
  const passwordsMatch =
    novaSenha && confirmarSenha && novaSenha === confirmarSenha;

  // ── Verify digit handlers ──
  const handleVerifyDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...verifyDigits];
    next[index] = value;
    setVerifyDigits(next);
    if (value && index < 5) verifyRefs.current[index + 1]?.focus();
  };

  const handleVerifyKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !verifyDigits[index] && index > 0) {
      verifyRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setVerifyDigits(next);
    verifyRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // ── Reset code digit handlers ──
  const handleResetDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...resetDigits];
    next[index] = value;
    setResetDigits(next);
    resetForm.setValue("codigo", next.join(""));
    if (value && index < 5) resetRefs.current[index + 1]?.focus();
  };

  const handleResetKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !resetDigits[index] && index > 0) {
      resetRefs.current[index - 1]?.focus();
    }
  };

  // ── Step 1: Send recovery email ──
  const onEmailSubmit = async (data: RecuperarSenhaData) => {
    try {
      await api.auth.recuperarSenha(data);
      setPendingEmail(data.email);
      setResendTimer(59);
      setStep("verify");
      toast.success("Código de recuperação enviado!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao enviar código",
      );
    }
  };

  // ── Step 2: Verify code (local) ──
  const onVerifySubmit = () => {
    const code = verifyDigits.join("");
    if (code.length !== 6) {
      toast.error("Preencha todos os 6 dígitos");
      return;
    }
    // Pre-fill reset step
    setResetDigits(code.split(""));
    resetForm.setValue("email", pendingEmail);
    resetForm.setValue("codigo", code);
    setStep("reset");
  };

  // ── Step 3: Reset password ──
  const onResetSubmit = async (data: RedefinirSenhaData) => {
    const code = resetDigits.join("");
    if (code.length !== 6) {
      toast.error("Código de verificação incompleto");
      return;
    }
    try {
      await api.auth.redefinirSenha({
        email: pendingEmail,
        codigo: code,
        novaSenha: data.novaSenha,
      });
      setStep("done");
      toast.success("Senha redefinida com sucesso!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao redefinir senha",
      );
    }
  };

  // ── Resend code ──
  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await api.auth.recuperarSenha({ email: pendingEmail });
      setResendTimer(59);
      toast.success("Código reenviado!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao reenviar código",
      );
    }
  };

  return (
    <div className="bg-auth-gradient font-sans text-slate-900 dark:text-slate-100 antialiased min-h-screen overflow-y-auto relative">
      {/* Background blurs */}
      <div className="absolute top-[-10%] left-[-5%] w-200 h-200 bg-emerald-600/30 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-150 h-150 bg-teal-500/15 rounded-full blur-[140px] pointer-events-none" />

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

        {/* Main */}
        <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 xl:gap-24 w-full max-w-6xl mx-auto">
          {/* ── Hero text ── */}
          <div className="w-full lg:w-120 xl:w-135 shrink-0 text-center lg:text-left pt-8 lg:pt-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                {step === "email" || step === "reset" ? (
                  <>
                    <h1 className="text-white text-4xl sm:text-5xl lg:text-7xl font-black leading-tight tracking-[-0.03em] mb-6 lg:mb-8">
                      Recupere seu <br />
                      <span className="text-emerald-300">acesso seguro</span>
                    </h1>
                    <p className="text-emerald-100 text-base sm:text-lg lg:text-xl font-normal opacity-70 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                      Sua segurança é nossa prioridade. Redefina sua senha em
                      poucos passos e volte ao controle total.
                    </p>
                    <div className="mt-12 hidden lg:flex items-center gap-8">
                      <div className="flex flex-col">
                        <span className="text-white text-3xl font-bold">
                          256-bit
                        </span>
                        <span className="text-emerald-200/50 text-xs uppercase tracking-widest font-bold">
                          Criptografia
                        </span>
                      </div>
                      <div className="w-px h-12 bg-white/10" />
                      <div className="flex flex-col">
                        <span className="text-white text-3xl font-bold">
                          MFA
                        </span>
                        <span className="text-emerald-200/50 text-xs uppercase tracking-widest font-bold">
                          Proteção Ativa
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h1 className="text-white text-4xl sm:text-5xl lg:text-7xl font-black leading-tight tracking-[-0.03em] mb-6 lg:mb-8">
                      Suas <span className="whitespace-nowrap">finanças no</span> <br />
                      <span className="text-emerald-300">controle total</span>
                    </h1>
                    <p className="text-emerald-100 text-base sm:text-lg lg:text-xl font-normal opacity-80 max-w-lg mx-auto lg:mx-0">
                      Dashboard e Metas em um só lugar. Acompanhe seu progresso
                      com interfaces modernas e intuitivas.
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Card area ── */}
          <div className="w-full lg:w-auto flex justify-center items-center py-8 lg:py-12">
            <AnimatePresence mode="wait">
              {/* ═══════════ STEP: EMAIL ═══════════ */}
              {step === "email" && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-115 recovery-glass-card p-7 sm:p-8 lg:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
                >
                  <div className="mb-8">
                    <div className="size-14 bg-emerald-600/10 rounded-2xl flex items-center justify-center mb-5">
                      <Mail className="h-7 w-7 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      Recuperar acesso
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-base leading-relaxed">
                      Informe o e-mail da sua conta para receber o código de
                      verificação
                    </p>
                  </div>

                  <form
                    onSubmit={emailForm.handleSubmit(onEmailSubmit)}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <label
                        className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1"
                        htmlFor="email"
                      >
                        E-mail
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                        </div>
                        <input
                          className="block w-full pl-11 pr-4 h-14 bg-white dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400"
                          id="email"
                          placeholder="exemplo@email.com"
                          type="email"
                          autoComplete="email"
                          autoFocus
                          {...emailForm.register("email")}
                        />
                      </div>
                      {emailForm.formState.errors.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 pl-1 font-medium"
                        >
                          {emailForm.formState.errors.email.message}
                        </motion.p>
                      )}
                    </div>

                    <button
                      className="w-full h-14 bg-emerald-600 text-white text-lg font-bold rounded-2xl hover:bg-emerald-600/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      type="submit"
                      disabled={emailForm.formState.isSubmitting}
                    >
                      {emailForm.formState.isSubmitting ? (
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Enviar código
                          <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-8 flex items-center justify-center">
                    <Link
                      href="/login"
                      className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar para o login
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* ═══════════ STEP: VERIFY CODE ═══════════ */}
              {step === "verify" && (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-115 login-glass-card p-7 sm:p-8 lg:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-center"
                >
                  <div className="mb-10">
                    <div className="size-16 bg-emerald-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <MailCheck className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      Verifique seu e-mail
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-3 text-base leading-relaxed">
                      Enviamos um código de 6 dígitos para seu e-mail
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onVerifySubmit();
                    }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between gap-2 lg:gap-3">
                      {verifyDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            verifyRefs.current[i] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) =>
                            handleVerifyDigit(i, e.target.value)
                          }
                          onKeyDown={(e) => handleVerifyKeyDown(i, e)}
                          onPaste={i === 0 ? handleVerifyPaste : undefined}
                          autoComplete={i === 0 ? "one-time-code" : "off"}
                          autoFocus={i === 0}
                          className="w-10 h-12 sm:w-12 sm:h-14 lg:w-14 lg:h-16 text-center text-xl sm:text-2xl font-bold bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none transition-all"
                        />
                      ))}
                    </div>

                    <button
                      className="w-full h-14 bg-emerald-600 text-white text-lg font-bold rounded-2xl hover:bg-emerald-600/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 cursor-pointer"
                      type="submit"
                    >
                      Confirmar
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </form>

                  <div className="mt-8">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        Não recebeu o código?
                      </span>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendTimer > 0}
                        className="font-bold text-emerald-600 hover:text-emerald-600/80 transition-colors flex items-center gap-2 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Reenviar código
                        {resendTimer > 0 && (
                          <span className="text-slate-400 font-medium text-xs tabular-nums">
                            (Reenviar em 0:
                            {resendTimer.toString().padStart(2, "0")})
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ═══════════ STEP: RESET PASSWORD ═══════════ */}
              {step === "reset" && (
                <motion.div
                  key="reset"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-120 recovery-glass-card p-7 sm:p-8 lg:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
                >
                  <div className="mb-10">
                    <div className="inline-flex items-center justify-center size-12 bg-emerald-600/10 rounded-2xl mb-6">
                      <KeyRound className="h-7 w-7 text-emerald-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                      Defina sua nova senha
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
                      Passo 2 de 2: Verificação e Alteração
                    </p>
                  </div>

                  <form
                    onSubmit={resetForm.handleSubmit(onResetSubmit)}
                    className="space-y-6"
                  >
                    {/* Verification Code */}
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Código de Verificação
                      </label>
                      <div className="grid grid-cols-6 gap-2">
                        {resetDigits.map((digit, i) => (
                          <input
                            key={i}
                            ref={(el) => {
                              resetRefs.current[i] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) =>
                              handleResetDigit(i, e.target.value)
                            }
                            onKeyDown={(e) => handleResetKeyDown(i, e)}
                            className="h-14 w-full text-center text-xl font-bold bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 outline-none transition-all"
                          />
                        ))}
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-3">
                      <label
                        className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1"
                        htmlFor="novaSenha"
                      >
                        Nova Senha
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <KeyRound className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                        </div>
                        <input
                          className="block w-full pl-11 pr-12 h-14 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400"
                          id="novaSenha"
                          placeholder="Mínimo 8 caracteres"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          {...resetForm.register("novaSenha")}
                        />
                        <button
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      {resetForm.formState.errors.novaSenha && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 pl-1 font-medium"
                        >
                          {resetForm.formState.errors.novaSenha.message}
                        </motion.p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-3">
                      <label
                        className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1"
                        htmlFor="confirmarSenha"
                      >
                        Confirmar Nova Senha
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock
                            className={`h-5 w-5 transition-colors ${
                              passwordsMatch
                                ? "text-green-500"
                                : "text-slate-400 group-focus-within:text-emerald-600"
                            }`}
                          />
                        </div>
                        <input
                          className={`block w-full pl-11 pr-12 h-14 bg-white dark:bg-slate-800 border-2 rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400 ${
                            passwordsMatch
                              ? "border-green-500/50"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                          id="confirmarSenha"
                          placeholder="Repita a nova senha"
                          type={showConfPassword ? "text" : "password"}
                          autoComplete="new-password"
                          {...resetForm.register("confirmarSenha")}
                        />
                        {passwordsMatch ? (
                          <div className="absolute inset-y-0 right-0 pr-4 flex items-center text-green-500">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                        ) : (
                          <button
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                            type="button"
                            onClick={() =>
                              setShowConfPassword(!showConfPassword)
                            }
                            tabIndex={-1}
                          >
                            {showConfPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        )}
                      </div>
                      {passwordsMatch && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[11px] text-green-600 dark:text-green-400 font-semibold flex items-center gap-1 ml-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          As senhas coincidem perfeitamente.
                        </motion.p>
                      )}
                      {resetForm.formState.errors.confirmarSenha && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 pl-1 font-medium"
                        >
                          {resetForm.formState.errors.confirmarSenha.message}
                        </motion.p>
                      )}
                    </div>

                    <button
                      className="w-full h-14 bg-emerald-600 text-white text-lg font-bold rounded-2xl hover:bg-emerald-600/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4 shadow-xl shadow-emerald-600/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      type="submit"
                      disabled={resetForm.formState.isSubmitting}
                    >
                      {resetForm.formState.isSubmitting ? (
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Redefinir Senha
                          <ArrowRight className="h-6 w-6" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-8 flex items-center justify-center">
                    <Link
                      href="/login"
                      className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar para o login
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* ═══════════ STEP: DONE ═══════════ */}
              {step === "done" && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-110 login-glass-card p-7 sm:p-8 lg:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-center"
                >
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.15,
                      type: "spring",
                      stiffness: 200,
                    }}
                    className="size-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6"
                  >
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight"
                  >
                    Senha redefinida!
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="text-slate-500 dark:text-slate-400 mt-3 text-base max-w-xs mx-auto"
                  >
                    Sua senha foi alterada com sucesso. Agora você pode acessar
                    sua conta.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mt-8"
                  >
                    <Link href="/login">
                      <button
                        className="w-full h-14 bg-emerald-600 text-white text-lg font-bold rounded-2xl hover:bg-emerald-600/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 cursor-pointer"
                        type="button"
                      >
                        Ir para o login
                        <ArrowRight className="h-5 w-5" />
                      </button>
                    </Link>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto flex flex-col lg:flex-row items-end justify-between gap-8 pb-4 max-w-6xl mx-auto w-full">
          {/* Preview cards (desktop only) */}
          <div className="hidden lg:flex flex-row gap-6 w-full lg:w-[60%] auth-subtle-preview">
            {/* Dashboard preview */}
            <div className="auth-glass-card rounded-t-3xl p-6 flex-1 flex flex-col justify-between min-h-40 opacity-40 hover:opacity-100 transition-opacity duration-500">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white font-bold text-xs uppercase tracking-widest">
                  Dashboard Mensal
                </span>
                <div className="flex gap-1">
                  <div className="size-1.5 rounded-full bg-white/30" />
                  <div className="size-1.5 rounded-full bg-white/30" />
                </div>
              </div>
              <div className="flex items-end gap-3 h-20">
                <div className="flex-1 bg-white/10 rounded-t-sm h-[40%]" />
                <div className="flex-1 bg-white/20 rounded-t-sm h-[70%]" />
                <div className="flex-1 bg-emerald-600/40 rounded-t-sm h-[95%] border-t-2 border-white/30" />
                <div className="flex-1 bg-white/15 rounded-t-sm h-[55%]" />
                <div className="flex-1 bg-white/25 rounded-t-sm h-[30%]" />
                <div className="flex-1 bg-white/10 rounded-t-sm h-[60%]" />
              </div>
            </div>

            {/* Goals & Investment previews */}
            <div className="flex-1 flex flex-row gap-4">
              <div className="auth-glass-card rounded-t-3xl p-6 flex items-center gap-4 flex-1 opacity-40 hover:opacity-100 transition-opacity duration-500">
                <div className="size-14 rounded-full border-4 border-emerald-600 border-t-white/10 flex items-center justify-center">
                  <span className="text-xs text-white font-black">85%</span>
                </div>
                <div>
                  <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">
                    Metas
                  </p>
                  <p className="text-white text-sm font-bold">
                    Reserva de Emergência
                  </p>
                </div>
              </div>
              <div className="auth-glass-card rounded-t-3xl p-6 flex items-center gap-4 flex-1 opacity-40 hover:opacity-100 transition-opacity duration-500">
                <div className="size-14 rounded-full border-4 border-green-400 border-t-white/10 flex items-center justify-center">
                  <span className="text-xs text-white font-black">42%</span>
                </div>
                <div>
                  <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">
                    Investimentos
                  </p>
                  <p className="text-white text-sm font-bold">Ações Globais</p>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="w-full lg:w-1/3 flex flex-col items-center lg:items-end justify-center ml-auto">
            <p className="text-white/20 text-[10px] tracking-widest mb-2 uppercase font-bold">
              © {new Date().getFullYear()} Control Finance Inc.
            </p>
            <p className="text-white/40 text-[10px] flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <Shield className="h-3.5 w-3.5" />
              Conexão Criptografada
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
