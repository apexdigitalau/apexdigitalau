"use client";

import { createContext, useContext, useState } from "react";
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

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </SidebarContext.Provider>
  );
}
