import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    ".specify/**",
  ]),
  {
    // Constitution IV: the game engine must stay framework- and DOM-agnostic.
    files: ["src/game/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "react-dom"],
          patterns: ["next", "next/*", "next-intl", "next-intl/*", "@headlessui/*"],
        },
      ],
      "no-restricted-globals": ["error", "window", "document", "localStorage", "navigator"],
    },
  },
]);
