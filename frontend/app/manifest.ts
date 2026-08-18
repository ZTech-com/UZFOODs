import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Restoran — Oldindan Buyurtma",
    short_name: "Buyurtma",
    description: "Darslardan oldin ovqat buyurtma qiling",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#16a34a",
    orientation: "portrait",
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
