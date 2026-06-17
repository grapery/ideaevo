import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ApiKeyProvider } from "@/lib/api-key-context";
import { Header } from "@/components/header";
import "./globals.css";

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
    <html lang="zh-CN" className="antialiased">
      <head>
        <script src="/runtime-env.js" />
      </head>
      <body className="min-h-screen bg-[var(--bg-canvas)] text-[var(--title)]">
        <AuthProvider>
          <ApiKeyProvider>
            <Header />
            <main>{children}</main>
          </ApiKeyProvider>
        </AuthProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
