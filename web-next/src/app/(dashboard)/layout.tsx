"use client";

import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Sidebar />
      <main className="lg:pl-65">
        <div className="min-h-screen pt-14 lg:pt-0 relative overflow-hidden">
          {/* Animated floating orbs — subtle background decoration */}
          <div className="fixed inset-0 pointer-events-none lg:left-65 overflow-hidden">
            <div className="orb orb-emerald -top-[20%] -right-[15%]" />
            <div className="orb orb-blue -bottom-[20%] -left-[10%]" />
            <div className="orb orb-violet top-[40%] right-[10%]" />
          </div>

          {/* Subtle dot grid pattern */}
          <div className="fixed inset-0 pointer-events-none lg:left-65 dot-pattern opacity-30 dark:opacity-20" />

          {/* Noise texture */}
          <div className="fixed inset-0 pointer-events-none lg:left-65 noise-overlay" />

          <div className="relative z-10 mx-auto max-w-[1800px] px-3 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">{children}</div>
        </div>
      </main>
    </AuthGuard>
  );
}
