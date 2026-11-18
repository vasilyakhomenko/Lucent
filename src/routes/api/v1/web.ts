import { createFileRoute } from "@tanstack/react-router";
import { handleWeb } from "@/lib/web";

export const Route = createFileRoute("/api/v1/web")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWeb(request),
    },
  },
});
