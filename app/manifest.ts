import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Guardian Digital Revenue & Security",
    short_name: "Guardian",
    description: "Enterprise Digital Revenue Infrastructure, Uptime, Security, and Incident Guardian",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#0891b2",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Digital Health Score",
        url: "/health",
        description: "View real-time digital health score and category breakdown",
      },
      {
        name: "Incidents & Revenue",
        url: "/revenue",
        description: "Inspect active revenue and lead form incidents",
      },
      {
        name: "AutoFix Remediation",
        url: "/remediation",
        description: "Review and approve automated remediation blueprints",
      },
      {
        name: "Mobile Command",
        url: "/mobile",
        description: "Mobile notifications, device status, and quick actions",
      },
    ],
  };
}

