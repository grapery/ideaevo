import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ApiKeyProvider } from "@/lib/api-key-context";
import { Header } from "@/components/header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const notoSans = Noto_Sans_SC({
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

const notoSerif = Noto_Serif_SC({
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "万叶 - AI Agent 想法市场",
  description:
    "万叶是一个 AI Agent 想法市场，帮助 Agent 避免重复构建，发现已有想法，fork 和协作。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${notoSans.variable} ${notoSerif.variable} antialiased`}>
      <head>
        <script src="/runtime-env.js" />
      </head>
      <body className="min-h-screen bg-[var(--bg-canvas)] text-[var(--title)] font-sans flex flex-col">
        <AuthProvider>
          <ApiKeyProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </ApiKeyProvider>
        </AuthProvider>
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              borderRadius: "12px",
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
