import { Link, useLocation } from "wouter";
import { Church, FileVideo, ListChecks, BookOpen } from "lucide-react";
import { PerplexityAttribution } from "./PerplexityAttribution";

const navItems = [
  { href: "/", label: "Sermons", icon: Church },
  { href: "/edits", label: "Edits", icon: FileVideo },
  { href: "/workflow", label: "Workflow", icon: BookOpen },
];

function PFCLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className="w-8 h-8"
      aria-label="PFC Media"
    >
      <rect width="32" height="32" rx="6" fill="hsl(var(--primary))" />
      <path
        d="M8 10h7a4 4 0 010 8h-3v4H8V10z"
        fill="hsl(var(--primary-foreground))"
      />
      <circle cx="22" cy="22" r="4" stroke="hsl(var(--primary-foreground))" strokeWidth="2" fill="none" />
      <path d="M21 20.5l2.5 1.5-2.5 1.5V20.5z" fill="hsl(var(--primary-foreground))" />
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-48 border-r border-border bg-sidebar shrink-0">
        <div className="px-3 py-2.5 flex items-center gap-2.5 border-b border-border">
          <PFCLogo />
          <div>
            <h1 className="text-xs font-semibold text-foreground leading-tight">PFC Media</h1>
            <p className="text-[10px] text-muted-foreground">Workflow Tracker</p>
          </div>
        </div>
        <nav className="flex-1 p-1.5 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.href === "/"
              ? location === "/" || location === ""
              : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-border">
          <PerplexityAttribution />
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-border flex justify-around py-2 px-1">
        {navItems.map((item) => {
          const isActive = item.href === "/"
            ? location === "/" || location === ""
            : location.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-xs cursor-pointer ${
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
