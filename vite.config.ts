import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const buildTarget = mode === "content" ? "content" : "popup";
  const input: Record<string, string> =
    buildTarget === "content"
      ? { content: resolve(__dirname, "src/content.ts") }
      : { popup: resolve(__dirname, "popup.html") };

  return {
    build: {
      copyPublicDir: buildTarget === "content",
      emptyOutDir: buildTarget === "content",
      outDir: "dist",
      rollupOptions: {
        input,
        output: {
          assetFileNames: "assets/[name][extname]",
          chunkFileNames: "assets/[name].js",
          entryFileNames: "[name].js"
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
