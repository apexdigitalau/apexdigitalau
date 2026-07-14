"use client";

import { Bell, Moon, Sun, Menu } from "lucide-react";
import { useSidebar } from "@/components/layout/AppShell";
import { useTheme } from "@/components/common/ThemeProvider";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const { setOpen } = useSidebar();
  const { theme, toggleTheme } = useTheme();

  return (
    // pt-safe clears the iOS status bar, which overlaps the app because
    // appleWebApp.statusBarStyle is 'black-translucent'.
    <header className="pt-safe border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] shrink-0">
      <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Hamburger — the only way to reach the nav below lg */}
          <button
            onClick={() => setOpen(true)}
            className="tap-target lg:hidden w-10 h-10 -ml-2 flex items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--foreground))] shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-semibold text-[hsl(var(--foreground))] truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {/* Actions sit inline on desktop; on mobile they move to their own row. */}
          {actions && <div className="hidden md:flex items-center gap-2">{actions}</div>}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="tap-target w-10 h-10 flex items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--muted-foreground))]"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            aria-label="Notifications"
            className="tap-target relative w-10 h-10 flex items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--muted-foreground))]"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[hsl(var(--primary))] rounded-full" />
          </button>
        </div>
      </div>

      {/* Mobile action row: scrolls sideways instead of squashing the header. */}
      {actions && (
        <div className="md:hidden touch-scroll-x flex items-center gap-2 px-4 pb-3 [&>*]:shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
