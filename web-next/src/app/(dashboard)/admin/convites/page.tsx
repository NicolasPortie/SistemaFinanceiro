"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminCodigoConvite } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AdminConvitesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [horasValidade, setHorasValidade] = useState(48);

  const { data: convites, isLoading } = useQuery({
    queryKey: ["admin", "convites"],
    queryFn: () => api.admin.convites.listar(),
  });

  const criar = useMutation({
    mutationFn: () =>
      api.admin.convites.criar({
        descricao: descricao || undefined,
        horasValidade,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "convites"] });
      toast.success(`Código gerado: ${data.codigo}`);
      setShowCreate(false);
      setDescricao("");
      setHorasValidade(48);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remover = useMutation({
    mutationFn: (id: number) => api.admin.convites.remover(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "convites"] });
      toast.success("Código removido");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const copiarCodigo = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success("Código copiado!");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const getStatus = (c: AdminCodigoConvite) => {
    if (c.usado) return { label: "Usado", color: "text-blue-500", bg: "bg-blue-500/10", icon: CheckCircle2 };
    if (c.expirado) return { label: "Expirado", color: "text-red-500", bg: "bg-red-500/10", icon: XCircle };
    return { label: "Ativo", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Clock };
  };

  const ativos = convites?.filter((c) => !c.usado && !c.expirado) ?? [];
  const usados = convites?.filter((c) => c.usado) ?? [];
  const expirados = convites?.filter((c) => c.expirado && !c.usado) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-teal-500" />
          Códigos de Convite
        </h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-teal-500" />
            Códigos de Convite
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {ativos.length} ativo(s) · {usados.length} usado(s) · {expirados.length} expirado(s)
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Gerar Código
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-500">{ativos.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">{usados.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Usados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{expirados.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Expirados</p>
          </CardContent>
        </Card>
      </div>

      {/* Codes List */}
      <div className="space-y-3">
        {convites?.map((c) => {
          const status = getStatus(c);
          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-lg font-mono font-bold tracking-widest">{c.codigo}</code>
                      <Badge className={`${status.bg} ${status.color} border-0 text-[10px]`}>
                        <status.icon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    {c.descricao && (
                      <p className="text-sm text-muted-foreground mt-0.5">{c.descricao}</p>
                    )}
                    <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span>Criado {formatDate(c.criadoEm)}</span>
                      <span>Expira {formatDate(c.expiraEm)}</span>
                      <span>Por: {c.criadoPorNome}</span>
                      {c.usado && c.usadoPorNome && (
                        <span className="text-blue-500">
                          Usado por: {c.usadoPorNome}
                          {c.usadoEm && ` em ${formatDate(c.usadoEm)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!c.usado && !c.expirado && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => copiarCodigo(c.codigo)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copiar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-red-600"
                      onClick={() => remover.mutate(c.id)}
                      disabled={remover.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remover
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!convites || convites.length === 0) && (
          <Card>
            <CardContent className="p-8 text-center">
              <KeyRound className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhum código de convite gerado.</p>
              <Button onClick={() => setShowCreate(true)} className="mt-3 gap-1.5">
                <Plus className="h-4 w-4" />
                Gerar Primeiro Código
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal-500" />
              Gerar Código de Convite
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Input
                id="descricao"
                placeholder="Ex: Para o João, Para teste..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horas">Validade (horas)</Label>
              <Input
                id="horas"
                type="number"
                min={1}
                max={8760}
                value={horasValidade}
                onChange={(e) => setHorasValidade(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                O código expirará em{" "}
                {horasValidade >= 24
                  ? `${Math.floor(horasValidade / 24)} dia(s) e ${horasValidade % 24} hora(s)`
                  : `${horasValidade} hora(s)`}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
