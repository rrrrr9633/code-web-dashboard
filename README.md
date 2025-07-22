# 📊代码可视化分析器

> 🚀 一个现代化的Web界面，专为代码浏览、项目分析和AI辅助开发设计

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18.x-blue.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![AI-Powered](https://img.shields.io/badge/AI-DeepSeek-purple.svg)](https://www.deepseek.com/)

## ✨ 核心特性

### � 智能项目管理
- **多项目支持**: 同时管理和切换多个代码项目
- **动态项目添加**: 通过界面快速添加本地项目目录
- **项目状态管理**: 实时显示项目分析状态和重组配置

### 🧠 AI驱动分析
- **智能项目分析**: 使用DeepSeek AI深度分析项目结构和代码质量
- **目录重组建议**: AI生成的智能目录结构优化方案
- **重复分析检测**: 自动检测已分析项目，避免重复分析
- **持久化配置**: 分析结果和重组配置永久保存

### 🎨 现代化界面
- **Apple风格设计**: 采用现代glassmorphism效果和渐变设计
- **响应式布局**: 适配各种屏幕尺寸，完美的移动端体验
- **代码语法高亮**: 支持30+编程语言的语法高亮显示
- **智能搜索**: 全项目代码搜索，支持关键词高亮

### 🔐 安全可靠
- **JWT身份验证**: 基于Token的安全认证机制
- **文件路径验证**: 严格的文件访问权限控制
- **API密钥管理**: 安全的AI服务配置和管理

## 🚀 快速开始

### 环境要求
- Node.js 16.x 或更高版本
- npm 或 yarn 包管理器
- 支持现代JavaScript的浏览器

### 安装与启动

```bash
# 克隆项目
git clone <repository-url>
cd web-dashboard

# 安装依赖
npm install

# 启动开发服务器
npm start

# 或者使用开发模式（自动重启）
npm run dev
```

### 首次配置

1. 打开浏览器访问 `http://localhost:3000`
2. 使用默认密码 `flowmq2024` 登录系统
3. 配置DeepSeek AI API密钥以启用AI功能
4. 添加您的第一个项目开始分析

## 🎮 使用指南

### 项目管理
- **添加项目**: 点击"添加项目"按钮，输入项目名称和本地路径
- **切换项目**: 在左侧项目列表中点击项目名称
- **项目操作**: 支持重命名、刷新、删除项目

### AI分析功能
1. **项目分析**: 选择项目后点击"项目分析"获得AI生成的项目结构分析
2. **智能检测**: 系统自动检测已分析项目，提供查看现有结果或重新分析的选项
3. **目录重组**: 应用AI建议的目录结构优化方案
4. **状态管理**: 查看项目分析状态，随时重置为原始结构

### 代码浏览
- **文件树导航**: 在左侧面板浏览项目文件结构
- **代码查看**: 点击文件查看带语法高亮的代码内容
- **全局搜索**: 使用顶部搜索框在整个项目中搜索代码

## 🏗️ 技术架构

### 前端技术栈
```
HTML5 + CSS3 + Vanilla JavaScript
├── UI框架: 原生JavaScript + 现代CSS
├── 样式: Glassmorphism + Apple设计语言
├── 代码高亮: Highlight.js
├── Markdown渲染: Marked.js
└── 图标: Font Awesome
```

### 后端技术栈
```
Node.js + Express.js
├── Web框架: Express.js 4.18.x
├── 文件处理: Node.js原生fs模块
├── HTTP客户端: Axios
├── 跨域处理: CORS
└── 身份验证: JWT
```

### AI集成
```
DeepSeek API
├── 模型: deepseek-chat
├── 功能: 代码分析、项目重组
├── 特性: 思考过程展示
└── 优化: 重复分析检测
```

## 📁 项目结构

```
web-dashboard/
├── public/                 # 前端静态资源
│   ├── index.html         # 主界面
│   ├── login.html         # 登录界面
│   └── app.js            # 前端主要逻辑
├── server.js              # 后端服务器
├── package.json           # 项目配置
├── README.md             # 项目说明
├── ANALYSIS-OPTIMIZATION.md  # AI分析优化功能说明
├── RESTRUCTURE-GUIDE.md  # 目录重组功能使用指南
├── DESIGN-UPGRADE.md     # 设计升级说明
└── IMPROVEMENTS.md       # 改进计划
```

## ⚙️ 配置说明

### AI服务配置
在系统设置中配置DeepSeek API：
- **API URL**: `https://api.deepseek.com/v1/chat/completions`
- **API Key**: 从DeepSeek官网获取的API密钥

### 环境变量（可选）
```bash
# 生产环境建议使用环境变量
DEEPSEEK_API_KEY=your_api_key_here
PORT=3000
NODE_ENV=production
```

### 服务器配置
- **默认端口**: 3000
- **文件上传限制**: 50MB
- **支持的文件类型**: 所有文本文件
- **项目目录**: 支持本地任意目录

## 🔧 高级功能

### 重复分析优化
- **智能检测**: 自动识别已分析的项目
- **选择对话框**: 提供查看现有结果或重新分析的选项
- **状态指示**: 清晰显示项目分析和重组状态

### 🔄 目录重组系统
- **AI智能分析**: 基于项目特点生成目录重组优化方案
- **永久保存配置**: 重组配置持久化存储，刷新页面不丢失
- **一键应用重组**: 快速应用AI推荐的目录结构优化
- **状态可视化**: 项目列表显示🪄魔法图标标识已重组项目
- **快速重置**: 随时一键恢复原始目录结构

#### 详细使用流程
1. **项目分析**: 选择项目 → 点击"项目分析" → 等待AI分析完成
2. **应用重组**: 在分析结果中点击"应用目录重组"按钮
3. **状态确认**: 项目列表中显示魔法图标🪄，表示重组已应用
4. **重置选项**: 需要时可点击"重置为原始结构"恢复

#### 技术实现
- **后端API**: `POST/GET/DELETE /api/projects/:projectId/restructure`
- **持久化**: 服务器内存存储（可扩展为数据库）
- **状态管理**: 自动检测和应用保存的重组配置

### 安全特性
- **路径验证**: 防止目录遍历攻击
- **认证保护**: JWT Token身份验证
- **API限制**: AI接口调用频率控制

## 🧪 功能测试指南

### 目录重组功能测试
1. **基本重组流程**:
   ```
   添加新项目 → AI分析 → 应用重组 → 刷新页面 → 验证重组保持
   ```

2. **重置功能测试**:
   ```
   已重组项目 → AI分析 → 重置结构 → 验证恢复原始状态
   ```

3. **多项目并行测试**:
   ```
   对多个项目分别应用不同重组配置 → 验证配置互不影响
   ```

### 重复分析检测测试
- 对已分析项目再次点击"项目分析"
- 验证出现选择对话框：查看现有结果 vs 重新分析
- 测试两个选项的功能正确性

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发环境搭建
1. Fork本项目
2. 创建特性分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 提交Pull Request

### 代码规范
- 使用ES6+语法
- 遵循JavaScript Standard Style
- 添加必要的注释和文档

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## � 未来规划

### 目录重组功能扩展
- [ ] 数据库持久化存储（替换内存存储）
- [ ] 重组配置版本管理和历史记录
- [ ] 自定义重组模板和规则
- [ ] 重组配置导入/导出功能

### 其他功能扩展
- [ ] 代码搜索和替换功能
- [ ] 在线文件编辑器
- [ ] Git版本控制集成
- [ ] 代码比较和差异显示
- [ ] 项目统计分析和报告
- [ ] 多语言界面支持

## �🙏 致谢

- [DeepSeek](https://www.deepseek.com/) - 提供强大的AI分析能力
- [Highlight.js](https://highlightjs.org/) - 代码语法高亮
- [Font Awesome](https://fontawesome.com/) - 优秀的图标库
- [Express.js](https://expressjs.com/) - 快速的Node.js Web框架

---

<p align="center">
  Made with ❤️ for better code exploration experience
</p>

## 扩展功能

可以考虑添加的功能：
- 代码搜索功能
- 文件编辑功能
- Git集成
- 代码比较功能
- 项目统计分析
- 多语言支持

## 故障排除

### 常见问题
1. **服务器启动失败**: 检查Node.js是否正确安装
2. **AI分析失败**: 验证网络连接和API密钥
3. **文件无法显示**: 确认文件路径和权限

### 日志查看
服务器运行时会在终端输出日志信息，可以查看具体的错误信息。

---

**开发者**: FlowMQ Code Viewer  
**版本**: 1.0.0  
**许可证**: MIT
