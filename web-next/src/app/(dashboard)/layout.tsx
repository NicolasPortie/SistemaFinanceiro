"use client";

import { AuthGuard } from "@/components/auth-guard";
import { UpgradeModal } from "@/components/upgrade-modal";
import { UpgradePlanProvider, useUpgradePlan } from "@/components/upgrade-plan-modal";
import { useAuth } from "@/contexts/auth-context";
import { useAdminMode, AdminContextProvider } from "@/contexts/admin-context";
import { api } from "@/lib/api";
import { getInitials, getFirstName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, Moon, Sun, Shield, Crown, ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useRef, useEffect } from "react";
import { SuporteWidget } from "@/components/suporte-widget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminContextProvider>
        <UpgradePlanProvider>
          <DashboardShell>{children}</DashboardShell>
        </UpgradePlanProvider>
      </AdminContextProvider>
    </AuthGuard>
  );
}

/* ─── Nav structure ──────────────────────────────────────── */
const navGroups = [
  {
    label: "Tesouraria",
    items: [
      { label: "Lançamentos", href: "/lancamentos" },
      { label: "Contas Fixas", href: "/contas-fixas" },
      { label: "Cartões", href: "/cartoes" },
      { label: "Contas Bancárias", href: "/contas-bancarias" },
      { label: "Importar", href: "/importacao" },
    ],
    activePaths: ["/lancamentos", "/contas-fixas", "/cartoes", "/contas-bancarias", "/importacao"],
  },
  {
    label: "Performance",
    items: [
      { label: "Metas", href: "/metas" },
      { label: "Limites", href: "/limites" },
      { label: "Consultor IA", href: "/simulacao" },
    ],
    activePaths: ["/metas", "/limites", "/simulacao"],
  },
  {
    label: "Família",
    items: [
      { label: "Visão Geral", href: "/familia" },
      { label: "Dashboard Família", href: "/familia/dashboard" },
      { label: "Categorias", href: "/familia/categorias" },
      { label: "Metas da Família", href: "/familia/metas" },
      { label: "Orçamentos", href: "/familia/orcamentos" },
    ],
    activePaths: ["/familia"],
  },
  {
    label: "Conta",
    items: [
      { label: "Ravier", href: "/chat" },
      { label: "Categorias", href: "/categorias" },
      { label: "Configurações", href: "/configuracoes" },
    ],
    activePaths: ["/chat", "/categorias", "/configuracoes"],
  },
];

/* ─── Admin Nav structure ───────────────────────────────── */
const adminNavGroups = [
  {
    label: "Gestão",
    items: [
      { label: "Usuários", href: "/admin/usuarios" },
      { label: "Planos", href: "/admin/planos" },
      { label: "Convites", href: "/admin/convites" },
    ],
    activePaths: ["/admin/usuarios", "/admin/planos", "/admin/convites"],
  },
  {
    label: "Sistema",
    items: [
      { label: "Segurança", href: "/admin/seguranca" },
      { label: "WhatsApp", href: "/admin/whatsapp" },
    ],
    activePaths: ["/admin/seguranca", "/admin/whatsapp"],
  },
];

/* ─── Mobile menu items (flat) ───────────────────────────── */
const mobileItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Lançamentos", href: "/lancamentos" },
  { label: "Cartões", href: "/cartoes" },
  { label: "Contas Fixas", href: "/contas-fixas" },
  { label: "Importar", href: "/importacao" },
  { label: "Metas", href: "/metas" },
  { label: "Limites", href: "/limites" },
  { label: "Simulação", href: "/simulacao" },
  { label: "Família", href: "/familia" },
  { label: "Categorias", href: "/categorias" },
  { label: "Ravier", href: "/chat" },
];

/* ─── User dropdown component ────────────────────────────── */
function UserDropdown() {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = usuario ? getInitials(usuario.nome) : "?";
  const shortName = usuario ? getFirstName(usuario.nome) : "Usuário";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-300">
          {initials}
        </div>
        <span className="text-[10px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">
          {shortName}
        </span>
      </button>

      {open && (
        <div
          className="exec-dropdown absolute right-0 top-[calc(100%+8px)] z-50 min-w-50 rounded-2xl py-2"
          style={{ opacity: 1, visibility: "visible", transform: "none" }}
        >
          <Link
            href="/configuracoes"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-5 py-3 text-[10px] font-medium text-slate-500 hover:text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors uppercase tracking-widest"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurações
          </Link>
          <button
            onClick={() => {
              setTheme(theme === "dark" ? "light" : "dark");
            }}
            className="flex items-center gap-3 px-5 py-3 text-[10px] font-medium text-slate-500 hover:text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors uppercase tracking-widest w-full text-left"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
          </button>
          <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="flex items-center gap-3 px-5 py-3 text-[10px] font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors uppercase tracking-widest w-full text-left"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

function UpgradeNavbarButton({ mobile = false }: { mobile?: boolean }) {
  const { openUpgrade } = useUpgradePlan();
  const { data: minha } = useQuery({
    queryKey: ["assinatura-minha-navbar"],
    queryFn: () => api.assinaturas.minha(),
    staleTime: 2 * 60 * 1000,
  });

  const assinatura = minha?.assinatura;
  const isFreePlan = !assinatura || assinatura.plano === "Gratuito";

  if (!isFreePlan) return null;

  if (mobile) {
    return (
      <button
        onClick={() => openUpgrade("Individual")}
        className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-500 to-teal-500 px-4 py-3 text-left text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-105 dark:border-emerald-800"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Crown className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-50/80">
            Plano Pago
          </p>
          <p className="text-sm font-semibold leading-tight">Destrave mais recursos agora</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </button>
    );
  }

  return (
    <button
      onClick={() => openUpgrade("Individual")}
      className="hidden xl:flex items-center gap-3 rounded-full border border-emerald-200 bg-linear-to-r from-emerald-500 via-emerald-500 to-teal-500 px-4 py-2 text-white shadow-[0_10px_30px_rgba(16,185,129,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(16,185,129,0.24)] dark:border-emerald-800"
      title="Ver planos pagos"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
        <Crown className="h-4 w-4" />
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.28em] text-white">Upgrade</span>
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

/* ─── Admin mobile items (flat) ─────────────────────────── */
const adminMobileItems = [
  { label: "Painel", href: "/admin" },
  { label: "Usuários", href: "/admin/usuarios" },
  { label: "Planos", href: "/admin/planos" },
  { label: "Convites", href: "/admin/convites" },
  { label: "Segurança", href: "/admin/seguranca" },
  { label: "WhatsApp", href: "/admin/whatsapp" },
];

/* ─── Mobile Nav ─────────────────────────────────────────── */
function MobileNav({ isAdminMode }: { isAdminMode: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { usuario, logout, isAdmin } = useAuth();
  const { setAdminMode } = useAdminMode();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const items = isAdminMode ? adminMobileItems : mobileItems;
  const activeColor = isAdminMode
    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
    : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";

  const initials = usuario ? getInitials(usuario.nome) : "?";

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fechar menu de navegação" : "Abrir menu de navegação"}
        aria-expanded={open}
        aria-controls="dashboard-mobile-nav"
        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {open ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {open && (
        <div
          id="dashboard-mobile-nav"
          className="fixed inset-x-0 bottom-0 top-20 z-50 overflow-y-auto bg-white dark:bg-[#0a0e14]"
        >
          {/* User info bar */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {usuario?.nome}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{usuario?.email}</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex justify-end gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setAdminMode(!isAdminMode);
                  setOpen(false);
                }}
                className={cn(
                  "px-3 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest",
                  isAdminMode
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "border-slate-200 dark:border-slate-700 text-slate-400"
                )}
              >
                <Shield className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-colors",
                  pathname.startsWith(item.href)
                    ? activeColor
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Bottom actions */}
          <div className="px-4 pb-8 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3">
            {!isAdminMode && <UpgradeNavbarButton mobile />}
            <Link
              href="/configuracoes"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Configurações
            </Link>
            <button
              onClick={() => {
                logout();
                router.push("/login");
                setOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors w-full text-left"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Shell ─────────────────────────────────────────── */
function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const { isAdminMode, setAdminMode } = useAdminMode();
  const pathname = usePathname();

  const isDashboard = pathname === "/dashboard";
  const activeNavGroups = isAdminMode ? adminNavGroups : navGroups;
  const activeItemColor = isAdminMode
    ? "text-amber-600 bg-slate-50 dark:bg-slate-800"
    : "text-emerald-600 bg-slate-50 dark:bg-slate-800";
  const activeHoverColor = isAdminMode ? "hover:text-amber-600" : "hover:text-emerald-600";

  return (
    <div className="ivory-bg min-h-screen h-screen flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 selection:bg-emerald-100 selection:text-emerald-900">
      {/* ═══ Executive Header ═══ */}
      <header
        className={cn(
          "z-100 flex h-20 shrink-0 items-center justify-between bg-white px-6 dark:bg-[#161B22] lg:px-10",
          isAdminMode
            ? "border-b-2 border-amber-500/60"
            : "border-b border-[rgba(15,23,42,0.06)] dark:border-white/5"
        )}
      >
        {/* Left: Logo + Toggle + Nav */}
        <div className="flex items-center gap-6 lg:gap-12 h-full">
          {/* Logo */}
          <Link href="/dashboard" className="shrink-0">
            <Image
              src="/LogoRavier.png"
              alt="Ravier"
              width={100}
              height={30}
              className="object-contain dark:brightness-0 dark:invert"
              priority
              style={{ width: "auto", height: "auto" }}
            />
          </Link>

          {/* Monitor / Ravier toggle */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
            <Link
              href="/dashboard"
              className={cn(
                "px-5 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-full transition-all flex items-center gap-2",
                !pathname.startsWith("/chat")
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              Monitor
            </Link>
            <Link
              href="/chat"
              className={cn(
                "px-5 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-full transition-all flex items-center gap-2",
                pathname.startsWith("/chat")
                  ? "bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              Ravier
            </Link>
          </div>

          {/* Desktop Nav Dropdowns */}
          <nav className="hidden lg:flex items-center gap-8 ml-4 h-full">
            {isAdminMode && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap",
                  pathname === "/admin" ? "text-amber-600" : "text-slate-400 hover:text-amber-500"
                )}
              >
                <Shield className="h-3 w-3" />
                Painel
              </Link>
            )}
            {activeNavGroups.map((group) => {
              const isActive = group.activePaths.some((p) => pathname.startsWith(p));
              return (
                <div key={group.label} className="exec-nav-group relative h-full flex items-center">
                  <div className={cn("exec-nav-link", isActive && "active")}>
                    {group.label}
                    <ChevronDown className="h-3 w-3" />
                  </div>
                  <div className="exec-dropdown absolute left-0 top-[calc(100%-10px)] z-50 min-w-50 rounded-2xl py-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "block px-5 py-3 text-[10px] font-medium uppercase tracking-widest whitespace-nowrap transition-colors",
                          pathname.startsWith(item.href)
                            ? activeItemColor
                            : cn(
                                "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800",
                                activeHoverColor
                              )
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Right: User + Mobile */}
        <div className="flex items-center gap-4 lg:gap-6">
          {!isAdminMode && <UpgradeNavbarButton />}

          {/* Admin toggle — only for admins */}
          {isAdmin && (
            <button
              onClick={() => setAdminMode(!isAdminMode)}
              title={isAdminMode ? "Sair do modo admin" : "Entrar no modo admin"}
              className={cn(
                "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all cursor-pointer",
                isAdminMode
                  ? "bg-amber-500 border-amber-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)]"
                  : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-amber-400 hover:text-amber-500"
              )}
            >
              <Shield className="h-3 w-3" />
              Admin
            </button>
          )}

          {/* User pill */}
          <div className="hidden md:block">
            <UserDropdown />
          </div>

          {/* Mobile hamburger */}
          <MobileNav isAdminMode={isAdminMode} />
        </div>
      </header>

      {/* ═══ Main Content ═══ */}
      <main className="flex-1 overflow-hidden">
        {pathname === "/chat" ? (
          <div className="h-full">
            <UpgradeModal />
            {children}
          </div>
        ) : (
          <div className="h-full overflow-y-auto hide-scrollbar p-4 sm:p-6 lg:p-10">
            <div className={cn("mx-auto", isDashboard ? "max-w-full" : "max-w-7xl")}>
              <UpgradeModal />
              {children}
            </div>
          </div>
        )}
      </main>

      {/* ═══ Suporte Chatbot Widget ═══ */}
      <SuporteWidget />
    </div>
  );
}
