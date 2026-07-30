"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { getSupabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Users,
  Phone,
  Mail,
  Inbox,
  Globe,
  Briefcase,
  BarChart3,
  Settings,
  Search,
  ChevronDown,
  Sun,
  Moon,
  BookOpen,
  Sparkles,
  LogOut,
  Loader2,
  X,
} from "lucide-react";
import { useTheme } from "@/components/common/ThemeProvider";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useSidebar } from "@/components/layout/AppShell";

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    >
      {theme === "dark" ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
      <span className="text-xs font-medium">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

function AdminMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside press and on Escape. pointerdown rather than click so the
  // menu closes on touch as well as mouse.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The sidebar stays mounted across navigations, so the menu would otherwise
  // still be hanging open on the next page.
  useEffect(() => setOpen(false), [pathname]);

  async function handleSignOut() {
    setSigningOut(true);
    await getSupabase().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <div ref={wrapRef} className="relative">
      {open && (
        // bottom-full opens upward: this sits at the bottom of the viewport, and
        // neither the desktop aside nor the mobile drawer clips overflow.
        <div
          role="menu"
          aria-label="Account"
          className="absolute bottom-full left-0 right-0 mb-1 z-50 overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg"
        >
          <button
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 min-h-11 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 shrink-0" />
            )}
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-2.5 px-2 py-2 rounded-md transition-colors",
          open ? "bg-[hsl(var(--accent))]" : "hover:bg-[hsl(var(--accent))]"
        )}
      >
        <div className="w-7 h-7 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-[hsl(var(--primary-foreground))] text-xs font-bold shrink-0">
          A
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">Admin</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">apex@apexdigital.com.au</p>
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
    </div>
  );
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "AI Assistant", href: "/assistant", icon: Sparkles },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Call Queue", href: "/calls", icon: Phone },
  { name: "Campaigns", href: "/campaigns", icon: Mail },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Website Analysis", href: "/website-analysis", icon: Globe },
  { name: "Clients", href: "/clients", icon: Briefcase },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Deploy Guide", href: "/deploy-guide", icon: BookOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [notifCount] = useState(3);

  return (
    <>
      {/* Logo — the lockup already carries the company name, so no text label beside it */}
      <div className="flex items-center px-5 py-4 border-b border-[hsl(var(--border))]">
        <Image
          src="/logo.png"
          alt={BRAND.companyFullName}
          width={862}
          height={336}
          priority
          className="logo-on-light h-8 w-auto"
        />
        <Image
          src="/logo-white.png"
          alt={BRAND.companyFullName}
          width={862}
          height={336}
          priority
          className="logo-on-dark h-8 w-auto"
        />
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-[hsl(var(--border))]">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors text-sm text-[hsl(var(--muted-foreground))] group">
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left text-xs">Search...</span>
          <kbd className="hidden group-hover:flex items-center gap-0.5 text-[10px] bg-[hsl(var(--background))] px-1.5 py-0.5 rounded border border-[hsl(var(--border))]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                // min-h-11 (44px) — these are <a>, so the global touch rule for
                // buttons doesn't cover them.
                "flex items-center gap-2.5 px-3 py-2 min-h-11 rounded-md text-sm transition-all duration-150",
                active
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span className="truncate">{item.name}</span>
              {item.name === "Inbox" && notifCount > 0 && (
                <span className={cn(
                  "ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                  // On the active row the pill sits on orange, so it darkens rather than lightens.
                  active ? "bg-black/15 text-[hsl(var(--primary-foreground))]" : "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                )}>
                  {notifCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + User */}
      <div className="p-3 border-t border-[hsl(var(--border))] space-y-1">
        <ThemeToggleButton />
        <AdminMenu />
      </div>
    </>
  );
}

export function Sidebar() {
  const { open, setOpen } = useSidebar();
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Desktop sidebar - unchanged, hidden below lg */}
      <aside className="hidden lg:flex flex-col w-60 h-screen bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile slide-out drawer */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col",
          "bg-[hsl(var(--card))] border-r border-[hsl(var(--border))]",
          "pt-safe pb-safe",
          "transform transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!open}
      >
        <button
          onClick={() => setOpen(false)}
          className="tap-target absolute top-[max(0.75rem,env(safe-area-inset-top))] right-2 z-10 w-11 h-11 flex items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
