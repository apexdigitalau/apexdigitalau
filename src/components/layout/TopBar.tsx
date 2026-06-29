"use client";

import { Bell, Moon, Sun } from "lucide-react";
import { useState } from "react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const [darkMode, setDarkMode] = useState(true);

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">{title}</h1>
        {subtitle && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
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
