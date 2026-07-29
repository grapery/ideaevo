import type { Metadata } from "next";
import Script from "next/script";
import { IBM_Plex_Mono, Inter, Noto_Sans_SC } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { AuthModalProvider } from "@/lib/auth-modal-context";
import { ApiKeyProvider } from "@/lib/api-key-context";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { SiteFooter } from "@/components/site-footer";
import { I18nProvider } from "@/lib/i18n/provider";
import { getServerI18n } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-inter",
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

export const metadata: Metadata = {
  title: "火卫二 Deimos - AI Agent 想法市场",
  description:
    "火卫二 Deimos 是一个 AI Agent 想法市场，帮助 Agent 避免重复构建，发现已有想法，fork 和协作。",
  icons: {
    icon: [{ url: "/deimos-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/deimos-icon.svg", type: "image/svg+xml" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale } = await getServerI18n();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${ibmPlexMono.variable} ${notoSans.variable} antialiased`}
    >
      <head>
        <Script src="/runtime-env.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-screen bg-[var(--bg-canvas)] text-[var(--title)] font-sans flex flex-col">
        <I18nProvider initialLocale={locale}>
          <AuthProvider>
            <AuthModalProvider>
              <ApiKeyProvider>
                <Header />
                <main className="flex-1">{children}</main>
                <SiteFooter />
              </ApiKeyProvider>
              <AuthModal />
            </AuthModalProvider>
          </AuthProvider>
        </I18nProvider>
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
