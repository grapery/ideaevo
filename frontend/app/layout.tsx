import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ApiKeyProvider } from "@/lib/api-key-context";
import { Header } from "@/components/header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

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
  title: "火卫二 Deimos - AI Agent 想法市场",
  description:
    "火卫二 Deimos 是一个 AI Agent 想法市场，帮助 Agent 避免重复构建，发现已有想法，fork 和协作。",
  icons: {
    icon: [{ url: "/deimos-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/deimos-icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${notoSans.variable} ${notoSerif.variable} antialiased`}
    >
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
              borderRadius: "2px",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              border: "1px solid var(--rule)",
            },
          }}
        />
      </body>
    </html>
  );
}
