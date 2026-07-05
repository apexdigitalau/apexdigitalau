"use client";

import { Bell, Moon, Sun, Menu } from "lucide-react";
import { useState } from "react";
import { useSidebar } from "@/components/layout/AppShell";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const [darkMode, setDarkMode] = useState(true);
  const { setOpen } = useSidebar();

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger - mobile only */}
        <button
          onClick={() => setOpen(true)}
          className="lg:hidden w-9 h-9 -ml-1 flex items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--foreground))] shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[hsl(var(--foreground))] truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--muted-foreground))]"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] transition-colors text-[hsl(var(--muted-foreground))]">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[hsl(var(--primary))] rounded-full" />
        </button>
      </div>
    </header>
  );
}
