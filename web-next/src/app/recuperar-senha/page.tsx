"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  ArrowLeft,
  KeyRound,
  Loader2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Step = "email" | "code" | "done";

export default function RecuperarSenhaPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailForm = useForm<RecuperarSenhaData>({
    resolver: zodResolver(recuperarSenhaSchema),
    defaultValues: { email: "" },
  });

  const codeForm = useForm<RedefinirSenhaData>({
    resolver: zodResolver(redefinirSenhaSchema),
    defaultValues: { email: "", codigo: "", novaSenha: "", confirmarSenha: "" },
  });

  const onSolicitarCodigo = async (data: RecuperarSenhaData) => {
    setLoading(true);
    try {
      await api.auth.recuperarSenha({ email: data.email });
      setEmail(data.email);
      codeForm.setValue("email", data.email);
      setStep("code");
      toast.success("Código enviado! Verifique seu e-mail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao solicitar recuperação");
    } finally {
      setLoading(false);
    }
  };

  const onRedefinirSenha = async (data: RedefinirSenhaData) => {
    setLoading(true);
    try {
      await api.auth.redefinirSenha({
        email: data.email,
        codigo: data.codigo,
        novaSenha: data.novaSenha,
      });
      setStep("done");
      toast.success("Senha redefinida com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código inválido ou expirado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-svh">
      {/* Left Panel — Decorative */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold">ControlFinance</span>
          </div>

          <div className="space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-bold leading-tight">
              Recuperação<br />de senha
            </h2>
            <p className="text-lg text-white/70 max-w-sm">
              Não se preocupe! Vamos te ajudar a recuperar o acesso à sua conta de forma segura.
            </p>
          </div>

          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} ControlFinance. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-100 space-y-8"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-emerald-500/25">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">
              Control<span className="text-primary">Finance</span>
            </span>
          </div>

          <AnimatePresence mode="wait">
            {step === "email" && (
              <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Esqueceu a senha?</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Informe seu e-mail para receber o código de recuperação
                  </p>
                </div>

                <form onSubmit={emailForm.handleSubmit(onSolicitarCodigo)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10 h-11"
                        {...emailForm.register("email")}
                      />
                    </div>
                    {emailForm.formState.errors.email && <p className="text-xs text-red-500">{emailForm.formState.errors.email.message}</p>}
                  </div>

                  <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4" />Enviar código</>}
                  </Button>
                </form>

                <Link href="/login" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para o login
                </Link>
              </motion.div>
            )}

            {step === "code" && (
              <motion.div key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Redefinir senha</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Informe o código recebido e sua nova senha
                  </p>
                  <div className="mt-3 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
                    <p className="text-xs text-primary">Código enviado para <strong>{email}</strong></p>
                  </div>
                </div>

                <form onSubmit={codeForm.handleSubmit(onRedefinirSenha)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código de verificação</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="codigo"
                        placeholder="000000"
                        className="pl-10 h-11 text-center text-lg tracking-[0.5em] font-mono"
                        maxLength={6}
                        {...codeForm.register("codigo")}
                      />
                    </div>
                    {codeForm.formState.errors.codigo && <p className="text-xs text-red-500">{codeForm.formState.errors.codigo.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="novaSenha">Nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="novaSenha"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-11"
                        {...codeForm.register("novaSenha")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {codeForm.formState.errors.novaSenha && <p className="text-xs text-red-500">{codeForm.formState.errors.novaSenha.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmarSenha"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 h-11"
                        {...codeForm.register("confirmarSenha")}
                      />
                    </div>
                    {codeForm.formState.errors.confirmarSenha && <p className="text-xs text-red-500">{codeForm.formState.errors.confirmarSenha.message}</p>}
                  </div>

                  <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" />Redefinir senha</>}
                  </Button>
                </form>

                <button onClick={() => setStep("email")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>
              </motion.div>
            )}

            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Senha redefinida!</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Sua senha foi alterada com sucesso. Agora você pode fazer login com a nova senha.
                  </p>
                </div>
                <Button className="w-full h-11 font-semibold" onClick={() => router.push("/login")}>
                  Ir para o login
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
