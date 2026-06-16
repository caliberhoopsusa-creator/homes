import type { MetadataRoute } from "next";

// PWA manifest so the desk is installable (Tauri wrap is v2, out of scope).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Parcel Desk",
    short_name: "Parcel",
    description: "Operator cockpit for the Parcel wholesale acquisition engine.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
