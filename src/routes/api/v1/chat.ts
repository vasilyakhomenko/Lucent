import { createFileRoute } from "@tanstack/react-router";
import { proxyOpenAI } from "@/lib/proxy";

export const Route = createFileRoute("/api/v1/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyOpenAI(request, "chat/completions"),
    },
  },
});
