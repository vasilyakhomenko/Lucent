import { createFileRoute } from "@tanstack/react-router";
import { proxyOpenAI } from "@/lib/proxy";

export const Route = createFileRoute("/api/v1/models")({
  server: {
    handlers: {
      POST: async ({ request }) => proxyOpenAI(request, "models"),
    },
  },
});
