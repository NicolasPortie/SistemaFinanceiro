"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * A página /assinatura foi substituída pelo modal de upgrad.
 * Redireciona para /configuracoes (seção assinatura).
 */
export default function AssinaturaRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/configuracoes");
  }, [router]);

  return null;
}
