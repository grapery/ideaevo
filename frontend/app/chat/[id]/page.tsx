"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { chatApi } from "@/lib/api-client";
import ChatPage from "../page";

export default function ChatSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  useEffect(() => {
    chatApi.getSession(sessionId).catch(() => {
      router.push("/chat");
    });
  }, [sessionId, router]);

  return <ChatPage />;
}
