"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Mail, Timer, Users, XCircle } from "lucide-react";

import { api, type ConviteFamilia } from "@/lib/api";
import { formatShortDate } from "@/lib/format";
import { queryKeys, useAceitarConviteFamilia, useRecusarConviteFamilia } from "@/hooks/use-queries";
import {
  FamilyHero,
  FamilyPanel,
  FamilyPrimaryAction,
  FamilyShell,
} from "@/components/familia/family-layout";
import { Button } from "@/components/ui/button";

export default function ConviteTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const aceitar = useAceitarConviteFamilia();
  const recusar = useRecusarConviteFamilia();
  const [resultado, setResultado] = useState<"aceito" | "recusado" | null>(null);

  const {
    data: convite,
    isLoading,
    isError,
    error,
  } = useQuery<ConviteFamilia>({
    queryKey: queryKeys.familiaConvite(token),
    queryFn: () => api.familia.obterConvite(token),
    retry: false,
  });

  const expirado = convite ? new Date(convite.expiraEm) < new Date() : false;
  const podeAceitar = convite?.status === "Pendente" && !expirado;

  const handleAceitar = () => {
    aceitar.mutate(token, {
      onSuccess: () => {
        setResultado("aceito");
        setTimeout(() => router.push("/familia"), 2000);
      },
    });
  };

  const handleRecusar = () => {
    recusar.mutate(token, {
      onSuccess: () => setResultado("recusado"),
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <FamilyShell>
        <FamilyHero
          icon={<Users className="h-6 w-6" />}
          title="Convite Familiar"
          description="Revise os dados do convite e decida se deseja entrar na estrutura compartilhada da família."
          eyebrow="Entrada no Plano"
          tone="emerald"
        />

        <FamilyPanel
          title="Status do convite"
          description="O token permanece válido até a data de expiração exibida abaixo."
          icon={<Mail className="h-5 w-5" />}
          tone="slate"
          className="mx-auto w-full max-w-2xl"
        >
          {isLoading ? (
            <CenteredState
              icon={<Loader2 className="h-8 w-8 animate-spin text-emerald-600" />}
              title="Carregando convite"
              description="Validando o token e buscando os dados do titular."
            />
          ) : isError ? (
            <CenteredState
              icon={<AlertTriangle className="h-8 w-8 text-red-500" />}
              title="Convite não encontrado"
              description={
                (error as Error)?.message ||
                "Esse convite pode ter expirado ou já ter sido utilizado."
              }
              action={
                <Button variant="outline" onClick={() => router.push("/dashboard")}>
                  Ir para dashboard
                </Button>
              }
            />
          ) : resultado === "aceito" ? (
            <CenteredState
              icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
              title="Bem-vindo à família"
              description="Tudo certo. Você será redirecionado em instantes para a área compartilhada."
            />
          ) : resultado === "recusado" ? (
            <CenteredState
              icon={<XCircle className="h-8 w-8 text-slate-400" />}
              title="Convite recusado"
              description="O convite foi recusado. Sua conta continua operando normalmente."
              action={
                <Button variant="outline" onClick={() => router.push("/dashboard")}>
                  Ir para dashboard
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <InfoCard
                icon={<Users className="h-4 w-4" />}
                label="Titular"
                value={convite?.titularNome ?? "Não informado"}
              />
              <InfoCard
                icon={<Mail className="h-4 w-4" />}
                label="Enviado para"
                value={convite?.email ?? "—"}
              />
              <InfoCard
                icon={<Timer className="h-4 w-4" />}
                label="Expira em"
                value={convite ? formatShortDate(convite.expiraEm) : "—"}
              />

              {expirado && (
                <StatusBanner
                  icon={<AlertTriangle className="h-4 w-4" />}
                  tone="red"
                  message="Este convite já expirou."
                />
              )}

              {convite?.status !== "Pendente" && !expirado && (
                <StatusBanner
                  icon={<AlertTriangle className="h-4 w-4" />}
                  tone="amber"
                  message={`Este convite já foi ${convite?.status?.toLowerCase()}.`}
                />
              )}

              {podeAceitar ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    className="h-12 flex-1"
                    onClick={handleRecusar}
                    disabled={recusar.isPending || aceitar.isPending}
                  >
                    {recusar.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Recusar
                  </Button>
                  <FamilyPrimaryAction
                    className="h-12 flex-1"
                    onClick={handleAceitar}
                    disabled={aceitar.isPending || recusar.isPending}
                  >
                    {aceitar.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Aceitar convite
                  </FamilyPrimaryAction>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="h-12 w-full"
                  onClick={() => router.push("/dashboard")}
                >
                  Ir para dashboard
                </Button>
              )}
            </div>
          )}
        </FamilyPanel>
      </FamilyShell>
    </div>
  );
}

function CenteredState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/8 dark:bg-slate-900/35">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
        {icon}
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function StatusBanner({
  icon,
  tone,
  message,
}: {
  icon: React.ReactNode;
  tone: "red" | "amber";
  message: string;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/15 dark:bg-red-500/10 dark:text-red-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/15 dark:bg-amber-500/10 dark:text-amber-300";

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${toneClass}`}
    >
      {icon}
      <span>{message}</span>
    </div>
  );
}
