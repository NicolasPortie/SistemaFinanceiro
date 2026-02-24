"use client";

import { AdminGuard } from "@/components/admin-guard";
import { AdminModeProvider } from "@/components/admin-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminModeProvider>{children}</AdminModeProvider>
    </AdminGuard>
  );
}
