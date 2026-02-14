"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registroSchema, type RegistroData } from "@/lib/schemas";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const passwordRules = [
  { label: "Mínimo 8 caracteres", test: (s: string) => s.length >= 8 },
  { label: "Letra maiúscula", test: (s: string) => /[A-Z]/.test(s) },
  { label: "Letra minúscula", test: (s: string) => /[a-z]/.test(s) },
  { label: "Um número", test: (s: string) => /\d/.test(s) },
];

export default function RegistroPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { registrar, usuario } = useAuth();
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

  const senha = useWatch({ control, name: "senha" });
  const passedRules = useMemo(
    () => passwordRules.map((r) => ({ ...r, passed: r.test(senha || "") })),
    [senha]
  );
  const allPassed = passedRules.every((r) => r.passed);
  const strength = passedRules.filter((r) => r.passed).length;

  if (usuario) {
    router.replace("/dashboard");
    return null;
  }

  const onSubmit = async (data: RegistroData) => {
    if (!allPassed) return;
    try {
      await registrar(data.nome, data.email, data.senha, data.codigoConvite);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar conta");
    }
  };

  const renderField = (
    id: string,
    label: string,
    icon: React.ReactNode,
    inputProps: React.InputHTMLAttributes<HTMLInputElement>,
    error?: string,
    rightElement?: React.ReactNode
  ) => (
    <div className="space-y-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-foreground/80 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={`relative rounded-xl border transition-all duration-200 ${
          focusedField === id
            ? "border-emerald-500/50 ring-[3px] ring-emerald-500/10 dark:ring-emerald-400/10"
            : error
              ? "border-red-400/50"
              : "border-border hover:border-border/80"
        }`}
      >
        <div
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
            focusedField === id ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground/50"
          }`}
        >
          {icon}
        </div>
        <Input
          id={id}
          className={`pl-11 ${rightElement ? "pr-11" : ""} h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/40`}
          onFocus={() => setFocusedField(id)}
          onBlur={() => setFocusedField(null)}
          {...inputProps}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 pl-1">{error}</p>}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#fafbfc] dark:bg-[#0a0b0f]">
      {/* ─── Painel Esquerdo ─── */}
      <div className="hidden lg:flex lg:w-130 xl:w-145 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-emerald-950 via-teal-900 to-cyan-950" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="absolute top-0 right-0 w-100 h-100 bg-linear-to-bl from-emerald-400/10 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-75 h-75 bg-linear-to-tr from-cyan-400/8 to-transparent rounded-tr-full" />

        <div className="absolute top-[20%] right-12 w-px h-32 bg-linear-to-b from-transparent via-emerald-400/30 to-transparent" />
        <div className="absolute bottom-[25%] left-16 w-24 h-px bg-linear-to-r from-transparent via-teal-400/30 to-transparent" />

        <div className="relative flex flex-col justify-between p-10 xl:p-12 text-white w-full z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
              <TrendingUp className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight leading-none">ControlFinance</span>
              <span className="text-[10px] text-emerald-300/60 font-medium tracking-widest uppercase">Financial Platform</span>
            </div>
          </div>

          {/* Centro */}
          <div className="space-y-10 -mt-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 mb-6">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span className="text-xs text-emerald-300 font-medium">Acesso por convite</span>
              </div>

              <h2 className="text-[2rem] xl:text-[2.25rem] font-bold leading-[1.15] tracking-tight">
                Comece sua jornada
                <br />
                <span className="bg-linear-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                  financeira hoje.
                </span>
              </h2>
              <p className="mt-4 text-[15px] text-white/50 leading-relaxed max-w-sm">
                Plataforma exclusiva com acesso por convite. Use o código que você
                recebeu para criar sua conta.
              </p>
            </motion.div>

            {/* O que você terá */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl bg-white/4 border border-white/6 p-5 space-y-3.5"
            >
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">O que você terá acesso</p>
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
                  className="flex items-center gap-3 text-sm"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10">
                    <item.icon className="h-3.5 w-3.5 text-emerald-400/70" />
                  </div>
                  <span className="text-white/60 text-[13px]">{item.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>

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

      {/* ─── Painel Direito - Formulário ─── */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-125 h-125 rounded-full bg-emerald-500/2 dark:bg-emerald-500/3 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-100 h-100 rounded-full bg-teal-500/2 dark:bg-teal-500/3 blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-105 relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Control<span className="text-emerald-600 dark:text-emerald-400">Finance</span>
            </span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[1.75rem] font-bold tracking-tight text-foreground">Criar conta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Preencha os dados e informe seu código de convite
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Código de Convite — destaque especial */}
            <div className="space-y-2">
              <label htmlFor="codigoConvite" className="text-[13px] font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-emerald-500" />
                Código de convite
              </label>
              <div
                className={`relative rounded-xl border transition-all duration-200 ${
                  focusedField === "codigoConvite"
                    ? "border-emerald-500/50 ring-[3px] ring-emerald-500/10 dark:ring-emerald-400/10"
                    : errors.codigoConvite
                      ? "border-red-400/50"
                      : "border-emerald-500/20 dark:border-emerald-400/15 bg-emerald-500/2 dark:bg-emerald-400/2"
                }`}
              >
                <ShieldCheck
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 transition-colors ${
                    focusedField === "codigoConvite" ? "text-emerald-500 dark:text-emerald-400" : "text-emerald-500/50 dark:text-emerald-400/50"
                  }`}
                />
                <Input
                  id="codigoConvite"
                  placeholder="Insira o código recebido"
                  className="pl-11 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/40 font-mono tracking-wider uppercase"
                  autoComplete="off"
                  {...register("codigoConvite")}
                  onFocus={() => setFocusedField("codigoConvite")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              {errors.codigoConvite && (
                <p className="text-xs text-red-500 pl-1">{errors.codigoConvite.message}</p>
              )}
              <p className="text-[11px] text-muted-foreground/50 pl-1">
                Código fornecido pelo administrador da plataforma
              </p>
            </div>

            {/* Separador visual */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-border to-transparent" />
              <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-medium">Dados pessoais</span>
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-border to-transparent" />
            </div>

            {/* Nome */}
            {renderField(
              "nome",
              "Nome completo",
              <User className="h-4.5 w-4.5" />,
              { placeholder: "Seu nome completo", autoComplete: "name", ...register("nome") },
              errors.nome?.message
            )}

            {/* Email */}
            {renderField(
              "email",
              "E-mail",
              <Mail className="h-4.5 w-4.5" />,
              { type: "email", placeholder: "nome@exemplo.com", autoComplete: "email", ...register("email") },
              errors.email?.message
            )}

            {/* Senha */}
            <div className="space-y-2">
              <label htmlFor="senha" className="text-[13px] font-semibold text-foreground/80 uppercase tracking-wider">
                Senha
              </label>
              <div
                className={`relative rounded-xl border transition-all duration-200 ${
                  focusedField === "senha"
                    ? "border-emerald-500/50 ring-[3px] ring-emerald-500/10 dark:ring-emerald-400/10"
                    : errors.senha
                      ? "border-red-400/50"
                      : "border-border hover:border-border/80"
                }`}
              >
                <Lock
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 transition-colors ${
                    focusedField === "senha" ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground/50"
                  }`}
                />
                <Input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-11 pr-11 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/40"
                  autoComplete="new-password"
                  {...register("senha")}
                  onFocus={() => setFocusedField("senha")}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password strength indicator */}
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
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            strength >= level
                              ? strength <= 2
                                ? "bg-red-400"
                                : strength === 3
                                  ? "bg-amber-400"
                                  : "bg-emerald-500"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {passedRules.map((rule) => (
                        <div
                          key={rule.label}
                          className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                            rule.passed
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground/50"
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
            </div>

            {/* Submit */}
            <div className="pt-1">
              <Button
                type="submit"
                className="w-full h-12 text-[15px] font-semibold rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-500/25 transition-all duration-300 border-0 gap-2"
                disabled={isSubmitting || !allPassed}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Criar conta
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Divider */}
          <div className="my-7 flex items-center gap-4">
            <div className="flex-1 h-px bg-linear-to-r from-transparent via-border to-transparent" />
            <span className="text-xs text-muted-foreground/60 font-medium">Já tem conta?</span>
            <div className="flex-1 h-px bg-linear-to-r from-transparent via-border to-transparent" />
          </div>

          <Link href="/login" className="block">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl text-sm font-medium border-border/60 hover:border-emerald-500/30 hover:bg-emerald-500/3 transition-all duration-200"
            >
              Fazer login
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
