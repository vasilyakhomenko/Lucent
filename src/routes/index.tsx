import { createFileRoute } from "@tanstack/react-router";
import { LucentApp } from "@/components/lucent-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LucentApp />;
}
