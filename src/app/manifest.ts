import type { MetadataRoute } from "next";

/** Web app manifest: makes the site installable and is what the Android app (a Trusted Web Activity) is built from. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Stride Lab - Running Form Analysis",
    short_name: "Stride Lab",
    description: "AI running form analysis from a phone video, with Dash, your AI running buddy.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d121b",
    theme_color: "#4f46e5",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
