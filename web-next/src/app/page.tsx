"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  Check,
  Sparkles,
  Mic,
  Camera,
  Shield,
  Zap,
  TrendingUp,
  ChevronDown,
  Activity,
  AlertCircle,
} from "lucide-react";
import { ChatDemo } from "@/components/landing/chat-demo";
import { api, type ComparacaoPlanoDto } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// REDIRECT GUARD
// ============================================================================
function LandingRedirect() {
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) window.location.href = "/dashboard";
  }, []);
  return null;
}

// ============================================================================
// A. NAVBAR
// ============================================================================
function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-white/80 backdrop-blur-2xl shadow-lg shadow-black/[0.03] border-b border-stone-100" : "bg-transparent"}`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-12 flex items-center justify-between h-20">
        <Link href="/" className="flex items-center z-10">
          <Image
            src="/logo-text.png"
            alt="Ravier"
            width={100}
            height={30}
            className="object-contain"
            priority
          />
        </Link>

        <div className="hidden md:flex items-center gap-10 text-sm font-medium text-stone-500">
          <a href="#como-funciona" className="hover:text-stone-900 transition-colors">
            Como funciona
          </a>
          <a href="#recursos" className="hover:text-stone-900 transition-colors">
            Recursos
          </a>
          <a href="#planos" className="hover:text-stone-900 transition-colors">
            Planos
          </a>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-stone-700 transition-all hover:bg-stone-100 hover:text-stone-900"
          >
            Entrar
          </Link>
          <Link
            href="/registro"
            className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Crie sua conta
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// B. HERO — Sell the dream, not the product
// ============================================================================
function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-badge", { y: 20, opacity: 0, duration: 0.8, delay: 0.2 })
        .from(".hero-title-line", { y: 80, opacity: 0, duration: 1, stagger: 0.15 }, "-=0.5")
        .from(".hero-subtitle", { y: 30, opacity: 0, duration: 0.8 }, "-=0.5")
        .from(".hero-cta", { y: 30, opacity: 0, duration: 0.8, stagger: 0.1 }, "-=0.4")
        .from(".hero-cards-grid", { y: 40, opacity: 0, duration: 1 }, "-=0.4");
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      className="relative flex items-center pt-32 sm:pt-40 pb-20 overflow-hidden"
    >
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-white -z-10" />
      <div className="absolute top-0 right-0 w-[60%] h-[80vh] bg-gradient-to-bl from-emerald-50/50 via-transparent to-transparent -z-10 rounded-bl-[40%]" />
      <div className="absolute -top-20 right-20 size-[400px] bg-emerald-100/30 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-stone-50 to-transparent -z-10" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12">
        <div className="text-center max-w-4xl mx-auto mb-12">
          {/* Massive centered title */}
          <h1 className="hero-title-line text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05] tracking-tight text-stone-800 font-light mb-2">
            Suas finanças no
          </h1>
          <h1
            className="hero-title-line text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05] tracking-tight mb-8"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            <span className="italic font-medium text-emerald-700">piloto automático.</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle text-lg sm:text-xl md:text-2xl text-stone-500 max-w-2xl mx-auto font-light leading-relaxed mb-10">
            Grave um áudio no WhatsApp dizendo quanto gastou. Tire foto do recibo. O Ravier organiza
            tudo — e ainda te avisa antes de gastar demais.
          </p>

          {/* CTAs */}
          <div className="hero-cta flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/registro"
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-10 py-4 text-lg font-semibold shadow-xl shadow-emerald-700/20 transition-all hover:shadow-2xl hover:shadow-emerald-700/30 hover:scale-[1.02] group flex items-center gap-2"
            >
              Começar grátis
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Floating demo cards — visual proof of how the product works */}
        <div className="hero-cards-grid max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="hero-float-card bg-white rounded-2xl p-5 shadow-lg shadow-stone-200/40 border border-stone-100 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-[float_6s_ease-in-out_infinite]">
            <div className="size-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <Mic className="size-6 text-green-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Áudio recebido</p>
              <p className="text-xs text-stone-400">&quot;Gastei 80 de gasolina&quot;</p>
              <p className="text-[10px] text-green-600 font-semibold mt-1">
                ✓ Processado via WhatsApp
              </p>
            </div>
          </div>

          <div className="hero-float-card bg-white rounded-2xl p-5 shadow-lg shadow-stone-200/40 border border-stone-100 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-[float_5s_ease-in-out_infinite_0.5s]">
            <div className="size-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <TrendingUp className="size-6 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Simulação IA</p>
              <p className="text-xs text-stone-400">iPhone 15 Pro — 12x R$600</p>
              <p className="text-[10px] text-amber-600 font-semibold mt-1">⚠ Compromete 3 metas</p>
            </div>
          </div>

          <div className="hero-float-card bg-white rounded-2xl p-5 shadow-lg shadow-stone-200/40 border border-stone-100 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-[float_7s_ease-in-out_infinite_1s]">
            <div className="size-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Camera className="size-6 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">Recibo lido</p>
              <p className="text-xs text-stone-400">Supermercado — R$ 230,00</p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                ✓ Categorizado automaticamente
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-12px);
          }
        }
      `}</style>
    </section>
  );
}

// ============================================================================
// D. HOW IT WORKS — 3 dead simple steps
// ============================================================================
function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".step-card", {
        y: 80,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 70%",
        },
      });
    },
    { scope: containerRef }
  );

  const steps = [
    {
      num: "01",
      icon: <Mic className="size-7 text-emerald-700" />,
      title: "Fale ou fotografe",
      desc: 'Mande um áudio pelo WhatsApp: "gastei 80 reais de gasolina". Ou tire foto do recibo. Pronto — acabou seu trabalho.',
      detail: "WhatsApp · Telegram · App",
    },
    {
      num: "02",
      icon: <Zap className="size-7 text-emerald-700" />,
      title: "A IA organiza tudo",
      desc: "Em segundos, o Ravier entende o que você gastou, categoriza, e atualiza seu painel. Sem digitar nada.",
      detail: "Automático · Instantâneo",
    },
    {
      num: "03",
      icon: <Shield className="size-7 text-emerald-700" />,
      title: "Você fica no controle",
      desc: "Receba alertas antes de gastar demais. Simule compras futuras. Organize suas finanças sozinho ou com mais 1 pessoa.",
      detail: "Alertas · Simulações · Família",
    },
  ];

  return (
    <section id="como-funciona" ref={containerRef} className="py-16 sm:py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
        <div className="text-center mb-20">
          <p className="text-emerald-700 font-bold text-xs tracking-widest uppercase mb-4">
            Como funciona
          </p>
          <h2
            className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1a1a1a] leading-tight"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Três passos. Zero esforço.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((s) => (
            <div key={s.num} className="step-card group">
              <div className="relative bg-stone-50 rounded-[2rem] p-8 sm:p-10 border border-stone-200 hover:border-emerald-200 transition-all duration-500 hover:shadow-xl hover:shadow-emerald-100/50 h-full flex flex-col">
                {/* Step number */}
                <span
                  className="text-7xl font-black text-stone-100 absolute top-6 right-8 select-none group-hover:text-emerald-100 transition-colors"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  {s.num}
                </span>

                {/* Icon */}
                <div className="size-14 bg-white rounded-2xl flex items-center justify-center border border-stone-200 shadow-sm mb-6 group-hover:border-emerald-200 group-hover:shadow-emerald-100 transition-all">
                  {s.icon}
                </div>

                {/* Content */}
                <h3
                  className="text-xl sm:text-2xl font-bold text-stone-800 mb-4"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  {s.title}
                </h3>
                <p className="text-stone-500 leading-relaxed mb-6 flex-1">{s.desc}</p>

                {/* Tag */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    {s.detail}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// E. FEATURES — Massive Editorial Layout
// ============================================================================
function Features() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Reveal text
      gsap.utils.toArray<HTMLElement>(".reveal-text").forEach((text) => {
        gsap.from(text, {
          y: 40,
          opacity: 0,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: text,
            start: "top 85%",
          },
        });
      });
    },
    { scope: containerRef }
  );

  return (
    <section
      id="recursos"
      ref={containerRef}
      className="py-20 sm:py-28 bg-stone-50 relative overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 sm:px-12">
        <div className="text-center mb-16 sm:mb-20 reveal-text">
          <p className="text-emerald-700 font-bold text-sm tracking-[0.2em] uppercase mb-6">
            A revolução invisível
          </p>
          <h2
            className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#1a1a1a] max-w-4xl mx-auto leading-[1.1]"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Poder de processamento institucional. Simplicidade absoluta.
          </h2>
        </div>

        {/* FEATURE 1: MULTIMODAL (WhatsApp) */}
        <div className="mb-24 sm:mb-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center reveal-text">
            {/* LEFT: Text + Category Pills */}
            <div className="flex flex-col justify-center order-2 lg:order-1">
              <p className="text-emerald-700 font-bold text-sm tracking-[0.2em] uppercase mb-6">
                Entrada Multimodal
              </p>
              <h3
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-stone-900 leading-[1.05] mb-8"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                A IA lê seus recibos. <br /> Escuta seus áudios.
              </h3>
              <p className="text-xl text-stone-500 leading-relaxed mb-12 max-w-lg">
                Mande um áudio no trânsito ou a foto de uma nota fiscal. O Ravier extrai, categoriza
                e atualiza seu orçamento em tempo real. Pelo WhatsApp ou Telegram.
              </p>

              {/* Category Pills */}
              <div className="flex flex-col gap-4">
                {[
                  { icon: "🏢", name: "Combustível", value: "R$ 80,00" },
                  { icon: "🛒", name: "Mercado", value: "R$ 230,00" },
                  { icon: "🍽️", name: "Restaurante", value: "R$ 150,00" },
                  { icon: "🔧", name: "Serviços", value: "R$ 60,00" },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow"
                  >
                    <div className="size-12 bg-emerald-50 rounded-xl flex items-center justify-center text-xl border border-emerald-100/50">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase mb-0.5">
                        Ravier
                      </p>
                      <p className="text-base font-bold text-stone-800 leading-none">{item.name}</p>
                    </div>
                    <p className="text-lg font-bold text-stone-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Phone Mockup */}
            <div
              className="flex items-center justify-center order-1 lg:order-2"
              style={{ perspective: "1200px" }}
            >
              <div style={{ transformStyle: "preserve-3d" }}>
                {/* Glow Behind Phone */}
                <div className="absolute inset-0 w-full h-full bg-emerald-500/10 blur-[80px] rounded-full -z-10" />

                {/* Phone Wireframe */}
                <div
                  className="relative w-[300px] sm:w-[340px] h-[620px] sm:h-[680px] bg-white rounded-[3rem] overflow-hidden flex flex-col border-[6px] sm:border-[8px] border-stone-200 transition-transform duration-1000 ease-out"
                  style={{
                    transform: "rotateX(5deg) rotateY(-8deg) rotateZ(2deg)",
                    boxShadow: `
                      1px 1px 0px #e7e5e4,
                      2px 2px 0px #e7e5e4,
                      3px 3px 0px #e7e5e4,
                      4px 4px 0px #e7e5e4,
                      5px 5px 0px #e7e5e4,
                      6px 6px 0px #e7e5e4,
                      7px 7px 0px #e7e5e4,
                      8px 8px 0px #e7e5e4,
                      -15px 30px 50px rgba(0,0,0,0.08),
                      inset 0 0 10px rgba(0,0,0,0.02)
                    `,
                  }}
                >
                  {/* iPhone Notch */}
                  <div className="absolute top-0 inset-x-0 mx-auto w-[120px] h-[26px] bg-stone-200 rounded-b-[1.2rem] z-50 flex items-center justify-center gap-2">
                    <div className="size-1.5 rounded-full bg-stone-400" />
                    <div className="w-8 h-1 rounded-full bg-stone-400" />
                  </div>

                  {/* Header */}
                  <div className="bg-[#008069] px-4 py-3 pt-9 flex items-center gap-3 z-10 shadow-sm text-white">
                    <div className="size-9 rounded-full bg-white flex items-center justify-center text-emerald-700 font-bold text-sm shadow-sm">
                      R
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Ravier IA</h4>
                      <p className="text-[10px] text-white/80 font-medium">online</p>
                    </div>
                  </div>

                  <ChatDemo />

                  {/* Input Area */}
                  <div className="bg-[#f0f2f5] px-3 py-3 flex gap-2 items-center z-10 border-t border-stone-200">
                    <div className="flex-1 bg-white rounded-full py-2 px-4 flex items-center shadow-sm">
                      <span className="text-stone-400 text-sm">Mensagem</span>
                    </div>
                    <div className="size-10 shrink-0 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-sm cursor-pointer hover:bg-emerald-600 transition-colors">
                      <Mic className="size-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE 2: SIMULATOR */}
        <div className="mb-24 sm:mb-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center reveal-text">
            {/* LEFT: Simulator Card */}
            <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden p-8 sm:p-10 border border-stone-100 order-2 lg:order-1">
              <div className="flex items-start sm:items-center justify-between mb-8 flex-col sm:flex-row gap-4">
                <div>
                  <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] sm:text-xs mb-2">
                    Insight Engine
                  </h4>
                  <h3
                    className="text-xl sm:text-3xl font-bold text-stone-900 leading-tight"
                    style={{ fontFamily: "'Georgia', serif" }}
                  >
                    Simulação Analítica
                  </h3>
                </div>
                <div className="size-12 shrink-0 bg-stone-50 text-stone-600 rounded-full flex items-center justify-center shadow-sm border border-stone-100">
                  <Activity className="size-6 opacity-80" />
                </div>
              </div>

              <div className="mb-8 p-5 sm:p-6 rounded-2xl bg-stone-50 border border-stone-200/60">
                <p className="text-stone-500 text-[11px] font-semibold mb-2 uppercase tracking-wide">
                  Compra sob Análise:
                </p>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-stone-900">
                    Novo iPhone 16 Pro
                  </h2>
                  <div className="text-left sm:text-right">
                    <p className="text-xl sm:text-2xl font-bold text-stone-900">R$ 8.500</p>
                    <p className="text-stone-500 font-medium text-sm mt-1">12x de R$ 708,33</p>
                  </div>
                </div>
              </div>

              {/* Decision Badge */}
              <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-5 shadow-sm">
                <div className="size-14 shrink-0 bg-amber-100 rounded-full flex items-center justify-center relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-20" />
                  <AlertCircle className="size-7 text-amber-600" />
                </div>
                <div>
                  <h5 className="text-amber-800 font-bold text-lg mb-2">
                    Impacto Médio na Liquidez
                  </h5>
                  <p className="text-amber-700/80 text-sm leading-relaxed">
                    Esta aquisição comprometerá{" "}
                    <strong className="text-amber-900 font-bold">22% da sua renda livre</strong>{" "}
                    projetada nos próximos 8 meses. A meta de &quot;Viagem para Europa&quot; sofrerá
                    um atraso de <strong className="text-amber-900 font-bold">2 meses</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT: Text */}
            <div className="flex flex-col justify-center order-1 lg:order-2">
              <p className="text-emerald-700 font-bold text-sm tracking-[0.2em] uppercase mb-6">
                Motor de Simulação
              </p>
              <h3
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-stone-900 leading-[1.05] mb-8"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Não adivinhe o futuro. <br /> <span className="text-stone-400">Simule-o.</span>
              </h3>
              <p className="text-xl text-stone-500 leading-relaxed max-w-lg">
                Antes de parcelar a próxima compra, a engine de simulação do Ravier analisa seu
                fluxo de caixa dos próximos 12 meses e prevê o impacto exato no seu padrão de vida.
              </p>
            </div>
          </div>
        </div>

        {/* FEATURE 3: FAMILY */}
        <div>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center reveal-text">
            {/* LEFT: Text */}
            <div className="flex flex-col justify-center">
              <p className="text-emerald-700 font-bold text-sm tracking-[0.2em] uppercase mb-6">
                Polo Familiar
              </p>
              <h3
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-stone-900 leading-[1.05] mb-8"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Um cofre de vidro para <br /> duas pessoas.
              </h3>
              <p className="text-xl text-stone-500 leading-relaxed max-w-lg">
                Compartilhe orçamento, metas e contas com seu parceiro ou outra pessoa de confiança,
                sem misturar tudo e sem perder a autonomia de cada conta.
              </p>
            </div>

            {/* RIGHT: Family Dashboard Card */}
            <div className="relative bg-white rounded-3xl shadow-xl overflow-hidden p-8 sm:p-10 border border-stone-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                <div>
                  <h3
                    className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight"
                    style={{ fontFamily: "'Georgia', serif" }}
                  >
                    Polo Familiar
                  </h3>
                  <p className="text-emerald-700 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">
                    Transparência Integrada
                  </p>
                </div>
                <div className="flex -space-x-3">
                  <div className="size-12 rounded-full border-[3px] border-white bg-stone-100 flex items-center justify-center text-lg font-bold text-stone-600 shadow-md z-30">
                    P
                  </div>
                  <div className="size-12 rounded-full border-[3px] border-white bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-800 shadow-md z-20">
                    M
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                {/* Main Budget */}
                <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-stone-500 font-bold text-xs uppercase tracking-wider">
                      Orçamento da Casa
                    </span>
                    <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-black">
                      Saudável
                    </span>
                  </div>
                  <h4 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mb-1">
                    R$ 5.400
                  </h4>
                  <p className="text-stone-400 text-sm font-medium mb-4">Restante de R$ 9.000,00</p>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[40%] rounded-full" />
                  </div>
                </div>

                {/* Shared Contribution */}
                <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700">
                        F
                      </div>
                      <span className="text-stone-500 font-bold text-xs uppercase tracking-wider">
                        Contribuição do membro
                      </span>
                    </div>
                    <span className="text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest font-black">
                      Atualizado
                    </span>
                  </div>
                  <h4 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mb-4">
                    R$ 1.150 <span className="text-base font-bold text-stone-300">/ R$ 2.000</span>
                  </h4>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Check className="size-4 text-emerald-500" />
                        <span className="text-stone-600 text-sm font-medium">
                          Mercado compartilhado
                        </span>
                      </div>
                      <span className="text-emerald-600 font-bold text-sm">+ R$ 420</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="size-4 rounded-full border border-stone-300" />
                        <span className="text-stone-400 text-sm font-medium">Conta de luz</span>
                      </div>
                      <span className="text-stone-400 font-bold text-sm">+ R$ 180</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// G. FAQ — Real questions, real answers
// ============================================================================
function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".faq-item", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 75%",
        },
      });
    },
    { scope: containerRef }
  );

  const faqs = [
    {
      q: "Meus dados financeiros estão seguros?",
      a: "Sim. Todos os dados são protegidos com criptografia de ponta a ponta. Nenhum dado financeiro é compartilhado com terceiros. O sistema é desenvolvido seguindo as diretrizes da LGPD (Lei Geral de Proteção de Dados).",
    },
    {
      q: "Como funciona o lançamento por áudio?",
      a: "Basta enviar um áudio no WhatsApp ou Telegram dizendo, por exemplo, 'gastei 80 reais de gasolina'. A IA transcreve, identifica o valor e a categoria automaticamente, e registra no seu painel em segundos.",
    },
    {
      q: "O Ravier funciona no WhatsApp também?",
      a: "Sim! Você pode usar tanto o WhatsApp quanto o Telegram. A experiência é a mesma em ambas as plataformas — áudio, foto de recibo e texto funcionam nos dois.",
    },
    {
      q: "O que é a simulação de compras?",
      a: "Antes de parcelar uma compra, você pode pedir ao Ravier para simular o impacto no seu orçamento. Ele analisa seu fluxo de caixa dos próximos 12 meses e mostra como a compra afetaria suas metas e sua renda livre.",
    },
    {
      q: "Posso usar com outra pessoa?",
      a: "Sim. No plano 2 Pessoas, o titular pode convidar mais 1 membro. Cada conta continua independente, e vocês escolhem se querem ativar orçamento, metas e recursos compartilhados.",
    },
    {
      q: "Preciso instalar algum aplicativo?",
      a: "Não é necessário instalar nada. O Ravier funciona direto no WhatsApp/Telegram para os lançamentos, e o painel é 100% web — funciona em qualquer navegador, celular ou desktop.",
    },
    {
      q: "Posso cancelar a qualquer momento?",
      a: "Sim. Não existe fidelidade nem multa. Você pode cancelar quando quiser diretamente pelo painel, e seus dados ficam disponíveis para exportação por 30 dias após o cancelamento.",
    },
  ];

  return (
    <section ref={containerRef} className="py-24 sm:py-32 bg-stone-50">
      <div className="max-w-3xl mx-auto px-6 sm:px-12">
        <div className="text-center mb-20">
          <p className="text-emerald-700 font-bold text-sm tracking-[0.2em] uppercase mb-6">
            Dúvidas
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1a1a1a] leading-tight"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Perguntas frequentes
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="faq-item">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-6 sm:p-8 bg-stone-50 hover:bg-stone-100 rounded-2xl border border-stone-200 transition-all duration-300 text-left group"
              >
                <span className="text-lg sm:text-xl font-semibold text-stone-800 group-hover:text-stone-900">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`size-5 text-stone-400 shrink-0 transition-transform duration-300 ${openIndex === i ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${openIndex === i ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
              >
                <p className="px-6 sm:px-8 py-5 text-stone-500 leading-relaxed text-base">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// H. PRICING
// ============================================================================
const PRICING_PLAN_DESCRIPTIONS: Record<string, string> = {
  Gratuito: "Para organizar a rotina financeira e começar sem compromisso.",
  Individual: "Todas as funcionalidades do sistema para uso individual, sem ficar preso no plano grátis.",
  Familia: "Tudo do Individual, com recursos extras para organizar a vida financeira em conjunto.",
};

const PRICING_PLAN_FEATURES: Record<string, string[]> = {
  Gratuito: [
    "Base para começar a organizar a vida financeira",
    "Lançamentos e controle do dia a dia",
    "Acesso inicial ao app sem cobrança",
    "Ideal para conhecer a experiência",
    "Upgrade quando quiser destravar o restante",
  ],
  Individual: [
    "Todas as funcionalidades do sistema liberadas",
    "Consultor com IA, metas, importação e automações",
    "Chat financeiro, simulações e visão completa da operação",
    "Bots e recursos premium para rotina pessoal",
    "Plano completo para uso individual",
  ],
  Familia: [
    "Tudo que existe no plano Individual",
    "Dashboard familiar e visão compartilhada",
    "Categorias, metas e orçamentos da família",
    "Titular + 1 membro no mesmo ambiente",
    "Recursos extras para gestão financeira em conjunto",
  ],
};

function buildPricingFeatures(plano: ComparacaoPlanoDto) {
  return PRICING_PLAN_FEATURES[plano.tipo] ?? ["Plano disponível para sua operação financeira"];
}

function Pricing() {
  const { data: planos = [], isLoading, isError } = useQuery<ComparacaoPlanoDto[]>({
    queryKey: ["landing", "planos"],
    queryFn: () => api.planos.comparacao(),
    staleTime: 5 * 60 * 1000,
  });

  const orderedPlanos = [...planos]
    .filter((plano) => plano.tipo !== "Gratuito")
    .sort((a, b) => a.ordem - b.ordem);

  return (
    <section id="planos" className="py-20 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24">
        <div className="text-center mb-20">
          <p className="text-emerald-700 font-bold text-xs tracking-widest uppercase mb-4">
            Planos
          </p>
          <h2
            className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1a1a1a] mb-4"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Escolha o plano ideal pra você
          </h2>
          <p className="text-stone-500 text-lg max-w-xl mx-auto">
            Escolha o formato que combina com sua rotina e evolua no seu ritmo.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-105 animate-pulse rounded-[2rem] border border-stone-200 bg-stone-50" />
            ))}
          </div>
        ) : isError || orderedPlanos.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-stone-200 bg-stone-50 px-6 py-10 text-center text-stone-500">
            Não foi possível carregar os planos publicados no momento.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 items-stretch">
            {orderedPlanos.map((plano) => {
              const destaque = plano.destaque;
              const temPromocao = Boolean(
                plano.promocaoAtiva && plano.precoBaseMensal > plano.precoMensal
              );
              const features = buildPricingFeatures(plano);

              return (
                <div
                  key={plano.tipo}
                  className={
                    destaque
                      ? "bg-white rounded-[2rem] p-8 sm:p-12 border-2 border-emerald-700 shadow-2xl shadow-emerald-100/30 relative flex flex-col md:scale-[1.02] z-10"
                      : "bg-stone-50 rounded-[2rem] p-8 sm:p-10 border border-stone-200 flex flex-col hover:shadow-xl hover:shadow-stone-200/50 transition-all duration-300"
                  }
                >
                  {destaque && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-700 text-white font-bold uppercase tracking-widest text-[10px] px-5 py-1.5 rounded-full shadow-md">
                      Mais popular
                    </div>
                  )}

                  {plano.promocaoAtiva?.badgeTexto && (
                    <div className="mb-4 inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">
                      {plano.promocaoAtiva.badgeTexto}
                    </div>
                  )}

                  <h3
                    className={`${destaque ? "text-2xl" : "text-xl"} font-bold text-[#1a1a1a] mb-2`}
                    style={{ fontFamily: "'Georgia', serif" }}
                  >
                    {plano.nome}
                  </h3>
                  <p className="text-sm text-stone-500 mb-8">
                    {PRICING_PLAN_DESCRIPTIONS[plano.tipo] ?? "Escolha um plano para evoluir sua operação financeira."}
                  </p>
                  <div className="mb-3">
                    {temPromocao && (
                      <p className="mb-2 text-sm font-semibold text-stone-400 line-through">
                        {formatCurrency(plano.precoBaseMensal)}/mês
                      </p>
                    )}
                    <span className={`${destaque ? "text-5xl" : "text-4xl"} font-black text-[#1a1a1a]`}>
                      {plano.precoMensal === 0 ? "Grátis" : formatCurrency(plano.precoMensal)}
                    </span>
                    {plano.precoMensal > 0 && (
                      <span className={`text-xs font-bold uppercase tracking-wider ${destaque ? "text-emerald-700" : "text-stone-400"}`}>
                        /mês
                      </span>
                    )}
                  </div>

                  {(plano.trialDisponivel || temPromocao) && (
                    <div className="mb-6 rounded-2xl bg-white/80 px-4 py-3 text-sm text-stone-600 border border-stone-200/70">
                      {plano.trialDisponivel
                        ? `${plano.diasGratis} dias grátis para testar tudo`
                        : "Oferta especial disponível por tempo limitado"}
                    </div>
                  )}

                  <ul className="space-y-4 mb-10 text-sm text-stone-600 font-medium flex-1">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        {destaque ? (
                          <Sparkles className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                        )}
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/registro?plano=${plano.tipo.toLowerCase()}`}
                    className={
                      destaque
                        ? "relative block w-full overflow-hidden group rounded-xl bg-emerald-700 text-white px-8 py-4 text-center font-bold tracking-wider uppercase text-xs transition-all duration-300 shadow-lg hover:shadow-xl"
                        : "block w-full text-center py-4 rounded-xl bg-white text-stone-700 font-bold uppercase tracking-wider text-xs border border-stone-200 shadow-sm hover:bg-stone-100 hover:shadow-md transition-all"
                    }
                  >
                    <span className="relative z-10">
                      {plano.precoMensal === 0 ? "Começar grátis" : "Escolher plano"}
                    </span>
                    {destaque && (
                      <div className="absolute inset-0 bg-emerald-800 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// I. FINAL CTA
// ============================================================================
function FinalCTA() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".cta-content", {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 75%",
        },
      });
    },
    { scope: containerRef }
  );

  return (
    <section ref={containerRef} className="py-32 bg-stone-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(4,120,87,0.06)_0%,transparent_60%)]" />
      <div className="cta-content relative z-10 max-w-3xl mx-auto text-center px-6">
        <h2
          className="text-3xl sm:text-5xl font-bold text-[#1a1a1a] mb-6 leading-tight"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          Pronto pra parar de se preocupar com dinheiro?
        </h2>
        <p className="text-lg text-stone-500 mb-10 max-w-xl mx-auto">
          Crie sua conta em 30 segundos. Conecte seu WhatsApp. E deixe a inteligência artificial
          cuidar do resto.
        </p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-10 py-5 text-lg font-semibold shadow-xl shadow-emerald-700/20 transition-all hover:shadow-2xl hover:scale-[1.02] group"
        >
          Começar grátis agora
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Link>
        <p className="text-xs text-stone-400 mt-4">Sem cartão de crédito. Cancele quando quiser.</p>
      </div>
    </section>
  );
}

// ============================================================================
// J. FOOTER
// ============================================================================
function Footer() {
  return (
    <footer className="bg-stone-900 pt-16 pb-8 px-6 sm:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-8 mb-12 pb-12 border-b border-stone-800">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Image
              src="/logo-text.png"
              alt="Ravier"
              width={100}
              height={30}
              className="object-contain brightness-0 invert opacity-90 mb-5"
            />
            <p className="text-stone-400 text-sm leading-relaxed mb-6">
              Controle financeiro inteligente pelo WhatsApp e Telegram. Para pessoas e famílias.
            </p>
            <a
              href="mailto:contato@ravier.com.br"
              className="text-emerald-400 text-sm font-medium hover:text-emerald-300 transition-colors"
            >
              contato@ravier.com.br
            </a>
          </div>

          {/* Produto */}
          <div>
            <h4 className="text-white font-bold tracking-widest text-xs uppercase mb-5">Produto</h4>
            <ul className="space-y-3 text-sm text-stone-400 font-medium">
              <li>
                <a href="#como-funciona" className="hover:text-emerald-400 transition-colors">
                  Como funciona
                </a>
              </li>
              <li>
                <a href="#recursos" className="hover:text-emerald-400 transition-colors">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#planos" className="hover:text-emerald-400 transition-colors">
                  Planos e preços
                </a>
              </li>
            </ul>
          </div>

          {/* Conta */}
          <div>
            <h4 className="text-white font-bold tracking-widest text-xs uppercase mb-5">Conta</h4>
            <ul className="space-y-3 text-sm text-stone-400 font-medium">
              <li>
                <Link href="/login" className="hover:text-emerald-400 transition-colors">
                  Entrar
                </Link>
              </li>
              <li>
                <Link href="/registro" className="hover:text-emerald-400 transition-colors">
                  Criar conta grátis
                </Link>
              </li>
              <li>
                <Link href="/recuperar-senha" className="hover:text-emerald-400 transition-colors">
                  Recuperar senha
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-bold tracking-widest text-xs uppercase mb-5">Legal</h4>
            <ul className="space-y-3 text-sm text-stone-400 font-medium">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Termos de Serviço
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Política de Privacidade
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="text-center text-xs text-stone-600 font-medium">
          &copy; {new Date().getFullYear()} Ravier. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function LandingPage() {
  return (
    <div className="font-sans antialiased bg-white selection:bg-emerald-700/20 selection:text-emerald-900">
      <LandingRedirect />
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
