# 🤖 代码可视化分析器 - AI版本

> 🚀 一个强大的AI驱动代码分析平台，集成智能聊天助手、直接文档编辑、VSCode风格界面和多语言代码运行环境

[![Version](https://img.shields.io/badge/version-1.1.0-brightgreen.svg)](https://github.com/rrrrr9633/code-web-dashboard)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18.x-blue.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-orange.svg)](https://www.sqlite.org/)
[![AI-Powered](https://img.shields.io/badge/AI-DeepSeek-purple.svg)](https://www.deepseek.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ 核心特性

### 🤖 AI智能助手
- **AI直接编辑文档**: 与AI对话直接修改文件内容，实时预览对比
- **VSCode风格聊天界面**: 支持自适应高度输入框、文件图标显示、拖拽调整大小
- **智能上下文理解**: AI自动识别当前文件和项目上下文，提供精准建议
- **取消功能**: 支持中途取消AI分析，避免长时间等待
- **文件操作集成**: 右键文件直接加入AI对话，无缝工作流

### 💻 多语言代码运行环境
- **代码检查**: 支持JavaScript、Python、C++、C、Java、Go、C#、Rust等多种语言的语法检查
- **在线运行**: 直接在浏览器中运行代码，查看输出结果和执行时间
- **环境检测**: 自动检测本地编程语言环境，显示安装状态和安装指南
- **错误诊断**: 详细的语法错误定位和修复建议

### 🎯 智能项目管理
- **多项目支持**: 同时管理和切换多个代码项目
- **拖拽排序**: 支持项目列表的直观拖拽重新排序，持久化保存
- **文件操作**: 完整的文件和文件夹管理功能（创建、删除、重命名、移动、复制）
- **剪贴板系统**: 支持文件复制粘贴操作，可视化剪贴板状态
- **键盘快捷键**: 支持Ctrl+C/V/X、Delete等快捷键操作

### 🎨 现代化界面设计
- **Apple风格设计**: 采用现代glassmorphism效果和渐变设计
- **可调整布局**: 文件树高度、侧边栏宽度均可拖拽调整
- **响应式布局**: 完美适配各种屏幕尺寸，优秀的移动端体验
- **代码语法高亮**: 支持30+编程语言的语法高亮显示
- **智能搜索**: 全项目代码搜索，支持关键词高亮

### 🔐 安全可靠
- **JWT身份验证**: 基于Token的安全认证机制
- **文件路径验证**: 严格的文件访问权限控制
- **API密钥管理**: 安全的AI服务配置和管理
- **SQLite数据库**: 本地化数据存储，保护用户隐私

## 🚀 快速开始

### 环境要求
- Node.js 16.x 或更高版本
- npm 或 yarn 包管理器
- 支持现代JavaScript的浏览器
- 本地编程环境（可选，用于代码运行功能）

### 安装与启动

```bash
# 克隆项目
git clone https://github.com/rrrrr9633/code-web-dashboard.git
cd code-web-dashboard

# 安装依赖
npm install

# 启动服务器
npm start

# 或者使用开发模式（自动重启）
npm run dev
```

### 首次配置

1. 打开浏览器访问 `http://localhost:3000`
2. 使用默认用户名和密码登录系统
3. 配置DeepSeek AI API密钥以启用AI助手功能
4. 添加您的第一个项目开始体验AI智能分析

## 🎮 使用指南

### 🤖 AI智能助手使用
1. **打开AI聊天面板**: 点击顶部的AI聊天按钮
2. **文件上下文加载**: 右键文件选择"加入到AI对话"，文件会以图标形式显示
3. **智能对话**: 
   - 询问当前文件：AI会分析当前打开的文件
   - 创建新文件：说"创建一个C++的Hello World程序"
   - 修改文件：说"修改当前文件，添加注释"
4. **直接编辑**: AI修改文件时会显示对比界面，可选择保留或撤销修改
5. **取消分析**: 分析过程中点击"取消分析"按钮停止AI处理

### 💻 代码运行环境使用
1. **语言环境检查**: 点击"语言环境"按钮查看本地编程环境状态
2. **代码检查**: 选择代码文件后点击"检查代码"查看语法错误
3. **运行代码**: 点击"运行代码"直接执行并查看结果
4. **支持的语言**: JavaScript、Python、C++、C、Java、Go、C#、Rust

### 📁 项目管理
- **添加项目**: 点击"添加项目"或"创建空项目"
- **切换项目**: 在左侧项目列表中点击项目名称
- **拖拽排序**: 鼠标悬停项目上，拖拽左侧手柄(⋮⋮)进行排序
- **项目操作**: 右键项目显示操作菜单

### � 文件操作
1. **基本操作**: 右键文件/文件夹显示上下文菜单
2. **创建**: 新建文件、新建文件夹
3. **编辑**: 重命名、删除
4. **复制粘贴**: 支持Ctrl+C、Ctrl+X、Ctrl+V快捷键
5. **拖拽移动**: 拖拽文件到目标文件夹
6. **剪贴板状态**: 右下角显示当前剪贴板内容

### 🎨 界面调整
- **文件树高度**: 拖拽文件树底部边缘调整高度
- **侧边栏宽度**: 拖拽侧边栏右侧边缘调整宽度
- **聊天面板**: 支持拖拽移动和调整大小
- **快速重置**: 双击调整手柄恢复默认尺寸

## 🏗️ 技术架构

### 前端技术栈
```
HTML5 + CSS3 + Vanilla JavaScript
├── UI框架: 原生JavaScript + 现代CSS
├── 样式: Glassmorphism + Apple设计语言
├── AI集成: Fetch API + AbortController取消机制
├── 拖拽: HTML5 Drag & Drop API
├── 数据存储: localStorage + fetch API
├── 代码高亮: Highlight.js
├── Markdown渲染: Marked.js
└── 图标: Font Awesome
```

### 后端技术栈
```
Node.js + Express.js + SQLite
├── Web框架: Express.js 4.18.x
├── 数据库: SQLite 3.x (用户、项目、聊天历史)
├── AI集成: DeepSeek API + Axios
├── 代码运行: VM2沙箱 + 子进程执行
├── 文件处理: Node.js原生fs模块
├── 身份验证: JWT Token
├── 跨域处理: CORS
└── 多语言支持: 语法检查 + 编译运行
```

### AI智能助手架构
```
DeepSeek API集成
├── 模型: deepseek-chat
├── 功能: 文件分析、创建、修改
├── 上下文: 项目信息 + 文件内容
├── 取消机制: AbortController
├── 聊天历史: SQLite持久化存储
└── 文件操作: 创建、修改、分析三种模式
```

### 代码运行环境架构
```
多语言运行支持
├── JavaScript: VM2沙箱环境
├── Python: python3子进程
├── C/C++: gcc/g++编译 + 可执行文件
├── Java: javac编译 + java运行
├── Go: go run直接运行
├── C#: dotnet script运行
├── Rust: rustc编译 + 可执行文件
└── 安全机制: 超时控制 + 临时文件清理
```

## 📁 项目结构

```
code-web-dashboard/
├── public/                    # 前端静态资源
│   ├── index.html            # 主界面（包含AI聊天面板）
│   ├── login.html            # 登录界面
│   └── app.js               # 前端核心逻辑（7000+行）
│       ├── AI聊天系统        # sendChatMessage, addFileToAIChat
│       ├── 代码运行环境      # checkCode, runCode
│       ├── 文件管理系统      # 文件操作、拖拽、剪贴板
│       ├── 项目拖拽排序      # setupProjectDragAndDrop
│       └── 界面调整功能      # 文件树、侧边栏大小调整
├── dbconfig/                  # 数据库配置和脚本
│   ├── init-db.js           # 数据库初始化
│   ├── cleanup_*.sql        # 清理脚本
│   └── view_database.sql    # 数据库查看脚本
├── update/                    # 项目更新文档
│   ├── DESIGN-UPGRADE.md    # 设计升级说明
│   ├── IMPROVEMENTS.md      # 改进计划
│   ├── PROJECT-DELETE-FIX.md # 项目删除修复
│   ├── PROJECT-DRAG-SORT.md  # 拖拽排序功能说明
│   └── RESTRUCTURE-GUIDE.md # 目录重组指南
├── server.js                  # 后端服务器（5000+行）
│   ├── AI聊天API            # /api/chat 路由
│   ├── 代码运行API          # /api/code/check, /api/code/run
│   ├── 文件操作API          # 文件CRUD操作
│   ├── 用户认证系统         # JWT + SQLite
│   └── 多语言运行环境       # 8种编程语言支持
├── package.json              # 项目配置和依赖
├── project_files.db          # SQLite数据库文件
└── README.md                 # 项目说明（本文件）
```

## ⚙️ 配置说明

### AI服务配置
在系统设置中配置DeepSeek API：
- **API URL**: `https://api.deepseek.com/v1/chat/completions`
- **API Key**: 从DeepSeek官网获取的API密钥
- **模型**: deepseek-chat（自动选择）
- **温度**: 0.3（确保响应准确性）

### 代码运行环境配置
系统自动检测以下编程环境：
- **Node.js**: JavaScript运行环境（内置VM2沙箱）
- **Python3**: Python代码执行环境
- **GCC/G++**: C/C++编译器
- **Java JDK**: Java开发环境
- **Go**: Go语言环境
- **Rust**: Rust编译器
- **.NET**: C#运行环境

### 环境变量（可选）
```bash
# 生产环境建议使用环境变量
DEEPSEEK_API_KEY=your_api_key_here
PORT=3000
NODE_ENV=production
JWT_SECRET=your_jwt_secret
DB_PATH=./project_files.db
```

### 数据库配置
- **数据库类型**: SQLite 3.x
- **数据库文件**: `project_files.db`
- **表结构**: 用户、项目、文件、聊天历史、会话管理
- **初始化脚本**: `dbconfig/init-db.js`
- **清理脚本**: `dbconfig/cleanup_*.sql`

### 服务器配置
- **默认端口**: 3000
- **文件上传限制**: 50MB
- **代码执行超时**: 10秒（可调整）
- **支持的文件类型**: 所有文本文件
- **项目目录**: 支持本地任意目录

## 🔧 高级功能

### 🤖 AI智能助手核心功能
- **上下文感知**: AI自动识别当前项目和文件上下文
- **三种操作模式**:
  - `create_file`: 创建新文件（支持自动命名）
  - `modify_file`: 修改现有文件（实时对比预览）
  - `analyze_file`: 分析文件内容（提供优化建议）
- **取消机制**: 使用AbortController支持中途取消AI分析
- **聊天历史**: SQLite数据库持久化保存对话记录
- **文件图标集成**: 30+文件类型的可视化图标显示

#### AI助手实现原理
```javascript
// 核心AI交互函数
- sendChatMessage()          // 发送消息到AI（支持取消）
- handleAIAction()           // 处理AI返回的操作指令
- addFileToAIChat()          // 添加文件到对话上下文
- showFileEditDialog()       // 显示文件编辑对比界面
```

### 💻 多语言代码运行环境
- **沙箱安全**: JavaScript使用VM2沙箱，防止恶意代码执行
- **编译链支持**: 自动处理C/C++、Java、Rust的编译过程
- **实时输出**: 支持程序实时输出和错误信息显示
- **输入支持**: 支持需要用户输入的交互式程序
- **临时文件管理**: 自动清理编译和运行产生的临时文件

#### 支持的语言和检查功能
```javascript
// 语法检查函数
- checkJavaScript()      // JS语法检查 + 静态分析
- checkPython()          // Python语法检查
- checkCpp()            // C++语法检查 + 编码规范
- checkC()              // C语法检查
- checkJava()           // Java语法检查 + 类名验证
- checkGo()             // Go语法检查 + 包管理
- checkRust()           // Rust语法检查
- checkCSharp()         // C#语法检查
```

### 📂 完整文件管理系统
- **剪贴板系统**: 支持复制、剪切、粘贴操作
- **拖拽移动**: HTML5拖拽API实现文件移动
- **键盘快捷键**: Ctrl+C/V/X、Delete、F1等快捷键
- **上下文菜单**: 右键文件显示完整操作菜单
- **视觉反馈**: 操作过程中的动画效果和状态提示

#### 文件操作实现原理
```javascript
// 文件管理核心函数
- copyItem() / cutItem()     // 复制和剪切文件
- pasteItem()               // 粘贴文件到目标位置
- moveItemToFolder()        // 拖拽移动文件
- addContextMenuToTreeItem() // 添加右键菜单
- updateClipboardStatus()   // 更新剪贴板状态显示
```

### 🎪 项目拖拽排序系统
- **HTML5拖拽**: 基于原生Drag & Drop API
- **视觉反馈**: 拖拽过程中的半透明效果和目标高亮
- **数据持久化**: localStorage存储排序，页面刷新不丢失
- **错误恢复**: 完善的拖拽失败恢复机制
- **性能优化**: 事件委托和防抖处理

#### 拖拽排序实现原理
```javascript
// 拖拽排序核心函数
- setupProjectDragAndDrop()  // 设置拖拽事件监听
- handleDragStart()          // 开始拖拽处理
- handleDrop()              // 拖拽放置处理
- saveProjectOrder()        // 保存排序到localStorage
- loadProjectOrder()        // 从localStorage加载排序
```

### 🎨 界面调整系统
- **文件树高度调整**: 拖拽底部边缘调整显示高度（200px-800px）
- **侧边栏宽度调整**: 拖拽右侧边缘调整整体宽度（280px-800px）
- **聊天面板**: 支持拖拽移动和调整大小，可停靠
- **双击重置**: 所有调整手柄支持双击快速恢复默认尺寸
- **设置持久化**: 所有界面调整自动保存到localStorage

### 🔐 安全特性
- **JWT身份验证**: 基于Token的无状态认证
- **路径验证**: 严格防止目录遍历攻击
- **API频率限制**: 防止AI接口滥用
- **沙箱执行**: 代码运行在隔离环境中
- **临时文件清理**: 自动清理运行产生的临时文件
- **请求取消**: 支持取消长时间的AI请求

## 🧪 功能测试指南

### 🤖 AI智能助手测试
1. **基本对话测试**:
   ```
   打开AI聊天面板 → 发送问候消息 → 验证AI响应
   ```

2. **文件分析测试**:
   ```
   右键选择文件 → 加入AI对话 → 询问"这是什么文件" → 验证分析结果
   ```

3. **文件创建测试**:
   ```
   对AI说"创建一个Hello World的Python文件" → 验证文件创建对话框 → 确认创建
   ```

4. **文件修改测试**:
   ```
   打开文件 → 对AI说"修改当前文件，添加注释" → 验证对比界面 → 选择保留/撤销
   ```

5. **取消功能测试**:
   ```
   发送复杂请求 → 在分析过程中点击"取消分析" → 验证请求被中止
   ```

### 💻 代码运行环境测试
1. **语言环境检测**:
   ```
   点击"语言环境"按钮 → 查看支持的语言 → 验证安装状态显示
   ```

2. **代码检查测试**:
   ```
   创建带语法错误的代码 → 点击"检查代码" → 验证错误定位和提示
   ```

3. **代码运行测试**:
   ```
   编写简单程序 → 点击"运行代码" → 验证输出结果和执行时间
   ```

4. **多语言支持测试**:
   ```
   分别测试JavaScript、Python、C++、Java等语言的运行
   ```

### 📂 文件管理系统测试
1. **基本文件操作**:
   ```
   右键文件 → 测试重命名、删除、复制等操作
   ```

2. **剪贴板功能测试**:
   ```
   Ctrl+C复制文件 → Ctrl+V粘贴到其他位置 → 验证剪贴板状态显示
   ```

3. **拖拽移动测试**:
   ```
   拖拽文件到不同文件夹 → 验证移动成功 → 测试拖拽到根目录
   ```

4. **键盘快捷键测试**:
   ```
   选择文件 → 使用Delete删除 → F1查看帮助 → Escape清空剪贴板
   ```

### 🎪 项目拖拽排序测试
1. **基本拖拽测试**:
   ```
   添加多个项目 → 拖拽项目到不同位置 → 验证排序结果
   ```

2. **持久化测试**:
   ```
   拖拽排序 → 刷新页面 → 验证排序保持不变
   ```

3. **边界测试**:
   ```
   拖拽到第一位 → 拖拽到最后一位 → 拖拽到相同位置
   ```

### 🎨 界面调整测试
1. **文件树高度调整**:
   ```
   拖拽文件树底部边缘 → 验证高度变化 → 双击重置 → 验证设置保存
   ```

2. **侧边栏宽度调整**:
   ```
   拖拽侧边栏右侧边缘 → 验证宽度变化 → 双击重置 → 验证设置保存
   ```

3. **聊天面板测试**:
   ```
   拖拽聊天面板移动 → 调整面板大小 → 验证位置和尺寸记忆
   ```

## 🔍 API接口文档

### 项目管理API
```http
GET    /api/projects              # 获取所有项目
POST   /api/projects              # 添加新项目
PUT    /api/projects/:id          # 更新项目信息
DELETE /api/projects/:id          # 删除项目
```

### 文件操作API
```http
GET    /api/projects/:id/files    # 获取项目文件列表
GET    /api/projects/:id/files/:path  # 获取文件内容
PUT    /api/projects/:id/files/:path  # 保存文件内容
POST   /api/projects/:id/files    # 创建新文件
DELETE /api/projects/:id/files/:path  # 删除文件
PATCH  /api/projects/:id/files/:path  # 移动/重命名文件
```

### AI聊天API
```http
POST   /api/chat                 # 发送消息给AI助手
GET    /api/chat/history         # 获取聊天历史记录
POST   /api/chat/save            # 保存聊天会话
DELETE /api/chat/history/:id     # 删除指定聊天记录
DELETE /api/chat/history         # 清空所有聊天记录
```

### 代码运行API
```http
POST   /api/code/check           # 代码语法检查
POST   /api/code/run             # 运行代码
GET    /api/languages/environment # 检测编程语言环境
```

### 用户认证API
```http
POST   /api/login               # 用户登录
POST   /api/logout              # 用户登出
GET    /api/profile             # 获取用户信息
PUT    /api/profile             # 更新用户信息（AI配置）
```

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
- 拖拽功能相关代码需要完整的错误处理

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 🛣️ 版本更新历史

### v1.1.0 (2025-01-24) - AI增强版本 🤖
- ✨ **重大新增**: AI智能助手集成，支持直接编辑文档
- 🎨 **界面革新**: VSCode风格聊天界面，支持拖拽调整大小
- 💬 **智能对话**: 支持文件上下文分析、创建和修改文件
- 🚫 **取消机制**: 使用AbortController支持中途取消AI分析
- 💻 **代码运行**: 集成多语言代码检查和运行环境
- 📂 **文件管理**: 完整的文件操作系统（复制、粘贴、拖拽、剪贴板）
- ⌨️ **快捷键**: 支持Ctrl+C/V/X、Delete、F1等键盘快捷键
- 💾 **聊天历史**: SQLite数据库持久化保存对话记录
- 🎯 **文件图标**: 30+文件类型的可视化图标显示系统

### v1.0.3 (2025-01-23) - 文件树增强版本 📏
- ✨ **新增**: 文件树高度可拖拽调整功能（200px-800px）
- ✨ **新增**: 侧边栏宽度可拖拽调整功能（280px-800px）
- 🎨 **优化**: 文件树展开/折叠控制按钮
- 💾 **增强**: 文件树高度和侧边栏宽度设置持久化保存
- 📱 **响应式**: 移动端自适应布局优化
- 🔧 **改进**: 界面美化和用户体验全面提升

### v1.0.2 (2025-01-23) - 拖拽排序版本 🎪
- ✨ **新增**: 项目列表拖拽排序功能
- 🎨 **优化**: 拖拽视觉反馈和动画效果
- 💾 **增强**: localStorage数据持久化
- 🐛 **修复**: 双向拖拽排序逻辑
- 📚 **文档**: 完善拖拽功能使用说明

### v1.0.1 - 目录重组版本 🔄
- ✨ **新增**: AI目录重组功能
- 🧠 **集成**: DeepSeek AI分析
- 🔄 **优化**: 重复分析检测
- 🎨 **升级**: 界面设计优化

### v1.0.0 - 基础版本 🚀
- 🚀 **基础**: 项目管理功能
- 📁 **文件**: 文件浏览和代码高亮
- 🔐 **认证**: JWT身份验证
- 💾 **数据**: SQLite数据库集成

## 🔮 未来规划

### AI助手功能扩展 🤖
- [ ] 支持更多AI模型（GPT-4、Claude、Gemini等）
- [ ] AI代码重构和优化建议
- [ ] 智能代码补全和生成
- [ ] AI驱动的代码审查和质量分析
- [ ] 自然语言转代码功能
- [ ] AI项目架构设计建议

### 代码运行环境扩展 💻
- [ ] 支持更多编程语言（PHP、Ruby、Kotlin、Swift等）
- [ ] Docker容器化运行环境
- [ ] 云端代码执行服务集成
- [ ] 代码性能分析和基准测试
- [ ] 多文件项目编译和运行
- [ ] 代码调试器集成

### 文件管理系统扩展 📂
- [ ] Git版本控制集成
- [ ] 文件比较和差异显示
- [ ] 文件搜索和替换功能
- [ ] 批量文件操作
- [ ] 文件加密和权限管理
- [ ] 云存储同步功能

### 界面和交互扩展 🎨
- [ ] 暗色主题模式
- [ ] 多标签页编辑器
- [ ] 分屏显示功能
- [ ] 可定制的工作区布局
- [ ] 键盘快捷键自定义
- [ ] 插件系统和扩展市场

### 协作和分享功能 🤝
- [ ] 实时协作编辑
- [ ] 项目分享和权限管理
- [ ] 代码片段分享社区
- [ ] 团队工作空间
- [ ] 代码审查工作流
- [ ] 集成项目管理工具

## 🙏 致谢

- [DeepSeek](https://www.deepseek.com/) - 提供强大的AI分析能力
- [Highlight.js](https://highlightjs.org/) - 代码语法高亮
- [Font Awesome](https://fontawesome.com/) - 优秀的图标库
- [Express.js](https://expressjs.com/) - 快速的Node.js Web框架
- [SQLite](https://www.sqlite.org/) - 轻量级数据库引擎

## 🆘 故障排除

### 常见问题
1. **服务器启动失败**: 检查Node.js版本（需要16.x+）和端口占用
2. **AI助手无响应**: 验证网络连接和DeepSeek API密钥配置
3. **文件无法显示**: 确认文件路径权限和文件编码
4. **代码运行失败**: 检查对应编程语言环境是否正确安装
5. **拖拽功能不工作**: 检查浏览器是否支持HTML5 Drag & Drop API
6. **项目排序丢失**: 检查浏览器localStorage是否被清除
7. **界面调整功能失效**: 确认浏览器支持CSS3和现代JavaScript
8. **聊天历史丢失**: 检查SQLite数据库连接和权限

### AI助手调试
```javascript
// 在浏览器控制台中检查AI功能
console.log('AI助手调试信息：');
console.log('当前文件上下文：', window.currentFileContext);
console.log('聊天会话ID：', currentChatSession);
// 查看详细的AI交互日志
```

### 代码运行环境调试
1. **检查语言环境**:
   ```bash
   # 检查各种编程语言是否正确安装
   node --version
   python3 --version
   gcc --version
   java -version
   go version
   ```

2. **查看运行日志**:
   服务器会输出详细的代码执行日志，包括编译过程和错误信息

### 文件操作调试
```javascript
// 检查文件操作权限
// 在浏览器控制台查看剪贴板状态
console.log('剪贴板状态：', clipboard);
console.log('拖拽状态：', draggedItem);
```

### 数据库问题解决
```bash
# 检查SQLite数据库
cd /path/to/project
sqlite3 project_files.db ".tables"
sqlite3 project_files.db "SELECT COUNT(*) FROM users;"
```

### 性能优化建议
- **定期清理数据库**: 删除不需要的聊天历史和临时数据
- **限制项目数量**: 建议同时管理的项目数量不超过50个
- **清理临时文件**: 定期清理代码运行产生的临时文件
- **浏览器缓存**: 清理浏览器缓存以解决界面问题
- **内存使用**: 监控Node.js进程内存使用，必要时重启服务

### 网络问题解决
1. **AI API连接失败**: 检查防火墙设置和网络代理
2. **请求超时**: 增加请求超时时间或检查网络稳定性
3. **API密钥错误**: 重新获取和配置DeepSeek API密钥

### 日志查看
服务器运行时会在终端输出详细日志信息：
- AI交互的完整流程
- 代码运行的详细过程
- 文件操作记录
- 数据库操作记录
- API请求和响应
- 错误信息和堆栈跟踪

---

<p align="center">
  <strong>🤖 Made with AI-Powered Development Experience</strong><br>
  <em>智能助手驱动的代码开发和分析平台</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AI-Powered-purple" alt="AI Powered">
  <img src="https://img.shields.io/badge/Multi--Language-Support-green" alt="Multi Language">
  <img src="https://img.shields.io/badge/VSCode-Style-blue" alt="VSCode Style">
  <img src="https://img.shields.io/badge/Real--Time-Chat-orange" alt="Real Time Chat">
</p>

<p align="center">
  <a href="https://github.com/rrrrr9633/code-web-dashboard">⭐ 如果这个项目对您有帮助，请给我们一个星标！</a>
</p>

<p align="center">
  <strong>版本 1.1.0 (AI-Version) | 2025年1月24日发布</strong>
</p>
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
