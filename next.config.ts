import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // GitHub Pages serves the project under /<repo>; folders with index.html resolve /auth/callback/.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
};

export default withNextIntl(nextConfig);
