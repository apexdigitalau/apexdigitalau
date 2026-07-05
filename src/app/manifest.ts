// app/manifest.ts — Next.js 15 native PWA manifest.
// Drop this file into your CRM's app/ directory. Next serves it at /manifest.webmanifest automatically.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Apex Digital CRM",
    short_name: "Apex CRM",
    description: "Leads, clients and outreach for Apex Digital AU",
    start_url: "/",
    display: "standalone",        // hides the browser chrome -> feels like an app
    background_color: "#181A20",
    theme_color: "#181A20",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
