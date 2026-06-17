import { Suspense } from "react";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" /></div>}>{children}</Suspense>;
}
