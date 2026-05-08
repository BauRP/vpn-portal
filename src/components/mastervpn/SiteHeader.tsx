import { Link } from "@tanstack/react-router";
import { MasterVpnLogo } from "./Logo";

const navItems = [
  { to: "/", label: "Home", exact: true },
  { to: "/features", label: "Features", exact: false },
  { to: "/app", label: "Live Demo", exact: false },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <MasterVpnLogo />
        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-sm font-medium text-neon" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          to="/app"
          className="rounded-md border border-neon/50 bg-neon/10 px-4 py-2 text-sm font-semibold text-neon transition hover:bg-neon/20 hover:glow-neon"
        >
          Launch App
        </Link>
      </div>
    </header>
  );
}
