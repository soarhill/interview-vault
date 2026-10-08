import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// GitHub Pages 项目站点：基础路径固定为 /interview-vault/。
// 产物输出到仓库根的 docs/，由 gh-pages 分支的 /docs 目录直接发布。
export default defineConfig({
  base: "/interview-vault/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
