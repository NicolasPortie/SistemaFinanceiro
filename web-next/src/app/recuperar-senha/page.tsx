"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
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
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Shield,
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
  const passwordsMatch = novaSenha && confirmarSenha && novaSenha === confirmarSenha;

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
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setVerifyDigits(next);
    verifyRefs.current[Math.min(pasted.length, 5)]?.focus();
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
      toast.error(err instanceof Error ? err.message : "Erro ao enviar código");
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
      toast.error(err instanceof Error ? err.message : "Erro ao redefinir senha");
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
      toast.error(err instanceof Error ? err.message : "Erro ao reenviar código");
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
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-[150px] -z-0" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-emerald-50/60 rounded-full blur-[120px] -z-0" />

        {/* Logo */}
        <div className="relative z-10 block">
          <Link href="/">
            <Image
              src="/logo-text.png"
              alt="Ravier"
              width={100}
              height={30}
              className="object-contain"
            />
          </Link>
        </div>

        {/* Headline */}
        <div className="relative z-10 max-w-lg">
          <h1
            className="text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight text-stone-800 mb-6"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Acesso <span className="italic text-emerald-700">seguro</span>,
            <br /> controle <span className="text-emerald-700">total.</span>
          </h1>
          <p className="text-stone-500 text-lg leading-relaxed max-w-md">
            Sua conta protegida com as melhores práticas de segurança e criptografia avançada.
          </p>

          {/* Feature pills */}
          <div className="flex items-center gap-3 mt-8">
            {[
              { icon: <ShieldCheck className="size-3.5" />, label: "Criptografia 256-bit" },
              { icon: <KeyRound className="size-3.5" />, label: "Recuperação Segura" },
            ].map((pill) => (
              <div
                key={pill.label}
                className="flex items-center gap-2 px-3.5 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-stone-200/60 text-stone-600 text-xs font-semibold shadow-sm"
              >
                {pill.icon}
                {pill.label}
              </div>
            ))}
          </div>
        </div>

        {/* Floating animated cards */}
        <div className="relative z-10 flex gap-4">
          <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-md shadow-stone-200/50 border border-stone-100 animate-[float_6s_ease-in-out_infinite]">
            <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Shield className="size-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Proteção Ativa</p>
              <p className="text-[11px] text-stone-400">Dados assegurados</p>
            </div>
          </div>
        </div>

        {/* CSS Animation */}
        <style jsx>{`
          @keyframes float {
            0%,
            100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-8px);
            }
          }
        `}</style>
      </div>

      {/* ── Right Panel — Form ── */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <Link href="/">
              <Image
                src="/logo-text.png"
                alt="Ravier"
                width={100}
                height={30}
                className="object-contain"
              />
            </Link>
          </div>

          <AnimatePresence mode="wait">
            {/* ═══════════ STEP: EMAIL ═══════════ */}
            {step === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <h2
                  className="text-2xl sm:text-3xl font-bold text-stone-800 mb-2"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Recuperar acesso
                </h2>
                <p className="text-sm text-stone-400 mb-8 leading-relaxed">
                  Informe o e-mail da sua conta para receber o código de verificação.
                </p>

                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-5">
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
                      autoFocus
                      placeholder="seu@email.com"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                      {...emailForm.register("email")}
                    />
                    {emailForm.formState.errors.email && (
                      <p className="text-xs text-red-500 mt-1">
                        {emailForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={emailForm.formState.isSubmitting}
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                  >
                    {emailForm.formState.isSubmitting ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Enviar código
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-sm text-stone-500 mt-8">
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-2 font-semibold text-stone-500 hover:text-emerald-700 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para o login
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ═══════════ STEP: VERIFY ═══════════ */}
            {step === "verify" && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <h2
                  className="text-2xl sm:text-3xl font-bold text-stone-800 mb-2"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Verifique seu e-mail
                </h2>
                <p className="text-sm text-stone-400 mb-8 leading-relaxed">
                  Enviamos um código de 6 dígitos para o seu e-mail.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onVerifySubmit();
                  }}
                  className="space-y-6"
                >
                  <div className="flex justify-between gap-2">
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
                        onChange={(e) => handleVerifyDigit(i, e.target.value)}
                        onKeyDown={(e) => handleVerifyKeyDown(i, e)}
                        onPaste={i === 0 ? handleVerifyPaste : undefined}
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        autoFocus={i === 0}
                        className="flex-1 w-full aspect-[4/5] text-center text-xl sm:text-2xl font-bold bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                      />
                    ))}
                  </div>

                  <button
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                    type="submit"
                  >
                    Confirmar
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </form>

                <div className="mt-8">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-stone-400 text-sm"> Não recebeu o código? </span>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendTimer > 0}
                      className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reenviar código
                      {resendTimer > 0 && (
                        <span className="text-stone-400 font-medium"> ({resendTimer}s) </span>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-center text-sm text-stone-500 mt-8">
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-2 font-semibold text-stone-500 hover:text-emerald-700 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para o login
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ═══════════ STEP: RESET ═══════════ */}
            {step === "reset" && (
              <motion.div
                key="reset"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <h2
                  className="text-2xl sm:text-3xl font-bold text-stone-800 mb-2"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Defina a nova senha
                </h2>
                <p className="text-sm text-stone-400 mb-8 leading-relaxed">
                  Para sua segurança, escolha uma senha forte.
                </p>

                <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-5">
                  {/* Verification Code Viewer */}
                  <div className="space-y-1.5 hidden">
                    <label className="text-[11px] font-semibold tracking-widest text-stone-500 uppercase flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Código de Verificação
                    </label>
                    <div className="grid grid-cols-6 gap-2 opacity-50 pointer-events-none">
                      {resetDigits.map((digit, i) => (
                        <input
                          key={i}
                          type="text"
                          value={digit}
                          readOnly
                          className="h-10 text-center font-bold bg-stone-100 border border-stone-200 rounded-lg text-stone-500"
                        />
                      ))}
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label
                      htmlFor="novaSenha"
                      className="block text-[11px] font-semibold tracking-widest text-stone-500 uppercase mb-1.5"
                    >
                      Nova Senha
                    </label>
                    <div className="relative group">
                      <input
                        id="novaSenha"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                        className="w-full px-4 py-3 pr-12 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                        {...resetForm.register("novaSenha")}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {resetForm.formState.errors.novaSenha && (
                      <p className="text-xs text-red-500 mt-1">
                        {resetForm.formState.errors.novaSenha.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label
                      htmlFor="confirmarSenha"
                      className="block text-[11px] font-semibold tracking-widest text-stone-500 uppercase mb-1.5"
                    >
                      Confirmar Nova Senha
                    </label>
                    <div className="relative group">
                      <input
                        id="confirmarSenha"
                        type={showConfPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Repita a nova senha"
                        className={`w-full px-4 py-3 pr-12 rounded-xl border bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition-all ${
                          passwordsMatch
                            ? "border-green-400 focus:border-green-400 focus:ring-green-500/20"
                            : "border-stone-200 focus:border-emerald-500 focus:ring-emerald-500/40"
                        }`}
                        {...resetForm.register("confirmarSenha")}
                      />
                      {passwordsMatch ? (
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center text-green-500 pointer-events-none">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowConfPassword(!showConfPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none transition-colors"
                        >
                          {showConfPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                    {resetForm.formState.errors.confirmarSenha && (
                      <p className="text-xs text-red-500 mt-1">
                        {resetForm.formState.errors.confirmarSenha.message}
                      </p>
                    )}
                  </div>

                  <button
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group mt-2"
                    type="submit"
                    disabled={resetForm.formState.isSubmitting}
                  >
                    {resetForm.formState.isSubmitting ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Redefinir Senha
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-sm text-stone-500 mt-8">
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-2 font-semibold text-stone-500 hover:text-emerald-700 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para o login
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ═══════════ STEP: DONE ═══════════ */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full text-center"
              >
                <div className="size-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>

                <h2
                  className="text-2xl sm:text-3xl font-bold text-stone-800 mb-3"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Senha redefinida!
                </h2>
                <p className="text-sm text-stone-400 mb-8 max-w-sm mx-auto leading-relaxed">
                  Sua senha foi alterada com sucesso. Agora você já pode acessar sua conta
                  novamente.
                </p>

                <Link href="/login" className="block w-full">
                  <button
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                    type="button"
                  >
                    Ir para o login
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-center gap-4 mt-12 text-[11px] text-stone-400">
            <span>Privacidade</span>
            <span className="text-stone-200">·</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Seguro
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
