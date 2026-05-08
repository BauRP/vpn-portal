import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  // Master VPN's home page sends visitors straight to the live dashboard.
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
