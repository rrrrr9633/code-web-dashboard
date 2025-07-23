# 🐳 Docker 容器化完整指南

## 📖 什么是容器化？

### 🎯 核心概念
**容器化**是将应用程序及其运行环境打包成一个轻量级、可移植容器的技术。

### 🏗️ 类比理解
- **传统部署** = 在不同房子里装修（环境差异、依赖冲突）
- **容器化** = 标准化的集装箱（统一环境、随处运行）

### ✨ 主要优势

| 优势 | 说明 | 实际效果 |
|------|------|----------|
| 🎯 **环境一致性** | 开发、测试、生产环境完全相同 | 消除"在我机器上能运行"问题 |
| ⚡ **轻量高效** | 比虚拟机更小、启动更快 | 秒级启动，占用资源少 |
| 📦 **易于部署** | 一键部署到任何支持Docker的环境 | 简化运维流程 |
| 🔒 **资源隔离** | 每个容器独立运行 | 避免应用间互相干扰 |
| 📈 **弹性扩展** | 轻松复制多个实例 | 应对流量高峰 |

---

## 🚀 快速开始

### 1️⃣ 安装 Docker

#### Ubuntu/Debian:
```bash
# 更新包管理器
sudo apt update

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 将用户添加到 docker 组
sudo usermod -aG docker $USER

# 重新登录或运行
newgrp docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### CentOS/RHEL:
```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker
```

### 2️⃣ 验证安装
```bash
docker --version
docker-compose --version
docker run hello-world
```

---

## 🛠️ 项目容器化

### 📁 项目文件结构
```
code-web-dashboard/
├── Dockerfile              # Docker 镜像构建文件
├── docker-compose.yml      # 多容器编排配置
├── .dockerignore           # Docker 忽略文件
├── nginx.conf              # Nginx 反向代理配置
├── docker-deploy.sh        # Docker 部署脚本
└── ...
```

### 🏗️ Dockerfile 说明
```dockerfile
# 多阶段构建，减小镜像大小
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runner
# 安装系统依赖
RUN apk add --no-cache sqlite python3 make g++
# 创建非root用户（安全）
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# 复制应用代码
COPY --chown=nextjs:nodejs . .
# 健康检查
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('http').get('http://localhost:3000/health'...)"
CMD ["npm", "start"]
```

---

## 🚀 部署方式

### 方式一：简单部署
```bash
# 构建镜像
docker build -t code-web-dashboard .

# 运行容器
docker run -d \
  --name code-dashboard \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  code-web-dashboard
```

### 方式二：Docker Compose (推荐)
```bash
# 开发环境
docker-compose up -d

# 生产环境 (含 Nginx)
docker-compose --profile production up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 方式三：使用部署脚本
```bash
# 使用自动化脚本
./docker-deploy.sh

# 或使用统一构建脚本
./build.sh
# 选择选项 6) Docker 容器化
```

---

## 📊 监控和管理

### 🔍 状态检查
```bash
# 查看容器状态
docker-compose ps

# 查看资源使用
docker stats

# 查看日志
docker-compose logs -f code-dashboard

# 健康检查
curl http://localhost:3000/health
```

### 💾 数据管理
```bash
# 数据备份
docker-compose exec code-dashboard tar -czf - /app/data > backup.tar.gz

# 数据恢复
cat backup.tar.gz | docker-compose exec -T code-dashboard tar -xzf - -C /

# 清理数据
docker-compose down -v
```

### 🔄 更新应用
```bash
# 重新构建
docker-compose build

# 重启服务
docker-compose restart

# 更新并重启
docker-compose up -d --build
```

---

## 🏭 生产环境配置

### 🔧 环境变量
```yaml
# docker-compose.yml
environment:
  - NODE_ENV=production
  - PORT=3000
  - DB_PATH=/app/data/project_files.db
  - MAX_FILE_SIZE=2048MB
```

### 🔒 安全配置
- ✅ 非 root 用户运行
- ✅ 最小权限原则
- ✅ 资源限制
- ✅ 健康检查
- ✅ 数据卷持久化

### 🌐 Nginx 反向代理
- ✅ 负载均衡
- ✅ SSL 终端
- ✅ 静态文件缓存
- ✅ 速率限制
- ✅ 安全头

---

## 🆚 容器化 vs 其他方案

| 方案 | 优势 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Electron 桌面应用** | 原生体验、离线使用 | 体积大、资源占用高 | 个人用户、离线环境 |
| **Docker 容器化** | 环境一致、易部署、可扩展 | 需要 Docker 环境 | 服务器部署、团队协作 |
| **传统部署** | 简单直接 | 环境依赖复杂 | 简单应用、学习阶段 |
| **云原生** | 高可用、自动扩展 | 复杂度高、成本高 | 大规模生产环境 |

---

## 🎯 使用建议

### 👤 个人开发者
```bash
# 快速本地开发
npm start

# 打包分发
./build.sh  # 选择 Electron
```

### 👥 团队协作
```bash
# 统一开发环境
docker-compose up -d

# 持续集成部署
./docker-deploy.sh
```

### 🏢 生产部署
```bash
# 完整生产环境
docker-compose --profile production up -d

# 监控和维护
docker-compose logs -f
```

---

## 🔧 故障排除

### 常见问题

**Q: Docker 构建失败？**
```bash
# 清理 Docker 缓存
docker system prune -af

# 重新构建
docker-compose build --no-cache
```

**Q: 容器无法访问？**
```bash
# 检查端口映射
docker-compose ps

# 检查防火墙
sudo ufw status
sudo ufw allow 3000
```

**Q: 数据丢失？**
```bash
# 检查数据卷
docker volume ls

# 备份数据
./docker-deploy.sh  # 选择备份选项
```

---

## 📚 参考资源

- 🐳 [Docker 官方文档](https://docs.docker.com/)
- 🎼 [Docker Compose 参考](https://docs.docker.com/compose/)
- 🔧 [最佳实践指南](https://docs.docker.com/develop/dev-best-practices/)
- 🏗️ [多阶段构建](https://docs.docker.com/develop/develop-images/multistage-build/)

---

*🎉 恭喜！您已经掌握了 Docker 容器化的完整知识！*
