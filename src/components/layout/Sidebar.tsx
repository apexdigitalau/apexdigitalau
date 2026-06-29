"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Mail,
  Inbox,
  Globe,
  Briefcase,
  BarChart3,
  Settings,
  Bell,
  Search,
  ChevronDown,
  Zap,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Campaigns", href: "/campaigns", icon: Mail },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Website Analysis", href: "/website-analysis", icon: Globe },
  { name: "Clients", href: "/clients", icon: Briefcase },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [notifCount] = useState(3);

  return (
    <aside className="flex flex-col w-60 h-screen bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[hsl(var(--border))]">
        <div className="w-7 h-7 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-none">Apex Digital</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">CRM Platform</p>
        </div>
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
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150",
                active
                  ? "bg-[hsl(var(--primary))] text-white font-medium shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span>{item.name}</span>
              {item.name === "Inbox" && notifCount > 0 && (
                <span className={cn(
                  "ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                  active ? "bg-white/20 text-white" : "bg-[hsl(var(--primary))] text-white"
                )}>
                  {notifCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-[hsl(var(--border))]">
        <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[hsl(var(--accent))] transition-colors group">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            A
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">Admin</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">apex@apexdigital.com.au</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
        </button>
      </div>
    </aside>
  );
}
