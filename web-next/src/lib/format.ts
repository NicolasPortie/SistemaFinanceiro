export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonth(dateString: string): string {
  const mesAno = /^(\d{1,2})\/(\d{4})$/.exec(dateString.trim());
  if (mesAno) {
    const month = Number(mesAno[1]);
    const year = Number(mesAno[2]);
    const parsed = new Date(Date.UTC(year, month - 1, 1));
    return parsed.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
  }

  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function getFirstName(fullName: string): string {
  return fullName.split(" ")[0];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatFormaPagamento(forma: string): string {
  switch (forma?.toLowerCase()) {
    case "pix":
      return "PIX";
    case "debito":
      return "Débito";
    case "credito":
      return "Crédito";
    default:
      return forma || "—";
  }
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) return "Boa madrugada";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function riskColor(risk: string) {
  switch (risk.toLowerCase()) {
    case "baixo":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        text: "text-emerald-700 dark:text-emerald-400",
        border: "border-emerald-200 dark:border-emerald-800",
        badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
      };
    case "medio":
    case "médio":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
      };
    case "alto":
      return {
        bg: "bg-red-50 dark:bg-red-950/30",
        text: "text-red-700 dark:text-red-400",
        border: "border-red-200 dark:border-red-800",
        badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
      };
    default:
      return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        border: "border-border",
        badge: "bg-muted text-muted-foreground",
      };
  }
}

export function statusColor(status: string) {
  switch (status) {
    case "ok":
      return {
        bg: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-400",
        badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
      };
    case "atencao":
      return {
        bg: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-400",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
      };
    case "critico":
      return {
        bg: "bg-red-500",
        text: "text-red-700 dark:text-red-400",
        badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
      };
    case "excedido":
      return {
        bg: "bg-red-600",
        text: "text-red-800 dark:text-red-300",
        badge: "bg-red-200 text-red-900 dark:bg-red-900/70 dark:text-red-200",
      };
    default:
      return {
        bg: "bg-muted-foreground",
        text: "text-muted-foreground",
        badge: "bg-muted text-muted-foreground",
      };
  }
}
