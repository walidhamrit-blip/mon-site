import type { Demo } from "@/lib/site-types";

// Match the URL as well as the project: changing an admin URL must not leave an
// unrelated screenshot attached to it. These are static, compressed local files.
const previews: Record<string, { desktop: string; mobile: string; screenshot: boolean }> = {
  "https://al-manhaj-company.vercel.app": {
    desktop: "/previews/al-manhaj-company-desktop.webp",
    mobile: "/previews/al-manhaj-company-mobile.webp",
    screenshot: true,
  },
  "https://hala-dun.vercel.app": {
    desktop: "/previews/hala-perfumes-desktop.webp",
    mobile: "/previews/hala-perfumes-mobile.webp",
    screenshot: true,
  },
  "https://m-et-outillage-modele-3.vercel.app": {
    desktop: "/previews/tripo-teck-visual.webp",
    mobile: "/previews/tripo-teck-visual.webp",
    screenshot: false,
  },
};

export function getProjectPreview(demo: Demo, mode: "desktop" | "mobile") {
  const preview = previews[demo.previewUrl.trim().replace(/\/+$/, "")];
  return { src: preview?.[mode] || demo.image, screenshot: preview?.screenshot ?? false };
}
