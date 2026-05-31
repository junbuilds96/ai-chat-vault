import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    copyPublicDir: true,
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content.ts")
      },
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
});
