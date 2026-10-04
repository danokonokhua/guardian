import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function getAllFiles(dirPath: string, extensions: string[], arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== "dist" && file !== "build") {
        getAllFiles(fullPath, extensions, arrayOfFiles);
      }
    } else {
      if (extensions.some((ext) => file.endsWith(ext))) {
        arrayOfFiles.push(fullPath);
      }
    }
  }

  return arrayOfFiles;
}

function getAppRoutes(): Set<string> {
  const appDir = path.resolve(process.cwd(), "app");
  const files = getAllFiles(appDir, [".tsx", ".ts"]);
  const routes = new Set<string>();

  for (const file of files) {
    const relative = path.relative(appDir, file);
    if (relative.endsWith("page.tsx")) {
      let routePath =
        "/" +
        relative
          .replace(/\\/g, "/")
          .replace(/\/page\.tsx$/, "")
          .replace(/^page\.tsx$/, "");
      if (!routePath.startsWith("/")) routePath = "/" + routePath;
      if (routePath === "") routePath = "/";
      routes.add(routePath);
    }
  }

  return routes;
}

function matchesRoute(target: string, availableRoutes: Set<string>): boolean {
  // Normalize target (strip query params and hashes)
  const part0 = target.split("?")[0] ?? "";
  const cleanPath = part0.split("#")[0] ?? "";
  if (cleanPath === "") return true; // anchor on current page

  // Exact match
  if (availableRoutes.has(cleanPath)) return true;

  // Check dynamic route matching, e.g. /status/[slug] matching /status/abc
  for (const route of availableRoutes) {
    if (route.includes("[")) {
      const regexPattern =
        "^" + route.replace(/\[\.\.\.[^\]]+\]/g, ".*").replace(/\[[^\]]+\]/g, "[^/]+") + "$";
      if (new RegExp(regexPattern).test(cleanPath)) {
        return true;
      }
    }
  }

  return false;
}

describe("Link Integrity Suite", () => {
  it("verifies that all internal links in app and components point to valid routes", () => {
    const availableRoutes = getAppRoutes();
    const sourceFiles = [
      ...getAllFiles(path.resolve(process.cwd(), "app"), [".tsx"]),
      ...getAllFiles(path.resolve(process.cwd(), "components"), [".tsx"]),
    ];

    const linkRegex = /href=(?:\{`|["'])(\/[^"'`}\s]+)(?:`\}|["'])/g;
    const brokenLinks: Array<{ file: string; link: string }> = [];

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      let match: RegExpExecArray | null;

      while ((match = linkRegex.exec(content)) !== null) {
        const target = match[1];
        if (!target) continue;

        // Ignore API routes, public static assets, or mailto
        if (
          target.startsWith("/api/") ||
          target.startsWith("/manifest") ||
          target.startsWith("/icon") ||
          target.startsWith("/favicon") ||
          target.startsWith("/_")
        ) {
          continue;
        }

        if (!matchesRoute(target, availableRoutes)) {
          brokenLinks.push({
            file: path.relative(process.cwd(), filePath),
            link: target,
          });
        }
      }
    }

    expect(brokenLinks).toEqual([]);
  });

  it("verifies all frontpage anchor links point to existing section IDs", () => {
    const homePageContent = fs.readFileSync(path.resolve(process.cwd(), "app/page.tsx"), "utf-8");
    const pricingFaqContent = fs.readFileSync(
      path.resolve(process.cwd(), "components/landing/pricing-and-faq-section.tsx"),
      "utf-8",
    );

    const combined = homePageContent + "\n" + pricingFaqContent;
    const anchorMatches = [...combined.matchAll(/href="#([^"]+)"/g)]
      .map((m) => m[1])
      .filter((m): m is string => Boolean(m));
    const idMatches = new Set(
      [...combined.matchAll(/id="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((m): m is string => Boolean(m)),
    );

    const missingIds: string[] = [];
    for (const anchor of anchorMatches) {
      if (!idMatches.has(anchor)) {
        missingIds.push(anchor);
      }
    }

    expect(missingIds).toEqual([]);
  });
});
