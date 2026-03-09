import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Ravier — Suas finanças no piloto automático",
    template: "%s | Ravier",
  },
  description:
    "Mande um áudio no WhatsApp dizendo quanto gastou. Tire foto do recibo. O Ravier organiza tudo com IA — e ainda te avisa antes de gastar demais.",
  keywords: [
    "controle financeiro",
    "finanças pessoais",
    "orçamento familiar",
    "metas financeiras",
    "WhatsApp",
    "inteligência artificial",
    "simulação de compras",
    "gestão financeira",
  ],
  authors: [{ name: "Ravier" }],
  openGraph: {
    title: "Ravier — Suas finanças no piloto automático",
    description:
      "Grave um áudio, tire foto do recibo ou mande um texto. A IA do Ravier organiza tudo pelo WhatsApp e Telegram.",
    type: "website",
    siteName: "Ravier",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ravier — Suas finanças no piloto automático",
    description:
      "Controle financeiro inteligente pelo WhatsApp. Áudio, foto de recibo e texto — a IA cuida do resto.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ravier",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#10b981" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body className={`${plusJakarta.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable} bg-background text-foreground font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
