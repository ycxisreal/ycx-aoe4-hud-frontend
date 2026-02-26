const fs = require("node:fs");
const path = require("node:path");

// 准备临时入口文件，避免 electron-vite 启动前找不到 main 入口
const root = process.cwd();
const mainEntry = path.join(root, "dist", "main", "index.js");
const preloadEntry = path.join(root, "dist", "preload", "index.js");

// 创建目录
fs.mkdirSync(path.dirname(mainEntry), { recursive: true });
fs.mkdirSync(path.dirname(preloadEntry), { recursive: true });

// 写入占位文件
if (!fs.existsSync(mainEntry)) {
  fs.writeFileSync(mainEntry, "module.exports = {};\n", "utf8");
}
if (!fs.existsSync(preloadEntry)) {
  fs.writeFileSync(preloadEntry, "module.exports = {};\n", "utf8");
}
