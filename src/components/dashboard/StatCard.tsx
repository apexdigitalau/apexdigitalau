"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  accent?: string;
  loading?: boolean;
}

export function StatCard({ title, value, change, changeLabel, icon, accent, loading }: StatCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="h-4 w-24 rounded bg-[hsl(var(--muted))] mb-4 skeleton" />
        <div className="h-8 w-16 rounded bg-[hsl(var(--muted))] skeleton" />
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 hover:border-[hsl(var(--primary)/0.3)] transition-all duration-200 group"
    )}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{title}</p>
        {icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", accent || "bg-[hsl(var(--primary)/0.1)]")}>
            <span className="text-[hsl(var(--primary))]">{icon}</span>
          </div>
        )}
      </div>
      <div className="flex items-end gap-3">
        <p className="text-2xl font-bold text-[hsl(var(--foreground))] tabular-nums">{value}</p>
        {change !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium mb-0.5",
            isPositive ? "text-emerald-500" : isNegative ? "text-red-500" : "text-[hsl(var(--muted-foreground))]"
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      {changeLabel && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{changeLabel}</p>
      )}
    </div>
  );
}
