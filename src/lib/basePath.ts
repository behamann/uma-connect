/** Site path prefix on GitHub Pages project sites (e.g. "/uma-connect"); empty locally. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes root-relative asset paths that next/link and next/image don't rewrite (unoptimized images, URLs). */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
