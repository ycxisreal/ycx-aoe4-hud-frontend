import path from "node:path";
import { defineConfig } from "electron-vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      emptyOutDir: false,
      watch: {},
      rollupOptions: {
        external: ["ws", "bufferutil", "utf-8-validate"],
      },
    },
  },
  preload: {
    build: {
      outDir: "dist/preload",
      emptyOutDir: false,
      watch: {},
      rollupOptions: {
        input: {
          index: path.join(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    plugins: [vue()],
    build: {
      outDir: "dist/renderer",
      emptyOutDir: false,
    },
  },
});
