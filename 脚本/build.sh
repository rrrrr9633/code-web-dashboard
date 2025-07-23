#!/bin/bash

# 代码可视化仪表板 - 快速打包脚本
# 支持多平台打包

echo "🚀 代码可视化仪表板打包工具"
echo "=================================="

# 检查 Node.js 环境
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未检测到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 npm 环境
if ! command -v npm &> /dev/null; then
    echo "❌ 错误：未检测到 npm，请先安装 npm"
    exit 1
fi

echo "✅ Node.js 环境检查通过"

# 安装依赖
echo "📦 正在安装依赖..."
npm install

echo ""
echo "选择打包目标："
echo "1) Linux (AppImage + DEB)"
echo "2) Windows (NSIS + Portable)"
echo "3) macOS (DMG)"
echo "4) 全平台打包"
echo "5) 仅开发模式运行"
echo "6) 🐳 Docker 容器化"

read -p "请输入选择 (1-6): " choice

case $choice in
    1)
        echo "🐧 正在为 Linux 打包..."
        npm run build-linux
        echo "✅ Linux 打包完成！"
        echo "📁 文件位置: ./dist/"
        ls -lh dist/*.AppImage dist/*.deb 2>/dev/null
        ;;
    2)
        echo "🪟 正在为 Windows 打包..."
        npm run build-win
        echo "✅ Windows 打包完成！"
        echo "📁 文件位置: ./dist/"
        ls -lh dist/*.exe 2>/dev/null
        ;;
    3)
        echo "🍎 正在为 macOS 打包..."
        npm run build-mac
        echo "✅ macOS 打包完成！"
        echo "📁 文件位置: ./dist/"
        ls -lh dist/*.dmg 2>/dev/null
        ;;
    4)
        echo "🌍 正在进行全平台打包..."
        npm run build
        echo "✅ 全平台打包完成！"
        echo "📁 文件位置: ./dist/"
        ls -lh dist/
        ;;
    5)
        echo "🔧 启动开发模式..."
        npm run electron-dev
        ;;
    6)
        echo "🐳 Docker 容器化部署..."
        if command -v docker &> /dev/null; then
            echo "选择 Docker 部署方式："
            echo "  a) 快速启动开发环境"
            echo "  b) 构建生产镜像"
            echo "  c) 完整生产环境 (含 Nginx)"
            read -p "请选择 (a/b/c): " docker_choice
            
            case $docker_choice in
                a)
                    echo "🚀 启动 Docker 开发环境..."
                    docker-compose up -d
                    echo "✅ Docker 环境启动完成！"
                    echo "🌐 访问地址：http://localhost:3000"
                    ;;
                b)
                    echo "🛠️ 构建 Docker 镜像..."
                    docker build -t code-web-dashboard:latest .
                    echo "✅ Docker 镜像构建完成！"
                    ;;
                c)
                    echo "🏭 启动生产环境 (含 Nginx)..."
                    docker-compose --profile production up -d
                    echo "✅ 生产环境启动完成！"
                    echo "🌐 访问地址：http://localhost"
                    ;;
                *)
                    echo "❌ 无效选择"
                    ;;
            esac
        else
            echo "❌ 未安装 Docker，请先安装 Docker"
            echo "💡 提示：使用 ./docker-deploy.sh 脚本进行完整的 Docker 部署"
        fi
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "🎉 操作完成！"
echo ""
echo "💡 使用提示："
echo "   - AppImage: 直接双击运行"
echo "   - DEB: sudo dpkg -i package.deb"
echo "   - EXE: 双击安装程序"
echo "   - DMG: 打开并拖拽到应用文件夹"
echo "   - Docker: docker run -p 3000:3000 code-web-dashboard"
