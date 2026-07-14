"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

interface SidebarContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  open: false,
  setOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Stop the page scrolling underneath the open drawer.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {/* h-dvh, not h-screen: 100vh on iOS Safari includes the area behind the
          browser chrome, which pushed the bottom of every page off-screen. */}
      <div className="flex h-dvh overflow-hidden bg-[hsl(var(--background))]">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">{children}</main>
      </div>
    </SidebarContext.Provider>
  );
}
