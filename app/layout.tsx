import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://financepro.app"),
  title: {
    default: "FinancePro",
    template: "%s | FinancePro",
  },
  description:
    "Controle contas, cartões, lançamentos, metas, orçamento e relatórios em um só lugar.",
  applicationName: "FinancePro",
  keywords: [
    "finanças",
    "controle financeiro",
    "orçamento",
    "metas financeiras",
    "cartões",
    "contas",
    "dashboard financeiro",
  ],
  authors: [{ name: "FinancePro" }],
  creator: "FinancePro",
  openGraph: {
    title: "FinancePro",
    description:
      "Controle contas, cartões, lançamentos, metas, orçamento e relatórios em um só lugar.",
    siteName: "FinancePro",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinancePro",
    description:
      "Controle contas, cartões, lançamentos, metas, orçamento e relatórios em um só lugar.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#0a0a0a] text-white antialiased`}
      >
        {children}
      </body>
    </html>
  );
}