#!/bin/bash

echo "🔍 检查开发环境..."
echo ""

# 检查 Node.js
echo "1. 检查 Node.js 版本:"
node -v
echo ""

# 检查端口 5173
echo "2. 检查端口 5173 是否被占用:"
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "✅ 端口 5173 已被占用（Vite 可能正在运行）"
    lsof -ti:5173 | xargs ps -p
else
    echo "❌ 端口 5173 未被占用（Vite 可能未启动）"
fi
echo ""

# 检查 dist 文件
echo "3. 检查编译文件:"
if [ -f "dist/main.js" ]; then
    echo "✅ dist/main.js 存在"
else
    echo "❌ dist/main.js 不存在，运行: npm run build:electron"
fi

if [ -f "dist/preload.js" ]; then
    echo "✅ dist/preload.js 存在"
else
    echo "❌ dist/preload.js 不存在，运行: npm run build:electron"
fi
echo ""

# 检查 Vite 服务器
echo "4. 测试 Vite 服务器连接:"
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Vite 服务器正在运行"
else
    echo "❌ 无法连接到 Vite 服务器"
    echo "   请先运行: npm run dev:react"
fi
echo ""

# 检查环境变量
echo "5. 检查环境变量:"
echo "   NODE_ENV: ${NODE_ENV:-未设置（将使用开发模式）}"
echo ""

echo "✅ 检查完成！"
echo ""
echo "如果发现问题，请："
echo "1. 确保 Vite 服务器正在运行: npm run dev:react"
echo "2. 重新构建 Electron: npm run build:electron"
echo "3. 启动开发模式: npm run dev"

