// Served by Next at /manifest.webmanifest.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Apex Digital CRM",
    short_name: "Apex CRM",
    description: "Leads, clients and outreach for Apex Digital AU",
    // Land on the dashboard rather than the root redirect.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#181A20",
    theme_color: "#181A20",
    // 'any' rather than 'portrait' so the CRM is usable landscape on a tablet.
    orientation: "any",
    icons: [
      // Android needs an explicit 'any' icon; a maskable-only set can render blank.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
