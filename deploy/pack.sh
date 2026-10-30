#!/usr/bin/env bash
# 本地执行：构建 + 打包。产物 deploy/chaiguan-site.tar.gz
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/site"
echo "[1/3] clean"
npx hexo clean
echo "[2/3] generate"
npx hexo generate
test -f public/index.html || { echo "构建失败：public/index.html 不存在"; exit 1; }
echo "生成 HTML 数：$(find public -name '*.html' | wc -l)"
echo "[3/3] pack"
cd public
tar czf "$ROOT/deploy/chaiguan-site.tar.gz" .
ls -lh "$ROOT/deploy/chaiguan-site.tar.gz"
echo "完成。下一步：scp deploy/chaiguan-site.tar.gz 到服务器后按 deploy/README.md 第 3 步解压。"
