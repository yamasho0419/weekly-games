import { resolve } from "node:path";
import { defineConfig } from "vite";

// GitHub Pages は main ブランチの docs/ を公開する
export default defineConfig({
  base: "/weekly-games/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        loop: resolve(__dirname, "loop/index.html"),
      },
    },
  },
});
