import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/types";

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  },
  ready_to_contact: {
    label: "Ready",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
  email_sent: {
    label: "Email Sent",
    className: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  },
  replied: {
    label: "Replied",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  },
  meeting_booked: {
    label: "Meeting",
    className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  },
  proposal_sent: {
    label: "Proposal",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  },
  won: {
    label: "Won",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  lost: {
    label: "Lost",
    className: "bg-red-500/15 text-red-400 border-red-500/20",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-500/15 text-gray-500 border-gray-500/20",
  },
};

interface StatusBadgeProps {
  status: LeadStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.new;
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border font-medium",
      size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
      config.className
    )}>
      {config.label}
    </span>
  );
}

export { statusConfig };
