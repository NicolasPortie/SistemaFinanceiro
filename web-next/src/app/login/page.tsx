"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { formatPhoneInput, hasValidPhoneDigits } from "@/lib/phone";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginData } from "@/lib/schemas";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Mic,
  Camera,
  TrendingUp,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { AppleLoginButton } from "@/components/auth/apple-login-button";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [isLocalEnv, setIsLocalEnv] = useState(false);
  const [socialTokenToComplete, setSocialTokenToComplete] = useState<{
    provider: "google" | "apple";
    token: string;
    nome?: string;
  } | null>(null);
  const [celularCompletar, setCelularCompletar] = useState("");
  const { login, loginComGoogle, loginComApple, usuario } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (usuario) router.replace("/dashboard");
  }, [usuario, router]);

  useEffect(() => {
    setIsLocalEnv(["localhost", "127.0.0.1"].includes(window.location.hostname));
  }, []);

  if (usuario) return null;

  const onSubmit = async (data: LoginData) => {
    setAuthError(null);
    try {
      await login(data.email, data.senha);
      toast.success("Login realizado com sucesso!");
      router.replace("/dashboard");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Erro ao fazer login");
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
          <Image
            src="/logo-text.png"
            alt="Ravier"
            width={100}
            height={30}
            className="object-contain"
            style={{ width: "auto", height: "auto" }}
          />
        </div>

        {/* Headline */}
        <div className="relative z-10 max-w-lg">
          <h1
            className="text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight text-stone-800 mb-6"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Suas finanças no <span className="italic text-emerald-700">piloto automático.</span>
          </h1>
          <p className="text-stone-500 text-lg leading-relaxed max-w-md">
            Grave um áudio, tire foto do recibo ou mande um texto. O Ravier cuida do resto.
          </p>

          {/* Feature pills */}
          <div className="flex items-center gap-3 mt-8">
            {[
              { icon: <Mic className="size-3.5" />, label: "Áudio" },
              { icon: <Camera className="size-3.5" />, label: "Foto" },
              { icon: <TrendingUp className="size-3.5" />, label: "Simulações" },
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
              <Mic className="size-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Áudio processado</p>
              <p className="text-[11px] text-stone-400">&quot;Gastei 80 de gasolina&quot;</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 shadow-md shadow-stone-200/50 border border-stone-100 animate-[float_5s_ease-in-out_infinite_0.5s]">
            <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="size-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Meta: 78%</p>
              <p className="text-[11px] text-emerald-600 font-semibold">Reserva de emergência</p>
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
          <div className="lg:hidden mb-10">
            <Image
              src="/logo-text.png"
              alt="Ravier"
              width={100}
              height={30}
              className="object-contain"
              style={{ width: "auto", height: "auto" }}
            />
          </div>

          {/* Heading */}
          <h2
            className="text-2xl sm:text-3xl font-bold text-stone-800 mb-2"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Acesse sua conta
          </h2>
          <p className="text-sm text-stone-400 mb-8">Entre para acessar sua conta.</p>

          <div className="mb-6">
            <GoogleLoginButton
              text="signin_with"
              onSuccess={async (credential) => {
                try {
                  await loginComGoogle(credential);
                  toast.success("Login com Google realizado com sucesso!");
                  router.replace("/dashboard");
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "";
                  if (
                    msg.includes("Cadastro incompleto") ||
                    msg.includes("celular é obrigatório")
                  ) {
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
                text="signin"
                onSuccess={async (idToken, nome) => {
                  try {
                    await loginComApple(idToken, undefined, nome);
                    toast.success("Login com Apple realizado com sucesso!");
                    router.replace("/dashboard");
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "";
                    if (
                      msg.includes("Cadastro incompleto") ||
                      msg.includes("celular é obrigatório")
                    ) {
                      setSocialTokenToComplete({ provider: "apple", token: idToken, nome });
                    } else {
                      toast.error(msg || "Erro ao entrar com Apple");
                    }
                  }
                }}
                onError={() => toast.error("Erro ao autenticar com a Apple")}
              />
            </div>

            {isLocalEnv && (
              <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
                Em localhost, login social depende de origens autorizadas no provedor.
              </p>
            )}

            <div className="relative mt-6 mb-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                <span className="bg-white px-3 text-stone-400">Ou use seu e-mail</span>
              </div>
            </div>
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
                      Sua conta é nova. Precisamos do seu celular (WhatsApp/Telegram) para enviar
                      alertas de orçamento e garantir suporte via assistente IA.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSocialError(null);
                    if (!hasValidPhoneDigits(celularCompletar)) {
                      setSocialError("Informe um celular válido com DDD.");
                      return;
                    }
                    try {
                      if (socialTokenToComplete.provider === "google") {
                        await loginComGoogle(socialTokenToComplete.token, celularCompletar);
                      } else {
                        await loginComApple(
                          socialTokenToComplete.token,
                          celularCompletar,
                          socialTokenToComplete.nome
                        );
                      }
                      toast.success("Conta criada com sucesso!");
                      router.replace("/dashboard");
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Erro ao finalizar cadastro"
                      );
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="celularCompletar"
                      className="block text-[11px] font-semibold tracking-widest text-stone-500 uppercase mb-1.5"
                    >
                      Celular{" "}
                      <span className="text-stone-400 font-normal lowercase">
                        (WhatsApp/Telegram)
                      </span>
                    </label>
                    <Input
                      id="celularCompletar"
                      type="tel"
                      value={celularCompletar}
                      aria-invalid={Boolean(socialError)}
                      aria-describedby={socialError ? "login-social-error" : undefined}
                      onChange={(e) => {
                        setSocialError(null);
                        setCelularCompletar(formatPhoneInput(e.target.value));
                      }}
                      placeholder="(11) 99999-9999"
                      className="bg-stone-50 border-stone-200 h-11 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 rounded-xl"
                      autoFocus
                    />
                    {socialError && (
                      <p id="login-social-error" role="alert" className="mt-1 text-xs text-red-500">
                        {socialError}
                      </p>
                    )}
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
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full"
              >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                      aria-invalid={Boolean(errors.email || authError)}
                      aria-describedby={authError ? "login-auth-error" : undefined}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                      {...register("email", {
                        onChange: () => setAuthError(null),
                      })}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label
                        htmlFor="senha"
                        className="text-[11px] font-semibold tracking-widest text-stone-500 uppercase"
                      >
                        Senha
                      </label>
                      <Link
                        href="/recuperar-senha"
                        className="text-[11px] font-semibold tracking-widest text-emerald-700 uppercase hover:text-emerald-800 transition-colors"
                      >
                        Esqueci a senha
                      </Link>
                    </div>
                    <div className="relative group">
                      <input
                        id="senha"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-12 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                        aria-invalid={Boolean(errors.senha || authError)}
                        aria-describedby={authError ? "login-auth-error" : undefined}
                        {...register("senha", {
                          onChange: () => setAuthError(null),
                        })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none transition-colors"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.senha && (
                      <p className="text-xs text-red-500 mt-1">{errors.senha.message}</p>
                    )}
                  </div>

                  {authError && (
                    <div
                      id="login-auth-error"
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      {authError}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider uppercase text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        Entrar
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sign up link */}
          <p className="text-center text-sm text-stone-500 mt-8">
            Ainda não tem uma conta?{" "}
            <Link
              href="/registro"
              className="font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              Crie sua conta
            </Link>
          </p>

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
