import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const buildTarget = mode === "content" ? "content" : "popup";
  const isContentBuild = buildTarget === "content";
  const input: Record<string, string> =
    isContentBuild
      ? { content: resolve(__dirname, "src/content.ts") }
      : { popup: resolve(__dirname, "popup.html") };

  return {
    build: {
      copyPublicDir: isContentBuild,
      emptyOutDir: isContentBuild,
      outDir: "dist",
      rollupOptions: {
        input,
        output: {
          assetFileNames: "assets/[name][extname]",
          chunkFileNames: "assets/[name].js",
          entryFileNames: "[name].js",
          ...(isContentBuild
            ? {
                format: "iife",
                inlineDynamicImports: true,
                name: "AIChatVaultContent"
              }
            : {})
        }
      }
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["tests/**/*.test.ts"]
    }
  };
});
