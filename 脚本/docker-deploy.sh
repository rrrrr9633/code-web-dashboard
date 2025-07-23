#!/bin/bash

# Docker 容器化部署脚本
# 代码可视化仪表板

set -e

echo "🐳 代码可视化仪表板 - Docker 容器化工具"
echo "========================================"

# 检查 Docker 环境并自动安装
if ! command -v docker &> /dev/null; then
    echo "📦 未检测到 Docker，正在自动安装..."
    
    # 更新包管理器
    apt update
    
    # 安装依赖
    apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
    
    # 添加 Docker 官方 GPG 密钥
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 添加 Docker 仓库
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    
    # 安装 Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io
    
    # 启动 Docker 服务
    systemctl start docker
    systemctl enable docker
    
    echo "✅ Docker 安装完成"
fi

if ! command -v docker-compose &> /dev/null; then
    echo "📦 未检测到 Docker Compose，正在自动安装..."
    
    # 下载并安装 Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # 创建软链接
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    echo "✅ Docker Compose 安装完成"
fi

echo "✅ Docker 环境检查通过"
echo ""

# 显示菜单
echo "选择部署方式："
echo "1) 🚀 快速启动 (开发模式)"
echo "2) 🏭 生产环境部署"
echo "3) 🛠️ 构建 Docker 镜像"
echo "4) 🔍 查看运行状态"
echo "5) 🛑 停止服务"
echo "6) 🗑️ 清理资源"
echo "7) 📊 查看日志"
echo "8) 💾 数据备份"
echo "9) 🎯 一键完整部署 (推荐)"

read -p "请输入选择 (1-9): " choice

case $choice in
    1)
        echo "🚀 启动开发环境..."
        docker-compose up -d
        echo "✅ 开发环境启动完成！"
        echo "🌐 访问地址：http://localhost:3000"
        ;;
    2)
        echo "🏭 启动生产环境..."
        docker-compose --profile production up -d
        echo "✅ 生产环境启动完成！"
        echo "🌐 访问地址：http://localhost"
        echo "🔐 HTTPS：https://localhost"
        ;;
    3)
        echo "🛠️ 构建 Docker 镜像..."
        docker build -t code-web-dashboard:latest .
        echo "✅ 镜像构建完成！"
        docker images | grep code-web-dashboard
        ;;
    4)
        echo "🔍 查看运行状态..."
        docker-compose ps
        echo ""
        echo "📊 容器资源使用："
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
        ;;
    5)
        echo "🛑 停止服务..."
        docker-compose down
        echo "✅ 服务已停止"
        ;;
    6)
        echo "🗑️ 清理资源..."
        read -p "⚠️ 这将删除所有容器和镜像，确认继续？(y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            docker-compose down -v --rmi all
            docker system prune -af
            echo "✅ 资源清理完成"
        else
            echo "❌ 操作已取消"
        fi
        ;;
    7)
        echo "📊 查看应用日志..."
        docker-compose logs -f code-dashboard
        ;;
    8)
        echo "💾 创建数据备份..."
        mkdir -p ./backups
        timestamp=$(date +%Y%m%d_%H%M%S)
        docker-compose exec code-dashboard tar -czf - /app/data | cat > "./backups/backup_${timestamp}.tar.gz"
        echo "✅ 备份完成：./backups/backup_${timestamp}.tar.gz"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "🎉 操作完成！"
echo ""
echo "💡 常用命令："
echo "   - 查看日志：docker-compose logs -f"
echo "   - 重启服务：docker-compose restart"
echo "   - 进入容器：docker-compose exec code-dashboard sh"
echo "   - 查看状态：docker-compose ps"
