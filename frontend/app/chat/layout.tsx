import { Suspense } from "react";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
