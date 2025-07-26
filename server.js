const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt'); // 新增密码哈希支持

const app = express();
const PORT = 3000;

// 初始化SQLite数据库
const dbPath = path.join(__dirname, 'project_files.db');
const db = new sqlite3.Database(dbPath);

// 启用外键约束
db.run("PRAGMA foreign_keys = ON");

// 创建数据库表
db.serialize(() => {
    // 用户表 - 新增
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        ai_api_url TEXT,
        ai_api_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // 为已存在的users表添加AI配置字段（如果不存在）
    db.run(`ALTER TABLE users ADD COLUMN ai_api_url TEXT`, (err) => {
        // 忽略错误，字段可能已存在
    });
    db.run(`ALTER TABLE users ADD COLUMN ai_api_key TEXT`, (err) => {
        // 忽略错误，字段可能已存在
    });
    db.run(`ALTER TABLE users ADD COLUMN ai_model TEXT`, (err) => {
        // 忽略错误，字段可能已存在
    });
    
    // 用户会话表 - 新增
    db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);
    
    // 项目表 - 添加用户关联
    db.run(`CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);
    
    // 项目文件表
    db.run(`CREATE TABLE IF NOT EXISTS project_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT,
        size INTEGER,
        last_modified INTEGER,
        extension TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        UNIQUE(project_id, file_path)
    )`);
    
    // 项目结构表
    db.run(`CREATE TABLE IF NOT EXISTS project_structures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        structure_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        UNIQUE(project_id)
    )`);
    
    // 项目重组配置表
    db.run(`CREATE TABLE IF NOT EXISTS project_restructure_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        config_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        UNIQUE(project_id)
    )`);
    
    // AI对话历史记录表
    db.run(`CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        chat_session_id TEXT NOT NULL,
        messages TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);
});

console.log('数据库初始化完成:', dbPath);

// 项目管理 - 使用数据库存储
let projects = [];
let projectFiles = new Map(); // 临时缓存，主要存储在数据库中
let projectRestructureConfigs = new Map(); // 临时缓存，主要存储在数据库中

// 用户认证管理
const SALT_ROUNDS = 10;

// 生成会话token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 验证用户会话
async function verifyUserSession(sessionToken) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT us.*, u.username, u.id as user_id 
             FROM user_sessions us 
             JOIN users u ON us.user_id = u.id 
             WHERE us.session_token = ? AND us.expires_at > datetime('now')`,
            [sessionToken],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            }
        );
    });
}

// 认证中间件 - 更新为多用户支持
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '需要认证token' });
        }

        const token = authHeader.substring(7);
        const userSession = await verifyUserSession(token);
        
        if (!userSession) {
            return res.status(401).json({ error: '无效或过期的认证token' });
        }

        // 将用户信息添加到请求对象
        req.user = {
            id: userSession.user_id,
            user_id: userSession.user_id, // 添加这个字段以保持向后兼容
            username: userSession.username,
            sessionToken: token
        };
        
        next();
    } catch (error) {
        console.error('认证失败:', error);
        res.status(500).json({ error: '认证失败' });
    }
}
// 从数据库加载特定用户的项目列表
function loadProjectsFromDB(userId = null) {
    return new Promise((resolve, reject) => {
        let query = "SELECT * FROM projects ORDER BY created_at DESC";
        let params = [];
        
        if (userId) {
            query = "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC";
            params = [userId];
        }
        
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('加载项目失败:', err);
                reject(err);
            } else {
                if (!userId) {
                    // 全局加载时更新projects数组
                    projects = rows;
                    console.log(`从数据库加载了 ${projects.length} 个项目`);
                }
                resolve(rows);
            }
        });
    });
}

// 启动时加载项目
loadProjectsFromDB().catch(console.error);

// 中间件
app.use(cors());
app.use(express.json({ limit: '2gb' })); // 增加JSON负载限制到2GB
app.use(express.urlencoded({ limit: '2gb', extended: true })); // 增加URL编码限制到2GB
app.use(express.static(path.join(__dirname, 'public')));

// 登录页面路由
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 检查用户AI配置状态API
app.post('/api/users/check-ai-config', (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: '用户名不能为空' });
        }
        
        db.get("SELECT ai_api_url, ai_api_key FROM users WHERE username = ?", [username], (err, user) => {
            if (err) {
                console.error('查询用户AI配置失败:', err);
                return res.status(500).json({ error: '查询失败' });
            }
            
            if (!user) {
                return res.json({ hasAiConfig: false });
            }
            
            const hasAiConfig = !!(user.ai_api_url && user.ai_api_key);
            res.json({ hasAiConfig });
        });
    } catch (error) {
        console.error('检查AI配置失败:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 用户注册API
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        if (username.length < 3 || password.length < 6) {
            return res.status(400).json({ error: '用户名至少3位，密码至少6位' });
        }
        
        // 检查用户名是否已存在
        db.get("SELECT id FROM users WHERE username = ?", [username], async (err, existing) => {
            if (err) {
                console.error('查询用户失败:', err);
                return res.status(500).json({ error: '查询用户失败' });
            }
            
            if (existing) {
                return res.status(409).json({ error: '用户名已存在' });
            }
            
            try {
                // 哈希密码
                const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
                
                // 创建用户
                db.run(
                    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                    [username, passwordHash],
                    function(err) {
                        if (err) {
                            console.error('创建用户失败:', err);
                            return res.status(500).json({ error: '创建用户失败' });
                        }
                        
                        console.log(`新用户注册成功: ${username} (ID: ${this.lastID})`);
                        res.json({
                            message: '注册成功',
                            userId: this.lastID,
                            username: username
                        });
                    }
                );
            } catch (hashError) {
                console.error('密码哈希失败:', hashError);
                res.status(500).json({ error: '密码处理失败' });
            }
        });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '注册失败' });
    }
});

// 用户登录API
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, aiConfig } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        // 查找用户
        db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
            if (err) {
                console.error('查询用户失败:', err);
                return res.status(500).json({ error: '登录失败' });
            }
            
            if (!user) {
                return res.status(401).json({ error: '用户名或密码错误' });
            }
            
            try {
                // 验证密码
                const isValidPassword = await bcrypt.compare(password, user.password_hash);
                
                if (!isValidPassword) {
                    return res.status(401).json({ error: '用户名或密码错误' });
                }
                
                // 如果提供了AI配置，则保存
                if (aiConfig && aiConfig.apiUrl && aiConfig.apiKey) {
                    db.run(
                        "UPDATE users SET ai_api_url = ?, ai_api_key = ? WHERE id = ?",
                        [aiConfig.apiUrl, aiConfig.apiKey, user.id],
                        (updateErr) => {
                            if (updateErr) {
                                console.error('保存AI配置失败:', updateErr);
                            } else {
                                console.log(`用户 ${username} AI配置已保存`);
                            }
                        }
                    );
                }
                
                // 生成会话token
                const sessionToken = generateSessionToken();
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
                
                // 保存会话
                db.run(
                    "INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)",
                    [user.id, sessionToken, expiresAt.toISOString()],
                    function(err) {
                        if (err) {
                            console.error('创建会话失败:', err);
                            return res.status(500).json({ error: '登录失败' });
                        }
                        
                        console.log(`用户登录成功: ${username} (ID: ${user.id})`);
                        
                        // 准备响应数据
                        const responseData = {
                            success: true,
                            message: '登录成功',
                            token: sessionToken,
                            user: {
                                id: user.id,
                                username: user.username
                            },
                            expiresAt: expiresAt.toISOString()
                        };
                        
                        // 如果用户已有AI配置，返回配置信息
                        if (user.ai_api_url && user.ai_api_key) {
                            responseData.aiConfig = {
                                apiUrl: user.ai_api_url,
                                apiKey: user.ai_api_key
                            };
                        } else if (aiConfig && aiConfig.apiUrl && aiConfig.apiKey) {
                            // 如果是新配置，也返回
                            responseData.aiConfig = aiConfig;
                        }
                        
                        res.json(responseData);
                    }
                );
            } catch (bcryptError) {
                console.error('密码验证失败:', bcryptError);
                res.status(500).json({ error: '登录失败' });
            }
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

// 用户登出API
app.post('/api/logout', requireAuth, (req, res) => {
    try {
        db.run(
            "DELETE FROM user_sessions WHERE session_token = ?",
            [req.user.sessionToken],
            function(err) {
                if (err) {
                    console.error('登出失败:', err);
                    return res.status(500).json({ error: '登出失败' });
                }
                
                console.log(`用户登出: ${req.user.username}`);
                res.json({ message: '登出成功' });
            }
        );
    } catch (error) {
        console.error('登出失败:', error);
        res.status(500).json({ error: '登出失败' });
    }
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// AI配置管理 - 移除硬编码密钥
let userAIConfig = {
    apiUrl: null,
    apiKey: null,
    isConfigured: false,
    lastValidated: null
};

// 会话管理已迁移到数据库，不再使用内存存储

// 生成会话令牌
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}
// 项目管理API

// 识别AI服务提供商
function identifyAIProvider(apiUrl) {
    if (!apiUrl) return 'Unknown';
    
    const url = apiUrl.toLowerCase();
    if (url.includes('deepseek')) return 'DeepSeek';
    if (url.includes('openai') || url.includes('api.openai.com')) return 'OpenAI';
    if (url.includes('anthropic') || url.includes('claude')) return 'Anthropic (Claude)';
    if (url.includes('gemini') || url.includes('googleapis')) return 'Google Gemini';
    if (url.includes('cohere')) return 'Cohere';
    if (url.includes('huggingface')) return 'Hugging Face';
    if (url.includes('replicate')) return 'Replicate';
    if (url.includes('together')) return 'Together AI';
    if (url.includes('groq')) return 'Groq';
    
    // 尝试从域名提取服务名
    try {
        const domain = new URL(apiUrl).hostname;
        const parts = domain.split('.');
        if (parts.length >= 2) {
            return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
        }
    } catch (e) {
        // 忽略URL解析错误
    }
    
    return 'Custom API';
}

// 根据API URL获取对应的默认模型
function getModelForProvider(apiUrl) {
    if (!apiUrl) return 'gpt-3.5-turbo'; // 默认模型
    
    const url = apiUrl.toLowerCase();
    if (url.includes('deepseek')) return 'deepseek-chat';
    if (url.includes('openai') || url.includes('api.openai.com')) return 'gpt-3.5-turbo';
    if (url.includes('anthropic') || url.includes('claude')) return 'claude-3-sonnet-20240229';
    if (url.includes('gemini') || url.includes('googleapis')) return 'gemini-pro';
    if (url.includes('groq')) return 'mixtral-8x7b-32768';
    
    // 默认使用 OpenAI 兼容格式
    return 'gpt-3.5-turbo';
}

// 检查AI配置状态
app.get('/api/ai-config/status', requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`检查用户 ${userId} 的AI配置状态`);
        
        // 从数据库获取用户的AI配置
        db.get("SELECT ai_api_url, ai_api_key, ai_model FROM users WHERE id = ?", [userId], (err, user) => {
            if (err) {
                console.error('查询用户AI配置失败:', err);
                return res.status(500).json({ error: '查询配置失败' });
            }
            
            const hasAiConfig = !!(user && user.ai_api_url && user.ai_api_key);
            console.log(`用户 ${userId} AI配置状态: ${hasAiConfig}, URL: ${user?.ai_api_url}, Key存在: ${!!user?.ai_api_key}, Model: ${user?.ai_model}`);
            
            res.json({
                configured: hasAiConfig,
                config: hasAiConfig ? {
                    apiUrl: user.ai_api_url,
                    model: user.ai_model,
                    provider: identifyAIProvider(user.ai_api_url),
                    lastValidated: new Date().toISOString()
                } : null
            });
        });
    } catch (error) {
        console.error('检查AI配置状态失败:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 配置AI API
app.post('/api/ai-config', async (req, res) => {
    try {
        const { apiUrl, apiKey } = req.body;
        
        if (!apiUrl || !apiKey) {
            return res.status(400).json({ error: 'API URL和API Key都是必需的' });
        }
        
        // 验证API配置
        const testResult = await testAIConnection(apiUrl, apiKey);
        if (!testResult.success) {
            return res.status(400).json({ 
                error: 'AI API配置验证失败', 
                details: testResult.error 
            });
        }
        
        // 保存配置（生产环境应加密存储）
        userAIConfig = {
            apiUrl: apiUrl.trim(),
            apiKey: apiKey.trim(),
            isConfigured: true,
            lastValidated: new Date().toISOString()
        };
        
        // 生成会话令牌
        const sessionToken = generateSessionToken();
        userSessions.set(sessionToken, {
            configuredAt: new Date(),
            lastAccess: new Date(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24小时过期
        });
        
        res.json({ 
            success: true, 
            message: 'AI配置验证成功',
            sessionToken,
            config: {
                apiUrl: userAIConfig.apiUrl.replace(/\/[^\/]*$/, '/***'),
                lastValidated: userAIConfig.lastValidated
            }
        });
        
        console.log('AI配置已更新并验证成功');
    } catch (error) {
        console.error('配置AI API失败:', error);
        res.status(500).json({ error: '配置AI API失败' });
    }
});

// 更新AI配置（用于修改密钥）
app.put('/api/ai-config', requireAuth, async (req, res) => {
    try {
        const { apiUrl, apiKey, model } = req.body;
        const userId = req.user.id;
        
        if (!apiUrl || !apiKey) {
            return res.status(400).json({ error: 'API URL和API Key都是必需的' });
        }
        
        // 验证新的API配置
        const testResult = await testAIConnection(apiUrl, apiKey, model);
        if (!testResult.success) {
            return res.status(400).json({ 
                error: 'AI API配置验证失败', 
                details: testResult.error 
            });
        }
        
        // 更新数据库中的AI配置（添加模型字段）
        db.run(
            "UPDATE users SET ai_api_url = ?, ai_api_key = ?, ai_model = ? WHERE id = ?",
            [apiUrl.trim(), apiKey.trim(), model || null, userId],
            function(err) {
                if (err) {
                    console.error('更新用户AI配置失败:', err);
                    return res.status(500).json({ error: '保存AI配置失败' });
                }
                
                res.json({ 
                    success: true, 
                    message: 'AI配置更新成功',
                    config: {
                        apiUrl: apiUrl,
                        model: model,
                        provider: identifyAIProvider(apiUrl),
                        lastValidated: new Date().toISOString()
                    }
                });
                
                console.log(`用户 ${req.user.username} AI配置已更新为 ${identifyAIProvider(apiUrl)} ${model ? `(模型: ${model})` : ''}`);
            }
        );
        
    } catch (error) {
        console.error('更新AI配置失败:', error);
        res.status(500).json({ error: '更新AI配置失败' });
    }
});

// 获取项目列表 - 多用户支持
app.get('/api/projects', requireAuth, (req, res) => {
    try {
        // 从数据库获取当前用户的项目列表
        db.all("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC", [req.user.id], (err, rows) => {
            if (err) {
                console.error('获取项目列表失败:', err);
                return res.status(500).json({ error: '获取项目列表失败' });
            }
            res.json(rows);
        });
    } catch (error) {
        console.error('获取项目列表失败:', error);
        res.status(500).json({ error: '获取项目列表失败' });
    }
});

// 添加新项目 - 存储到数据库（多用户支持）
app.post('/api/projects', requireAuth, (req, res) => {
    try {
        const { name, path: projectPath, description, isEmpty } = req.body;
        
        if (!name || !projectPath) {
            return res.status(400).json({ error: '项目名称和路径不能为空' });
        }
        
        // 检查当前用户是否已经存在同名项目
        db.get("SELECT id FROM projects WHERE name = ? AND user_id = ?", [name, req.user.id], (err, row) => {
            if (err) {
                console.error('检查项目名称失败:', err);
                return res.status(500).json({ error: '检查项目名称失败' });
            }
            
            if (row) {
                return res.status(400).json({ error: '您已有同名项目' });
            }
            
            // 创建新项目
            const newProject = {
                id: generateProjectId(name),
                user_id: req.user.id, // 关联到当前用户
                name,
                path: projectPath,
                description: description || `${name} 项目`,
                is_empty: isEmpty || false,
                created_at: new Date().toISOString()
            };
            
            // 插入到数据库
            db.run(
                "INSERT INTO projects (id, user_id, name, path, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                [newProject.id, newProject.user_id, newProject.name, newProject.path, newProject.description, newProject.created_at],
                function(err) {
                    if (err) {
                        console.error('添加项目失败:', err);
                        return res.status(500).json({ error: '添加项目失败' });
                    }
                    
                    // 如果是空项目，创建一个默认的项目结构
                    if (isEmpty) {
                        const defaultStructure = [
                            {
                                name: 'README.md',
                                type: 'file',
                                path: 'README.md',
                                extension: '.md'
                            }
                        ];
                        
                        // 保存默认结构
                        db.run(
                            "INSERT OR REPLACE INTO project_structures (project_id, structure_data, updated_at) VALUES (?, ?, ?)",
                            [newProject.id, JSON.stringify(defaultStructure), new Date().toISOString()],
                            (structureErr) => {
                                if (structureErr) {
                                    console.error('保存默认结构失败:', structureErr);
                                }
                            }
                        );
                        
                        // 创建默认的README文件
                        const readmeContent = `# ${name}\n\n${description || '这是一个新项目'}\n\n## 开始使用\n\n欢迎开始你的项目开发！\n`;
                        db.run(
                            "INSERT INTO project_files (project_id, file_path, content, size, last_modified, extension) VALUES (?, ?, ?, ?, ?, ?)",
                            [newProject.id, 'README.md', readmeContent, Buffer.byteLength(readmeContent, 'utf8'), Date.now(), '.md'],
                            (fileErr) => {
                                if (fileErr) {
                                    console.error('创建默认README文件失败:', fileErr);
                                }
                            }
                        );
                    }
                    
                    res.json(newProject);
                    console.log(`用户 ${req.user.username} ${isEmpty ? '创建了空项目' : '添加了项目'} "${name}":`, projectPath);
                }
            );
        });
    } catch (error) {
        console.error('添加项目失败:', error);
        res.status(500).json({ error: '添加项目失败' });
    }
});

// 上传项目文件内容 - 存储到数据库
app.post('/api/projects/:id/upload', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        const { files, structure, isLastBatch } = req.body;
        
        console.log(`收到文件上传请求: ${projectId}, 文件数: ${files?.length || 0}, 是否最后一批: ${isLastBatch}`);
        
        // 检查项目是否存在且属于当前用户
        db.get("SELECT id, name FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id], (err, project) => {
            if (err) {
                console.error('检查项目失败:', err);
                return res.status(500).json({ error: '检查项目失败' });
            }
            
            if (!project) {
                return res.status(404).json({ error: '项目不存在或无权限访问' });
            }
            
            // 开始数据库事务
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                
                let completed = 0;
                let hasError = false;
                
                // 存储文件到数据库
                if (files && Array.isArray(files)) {
                    files.forEach(file => {
                        db.run(
                            `INSERT OR REPLACE INTO project_files 
                             (project_id, file_path, content, size, last_modified, extension) 
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [
                                projectId,
                                file.path,
                                file.content,
                                file.size || file.content.length,
                                file.lastModified || Date.now(),
                                getFileExtension(file.path)
                            ],
                            function(err) {
                                if (err && !hasError) {
                                    hasError = true;
                                    console.error('插入文件失败:', err);
                                    db.run("ROLLBACK");
                                    return res.status(500).json({ error: '存储文件失败' });
                                }
                                
                                completed++;
                                if (completed === files.length && !hasError) {
                                    // 如果有结构信息，保存结构
                                    if (structure && structure.length > 0) {
                                        db.run(
                                            `INSERT OR REPLACE INTO project_structures 
                                             (project_id, structure_data, updated_at) 
                                             VALUES (?, ?, ?)`,
                                            [projectId, JSON.stringify(structure), new Date().toISOString()],
                                            function(err) {
                                                if (err) {
                                                    console.error('保存结构失败:', err);
                                                    db.run("ROLLBACK");
                                                    return res.status(500).json({ error: '保存结构失败' });
                                                }
                                                
                                                db.run("COMMIT");
                                                
                                                // 获取文件总数
                                                db.get(
                                                    "SELECT COUNT(*) as count FROM project_files WHERE project_id = ?",
                                                    [projectId],
                                                    (err, row) => {
                                                        const totalFiles = row ? row.count : 0;
                                                        res.json({ 
                                                            success: true, 
                                                            message: isLastBatch ? '项目上传完成' : '批次上传成功',
                                                            filesCount: totalFiles,
                                                            projectId: projectId
                                                        });
                                                        console.log(`项目 ${projectId} 当前文件数: ${totalFiles}`);
                                                    }
                                                );
                                            }
                                        );
                                    } else {
                                        db.run("COMMIT");
                                        
                                        // 获取文件总数
                                        db.get(
                                            "SELECT COUNT(*) as count FROM project_files WHERE project_id = ?",
                                            [projectId],
                                            (err, row) => {
                                                const totalFiles = row ? row.count : 0;
                                                res.json({ 
                                                    success: true, 
                                                    message: isLastBatch ? '项目上传完成' : '批次上传成功',
                                                    filesCount: totalFiles,
                                                    projectId: projectId
                                                });
                                                console.log(`项目 ${projectId} 当前文件数: ${totalFiles}`);
                                            }
                                        );
                                    }
                                }
                            }
                        );
                    });
                } else {
                    db.run("COMMIT");
                    res.json({ 
                        success: true, 
                        message: '批次完成（无文件）',
                        filesCount: 0,
                        projectId: projectId
                    });
                }
            });
        });
    } catch (error) {
        console.error('上传文件失败:', error);
        res.status(500).json({ error: '上传文件失败' });
    }
});

// 获取项目文件列表 - 从数据库读取
app.get('/api/projects/:id/files', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        
        // 获取项目结构
        db.get(
            "SELECT structure_data FROM project_structures WHERE project_id = ?",
            [projectId],
            (err, structureRow) => {
                if (err) {
                    console.error('获取项目结构失败:', err);
                    return res.status(500).json({ error: '获取项目结构失败' });
                }
                
                // 获取文件列表
                db.all(
                    "SELECT file_path, size, last_modified, extension FROM project_files WHERE project_id = ?",
                    [projectId],
                    (err, fileRows) => {
                        if (err) {
                            console.error('获取文件列表失败:', err);
                            return res.status(500).json({ error: '获取文件列表失败' });
                        }
                        
                        const structure = structureRow ? JSON.parse(structureRow.structure_data) : [];
                        const files = fileRows.map(row => ({
                            path: row.file_path,
                            size: row.size,
                            lastModified: row.last_modified,
                            extension: row.extension
                        }));
                        
                        res.json({ structure, files });
                    }
                );
            }
        );
    } catch (error) {
        console.error('获取文件列表失败:', error);
        res.status(500).json({ error: '获取文件列表失败' });
    }
});

// 获取特定文件内容 - 从数据库读取
app.get('/api/projects/:id/files/*', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        const filePath = req.params[0];
        
        console.log(`获取文件请求: 项目=${projectId}, 路径=${filePath}`);
        
        // 首先尝试直接匹配路径
        db.get(
            "SELECT * FROM project_files WHERE project_id = ? AND file_path = ?",
            [projectId, filePath],
            (err, row) => {
                if (err) {
                    console.error('获取文件内容失败:', err);
                    return res.status(500).json({ error: '获取文件内容失败' });
                }
                
                if (row) {
                    console.log(`找到文件: ${row.file_path}`);
                    res.json({
                        path: row.file_path,
                        content: row.content,
                        size: row.size,
                        lastModified: row.last_modified,
                        extension: row.extension
                    });
                    return;
                }
                
                // 如果直接匹配没找到，尝试模糊匹配（考虑根目录被跳过的情况）
                console.log(`直接匹配未找到，尝试模糊匹配: %/${filePath}`);
                db.get(
                    "SELECT * FROM project_files WHERE project_id = ? AND file_path LIKE ?",
                    [projectId, `%/${filePath}`],
                    (err, row) => {
                        if (err) {
                            console.error('模糊匹配文件失败:', err);
                            return res.status(500).json({ error: '获取文件内容失败' });
                        }
                        
                        if (!row) {
                            console.log(`未找到文件: ${filePath}`);
                            return res.status(404).json({ error: '文件不存在' });
                        }
                        
                        console.log(`模糊匹配找到文件: ${row.file_path}`);
                        res.json({
                            path: row.file_path,
                            content: row.content,
                            size: row.size,
                            lastModified: row.last_modified,
                            extension: row.extension
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error('获取文件内容失败:', error);
        res.status(500).json({ error: '获取文件内容失败' });
    }
});

// 搜索项目文件 - 从数据库搜索
app.get('/api/projects/:id/search', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        const query = req.query.q;
        
        if (!query) {
            return res.status(400).json({ error: '搜索查询不能为空' });
        }
        
        const searchTerm = query.toLowerCase();
        const results = [];
        
        // 搜索文件名和内容
        db.all(
            "SELECT file_path, content, extension FROM project_files WHERE project_id = ?",
            [projectId],
            (err, rows) => {
                if (err) {
                    console.error('搜索失败:', err);
                    return res.status(500).json({ error: '搜索失败' });
                }
                
                rows.forEach(row => {
                    const fileName = row.file_path.split('/').pop();
                    
                    // 检查文件名匹配
                    if (fileName.toLowerCase().includes(searchTerm)) {
                        results.push({
                            path: row.file_path,
                            name: fileName,
                            type: 'filename',
                            preview: `文件名匹配: ${fileName}`
                        });
                    }
                    
                    // 检查文件内容匹配（仅对文本文件）
                    if (isTextFile(row.extension) && row.content && row.content.toLowerCase().includes(searchTerm)) {
                        const lines = row.content.split('\n');
                        const matchingLines = lines.filter(line => line.toLowerCase().includes(searchTerm));
                        
                        if (matchingLines.length > 0) {
                            results.push({
                                path: row.file_path,
                                name: fileName,
                                type: 'content',
                                preview: matchingLines[0].trim().substring(0, 200)
                            });
                        }
                    }
                });
                
                res.json({ results: results.slice(0, 50) }); // 限制结果数量
            }
        );
    } catch (error) {
        console.error('搜索失败:', error);
        res.status(500).json({ error: '搜索失败' });
    }
});

// 保存文件内容 - 更新数据库中的文件
app.put('/api/projects/:id/files/*', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        const filePath = req.params[0];
        const { content, projectId: requestProjectId, isPlaceholder } = req.body;
        
        if (content === undefined || content === null) {
            return res.status(400).json({ error: '文件内容不能为空' });
        }
        
        // 双重验证项目ID
        if (requestProjectId && requestProjectId !== projectId) {
            console.error(`项目ID不匹配: URL中为 ${projectId}, 请求体中为 ${requestProjectId}`);
            return res.status(400).json({ error: '项目ID不匹配' });
        }
        
        console.log(`📁 保存文件请求: 项目=${projectId}, 路径=${filePath}, 用户=${req.user.username}`);
        
        // 验证项目是否属于当前用户
        db.get("SELECT id, name FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id], (err, project) => {
            if (err) {
                console.error('验证项目失败:', err);
                return res.status(500).json({ error: '验证项目失败' });
            }
            
            if (!project) {
                console.error(`项目不存在或无权限访问: projectId=${projectId}, userId=${req.user.id}`);
                return res.status(404).json({ error: '项目不存在或无权限访问' });
            }
            
            console.log(`✅ 项目验证成功: "${project.name}"`);
            
            // 首先尝试直接匹配路径
            db.get(
                "SELECT id FROM project_files WHERE project_id = ? AND file_path = ?",
                [projectId, filePath],
                (err, row) => {
                    if (err) {
                        console.error('查询文件失败:', err);
                        return res.status(500).json({ error: '查询文件失败' });
                    }
                    
                    if (row) {
                        // 文件存在，更新内容
                        console.log(`📝 更新现有文件: ${filePath}`);
                        updateFileContent(projectId, filePath, content, res);
                    } else {
                        // 文件不存在，创建新文件
                        console.log(`🆕 创建新文件: ${filePath}`);
                        createNewFile(projectId, filePath, content, res, isPlaceholder);
                    }
                }
            );
        });
    } catch (error) {
        console.error('保存文件失败:', error);
        res.status(500).json({ error: '保存文件失败' });
    }
});

// 辅助函数：更新文件内容
function updateFileContent(projectId, filePath, content, res) {
    const newSize = Buffer.byteLength(content, 'utf8');
    const lastModified = Date.now();
    
    db.run(
        `UPDATE project_files 
         SET content = ?, size = ?, last_modified = ? 
         WHERE project_id = ? AND file_path = ?`,
        [content, newSize, lastModified, projectId, filePath],
        function(err) {
            if (err) {
                console.error('更新文件内容失败:', err);
                return res.status(500).json({ error: '更新文件内容失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '文件不存在' });
            }
            
            console.log(`✅ 文件已更新: ${filePath} (${newSize} bytes)`);
            res.json({ 
                success: true, 
                message: '文件保存成功',
                path: filePath,
                size: newSize,
                lastModified: lastModified
            });
        }
    );
}

// 辅助函数：创建新文件
function createNewFile(projectId, filePath, content, res, isPlaceholder = false) {
    const newSize = Buffer.byteLength(content, 'utf8');
    const lastModified = Date.now();
    const extension = path.extname(filePath).toLowerCase();
    
    console.log(`📄 创建新文件: 项目=${projectId}, 路径=${filePath}, 大小=${newSize}bytes, 扩展名=${extension}`);
    
    db.run(
        `INSERT INTO project_files (project_id, file_path, content, size, last_modified, extension) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [projectId, filePath, content, newSize, lastModified, extension],
        function(err) {
            if (err) {
                console.error('创建文件失败:', err);
                return res.status(500).json({ error: '创建文件失败: ' + err.message });
            }
            
            console.log(`✅ 文件创建成功: ${filePath} (ID: ${this.lastID})`);
            
            // 更新项目结构缓存
            updateProjectStructureCache(projectId);
            
            res.json({ 
                success: true, 
                message: isPlaceholder ? '文件夹创建成功' : '文件创建成功',
                path: filePath,
                size: newSize,
                lastModified: lastModified,
                fileId: this.lastID,
                isPlaceholder: isPlaceholder
            });
        }
    );
}

// 删除文件 - 从数据库删除指定文件
app.delete('/api/projects/:id/files/*', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        const filePath = req.params[0];
        
        console.log(`🗑️ 删除文件请求: 项目=${projectId}, 路径=${filePath}, 用户=${req.user.username}`);
        
        // 验证项目是否属于当前用户
        db.get("SELECT id, name FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id], (err, project) => {
            if (err) {
                console.error('验证项目失败:', err);
                return res.status(500).json({ error: '验证项目失败' });
            }
            
            if (!project) {
                console.error(`项目不存在或无权限访问: projectId=${projectId}, userId=${req.user.id}`);
                return res.status(404).json({ error: '项目不存在或无权限访问' });
            }
            
            // 检查文件是否存在
            db.get(
                "SELECT id FROM project_files WHERE project_id = ? AND file_path = ?",
                [projectId, filePath],
                (err, file) => {
                    if (err) {
                        console.error('检查文件存在性失败:', err);
                        return res.status(500).json({ error: '检查文件失败' });
                    }
                    
                    if (!file) {
                        return res.status(404).json({ error: '文件不存在' });
                    }
                    
                    // 删除文件
                    db.run(
                        "DELETE FROM project_files WHERE project_id = ? AND file_path = ?",
                        [projectId, filePath],
                        function(err) {
                            if (err) {
                                console.error('删除文件失败:', err);
                                return res.status(500).json({ error: '删除文件失败' });
                            }
                            
                            if (this.changes === 0) {
                                return res.status(404).json({ error: '文件不存在' });
                            }
                            
                            console.log(`✅ 文件已删除: ${filePath}`);
                            
                            // 更新项目结构缓存
                            updateProjectStructureCache(projectId);
                            
                            res.json({ 
                                success: true, 
                                message: '文件删除成功',
                                deletedPath: filePath
                            });
                        }
                    );
                }
            );
        });
    } catch (error) {
        console.error('删除文件失败:', error);
        res.status(500).json({ error: '删除文件失败' });
    }
});

// 重命名或移动文件 
app.patch('/api/projects/:id/files/*', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        const oldPath = req.params[0];
        const { newPath, operation = 'rename' } = req.body;
        
        if (!newPath) {
            return res.status(400).json({ error: '新路径不能为空' });
        }
        
        console.log(`🔄 ${operation}文件请求: 项目=${projectId}, 原路径=${oldPath}, 新路径=${newPath}, 用户=${req.user.username}`);
        
        // 验证项目是否属于当前用户
        db.get("SELECT id, name FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id], (err, project) => {
            if (err) {
                console.error('验证项目失败:', err);
                return res.status(500).json({ error: '验证项目失败' });
            }
            
            if (!project) {
                console.error(`项目不存在或无权限访问: projectId=${projectId}, userId=${req.user.id}`);
                return res.status(404).json({ error: '项目不存在或无权限访问' });
            }
            
            // 检查原文件是否存在
            db.get(
                "SELECT id, content, size, last_modified, extension FROM project_files WHERE project_id = ? AND file_path = ?",
                [projectId, oldPath],
                (err, file) => {
                    if (err) {
                        console.error('检查原文件失败:', err);
                        return res.status(500).json({ error: '检查文件失败' });
                    }
                    
                    if (!file) {
                        return res.status(404).json({ error: '原文件不存在' });
                    }
                    
                    // 检查新路径是否已存在
                    db.get(
                        "SELECT id FROM project_files WHERE project_id = ? AND file_path = ?",
                        [projectId, newPath],
                        (err, existingFile) => {
                            if (err) {
                                console.error('检查新路径失败:', err);
                                return res.status(500).json({ error: '检查新路径失败' });
                            }
                            
                            if (existingFile) {
                                return res.status(409).json({ error: '目标路径已存在文件' });
                            }
                            
                            // 更新文件路径和扩展名
                            const newExtension = path.extname(newPath).toLowerCase();
                            
                            db.run(
                                "UPDATE project_files SET file_path = ?, extension = ?, last_modified = ? WHERE project_id = ? AND file_path = ?",
                                [newPath, newExtension, Date.now(), projectId, oldPath],
                                function(err) {
                                    if (err) {
                                        console.error('更新文件路径失败:', err);
                                        return res.status(500).json({ error: '重命名文件失败' });
                                    }
                                    
                                    if (this.changes === 0) {
                                        return res.status(404).json({ error: '文件不存在' });
                                    }
                                    
                                    console.log(`✅ 文件${operation}成功: ${oldPath} -> ${newPath}`);
                                    
                                    // 更新项目结构缓存
                                    updateProjectStructureCache(projectId);
                                    
                                    res.json({ 
                                        success: true, 
                                        message: `文件${operation}成功`,
                                        oldPath: oldPath,
                                        newPath: newPath,
                                        operation: operation
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    } catch (error) {
        console.error('重命名/移动文件失败:', error);
        res.status(500).json({ error: '操作失败' });
    }
});

// 删除文件夹及其所有内容
app.delete('/api/projects/:id/folders/*', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        const folderPath = req.params[0];
        
        console.log(`🗑️ 删除文件夹请求: 项目=${projectId}, 路径=${folderPath}, 用户=${req.user.username}`);
        
        // 验证项目是否属于当前用户
        db.get("SELECT id, name FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id], (err, project) => {
            if (err) {
                console.error('验证项目失败:', err);
                return res.status(500).json({ error: '验证项目失败' });
            }
            
            if (!project) {
                console.error(`项目不存在或无权限访问: projectId=${projectId}, userId=${req.user.id}`);
                return res.status(404).json({ error: '项目不存在或无权限访问' });
            }
            
            // 删除文件夹下所有文件（包括子文件夹中的文件）
            const folderPattern = folderPath + '/%';
            
            db.run(
                "DELETE FROM project_files WHERE project_id = ? AND (file_path LIKE ? OR file_path = ?)",
                [projectId, folderPattern, folderPath],
                function(err) {
                    if (err) {
                        console.error('删除文件夹失败:', err);
                        return res.status(500).json({ error: '删除文件夹失败' });
                    }
                    
                    const deletedCount = this.changes;
                    console.log(`✅ 文件夹已删除: ${folderPath} (删除了 ${deletedCount} 个文件)`);
                    
                    // 更新项目结构缓存
                    updateProjectStructureCache(projectId);
                    
                    res.json({ 
                        success: true, 
                        message: '文件夹删除成功',
                        deletedPath: folderPath,
                        deletedFiles: deletedCount
                    });
                }
            );
        });
    } catch (error) {
        console.error('删除文件夹失败:', error);
        res.status(500).json({ error: '删除文件夹失败' });
    }
});

// 辅助函数：更新项目结构缓存
function updateProjectStructureCache(projectId) {
    // 获取项目所有文件，重新生成结构
    db.all(
        "SELECT file_path FROM project_files WHERE project_id = ?",
        [projectId],
        (err, files) => {
            if (err) {
                console.error('获取项目文件列表失败:', err);
                return;
            }
            
            // 从文件路径生成结构
            const filePaths = files.map(f => f.file_path);
            const structure = generateStructureFromFilePaths(filePaths);
            
            // 更新结构缓存
            db.run(
                "INSERT OR REPLACE INTO project_structures (project_id, structure_data, updated_at) VALUES (?, ?, ?)",
                [projectId, JSON.stringify(structure), new Date().toISOString()],
                (err) => {
                    if (err) {
                        console.error('更新项目结构缓存失败:', err);
                    } else {
                        console.log(`📂 项目结构缓存已更新: ${projectId}`);
                    }
                }
            );
        }
    );
}

// 下载整个项目 - 打包为zip文件
app.get('/api/projects/:id/download', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        
        // 验证项目是否属于当前用户
        db.get("SELECT name FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id], (err, project) => {
            if (err) {
                console.error('验证项目失败:', err);
                return res.status(500).json({ error: '验证项目失败' });
            }
            
            if (!project) {
                return res.status(404).json({ error: '项目不存在或无权限访问' });
            }
            
            // 获取项目所有文件
            db.all(
                "SELECT file_path, content FROM project_files WHERE project_id = ?",
                [projectId],
                (err, files) => {
                    if (err) {
                        console.error('获取项目文件失败:', err);
                        return res.status(500).json({ error: '获取项目文件失败' });
                    }
                    
                    // 创建文件映射对象，前端可以用来创建zip
                    const fileMap = {};
                    files.forEach(file => {
                        fileMap[file.file_path] = file.content;
                    });
                    
                    res.json({
                        projectName: project.name,
                        files: fileMap,
                        totalFiles: files.length
                    });
                }
            );
        });
    } catch (error) {
        console.error('下载项目失败:', error);
        res.status(500).json({ error: '下载项目失败' });
    }
});

// 移除项目 - 从数据库删除
app.delete('/api/projects/:id', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        
        // 首先统计要删除的文件数量
        db.get("SELECT COUNT(*) as fileCount FROM project_files WHERE project_id = ?", [projectId], (err, row) => {
            if (err) {
                console.error('查询项目文件数量失败:', err);
                return res.status(500).json({ error: '删除项目失败' });
            }
            
            const fileCount = row ? row.fileCount : 0;
            
            // 先删除项目相关的文件记录
            db.run("DELETE FROM project_files WHERE project_id = ?", [projectId], function(err) {
                if (err) {
                    console.error('删除项目文件失败:', err);
                    return res.status(500).json({ error: '删除项目失败' });
                }
                
                // 然后删除项目结构记录
                db.run("DELETE FROM project_structures WHERE project_id = ?", [projectId], function(err) {
                    if (err) {
                        console.error('删除项目结构失败:', err);
                        return res.status(500).json({ error: '删除项目失败' });
                    }
                    
                    // 删除项目重构配置
                    db.run("DELETE FROM project_restructure_configs WHERE project_id = ?", [projectId], function(err) {
                        if (err) {
                            console.error('删除项目重构配置失败:', err);
                            return res.status(500).json({ error: '删除项目失败' });
                        }
                        
                        // 最后删除项目记录
                        db.run("DELETE FROM projects WHERE id = ? AND user_id = ?", [projectId, userId], function(err) {
                            if (err) {
                                console.error('删除项目失败:', err);
                                return res.status(500).json({ error: '删除项目失败' });
                            }
                            
                            if (this.changes === 0) {
                                return res.status(404).json({ error: '项目不存在或无权限' });
                            }
                            
                            res.json({ 
                                message: '项目已移除', 
                                deletedFiles: fileCount 
                            });
                            console.log(`项目ID ${projectId} 已从数据库删除，同时删除了 ${fileCount} 个文件`);
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('移除项目失败:', error);
        res.status(500).json({ error: '移除项目失败' });
    }
});

// 重命名项目
app.put('/api/projects/:id', requireAuth, (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: '项目名称不能为空' });
        }
        
        // 检查项目是否存在且属于当前用户
        db.get("SELECT * FROM projects WHERE id = ? AND user_id = ?", [projectId, userId], (err, project) => {
            if (err) {
                console.error('查询项目失败:', err);
                return res.status(500).json({ error: '重命名项目失败' });
            }
            
            if (!project) {
                return res.status(404).json({ error: '项目不存在或无权限' });
            }
            
            // 检查当前用户是否已有同名项目（排除当前项目）
            db.get("SELECT id FROM projects WHERE name = ? AND user_id = ? AND id != ?", [name.trim(), userId, projectId], (err, existingProject) => {
                if (err) {
                    console.error('检查项目名称失败:', err);
                    return res.status(500).json({ error: '重命名项目失败' });
                }
                
                if (existingProject) {
                    return res.status(400).json({ error: '项目名称已存在' });
                }
                
                // 更新项目名称
                db.run("UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", 
                    [name.trim(), projectId, userId], (err) => {
                    if (err) {
                        console.error('更新项目名称失败:', err);
                        return res.status(500).json({ error: '重命名项目失败' });
                    }
                    
                    // 返回更新后的项目信息
                    const updatedProject = {
                        ...project,
                        name: name.trim(),
                        updated_at: new Date().toISOString()
                    };
                    
                    res.json(updatedProject);
                    console.log(`项目 "${projectId}" 已重命名为 "${name.trim()}"`);
                });
            });
        });
    } catch (error) {
        console.error('重命名项目失败:', error);
        res.status(500).json({ error: '重命名项目失败' });
    }
});

// 生成项目ID
function generateProjectId(name) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${timestamp}_${randomStr}`;
}

// 获取文件扩展名
function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
}

// 检查是否为文本文件
function isTextFile(extension) {
    const textExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.css', '.html', '.xml', '.json', '.md', '.txt', '.sql', '.sh', '.bat', '.yml', '.yaml', '.toml', '.ini', '.cfg'];
    return textExtensions.includes(extension.toLowerCase());
}

// 从文件路径生成目录结构
function generateStructureFromFilePaths(filePaths) {
    const structure = [];
    const dirMap = new Map();
    
    for (const filePath of filePaths) {
        const parts = filePath.split('/');
        let currentLevel = structure;
        let currentPath = '';
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            if (i === parts.length - 1) {
                // 这是文件
                currentLevel.push({
                    name: part,
                    type: 'file',
                    path: currentPath,
                    extension: getFileExtension(part)
                });
            } else {
                // 这是目录
                let dir = currentLevel.find(item => item.name === part && item.type === 'directory');
                if (!dir) {
                    dir = {
                        name: part,
                        type: 'directory',
                        path: currentPath,
                        children: []
                    };
                    currentLevel.push(dir);
                }
                currentLevel = dir.children;
            }
        }
    }
    
    return structure;
}

// 从文件列表生成目录结构 (兼容Map)
function generateStructureFromFiles(filesMap) {
    const structure = [];
    const dirMap = new Map();
    
    for (const filePath of filesMap.keys()) {
        const parts = filePath.split('/');
        let currentLevel = structure;
        let currentPath = '';
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            if (i === parts.length - 1) {
                // 这是文件
                currentLevel.push({
                    name: part,
                    type: 'file',
                    path: currentPath,
                    extension: getFileExtension(part)
                });
            } else {
                // 这是目录
                let dir = currentLevel.find(item => item.name === part && item.type === 'directory');
                if (!dir) {
                    dir = {
                        name: part,
                        type: 'directory',
                        path: currentPath,
                        children: []
                    };
                    currentLevel.push(dir);
                }
                currentLevel = dir.children;
            }
        }
    }
    
    return structure;
}

// 获取指定项目的根目录 - 已移除，纯用户模式不使用服务器文件系统
function getProjectRoot(projectId) {
    return null; // 不再返回服务器端路径
}

// 获取项目结构 - 已禁用，使用客户端本地文件访问
app.get('/api/structure', (req, res) => {
  try {
    // 不再提供服务器端文件结构，返回空结构
    res.json({
      message: '使用客户端本地文件访问模式',
      structure: [],
      isEmpty: true
    });
  } catch (error) {
    console.error('API调用失败:', error);
    res.status(500).json({ error: 'API调用失败' });
  }
});

// 搜索文件和内容 - 已禁用，使用客户端本地搜索
app.get('/api/search', (req, res) => {
  try {
    // 不再提供服务器端搜索，返回空结果
    res.json({
      message: '使用客户端本地搜索功能',
      results: [],
      isEmpty: true
    });
  } catch (error) {
    console.error('搜索API调用失败:', error);
    res.status(500).json({ error: '搜索API调用失败' });
  }
});

// 获取文件内容 - 已禁用，使用客户端本地文件读取
app.get('/api/file/*', (req, res) => {
  try {
    // 不再提供服务器端文件读取
    res.status(403).json({ 
      error: '使用客户端本地文件访问模式',
      message: '请通过浏览器本地文件API访问文件'
    });
  } catch (error) {
    console.error('文件API调用失败:', error);
    res.status(500).json({ error: '文件API调用失败' });
  }
});

// 保存项目重组配置 - 存储到数据库
app.post('/api/projects/:projectId/restructure', requireAuth, (req, res) => {
  try {
    const { projectId } = req.params;
    const { structureMapping } = req.body;
    
    if (!projectId || !structureMapping) {
      return res.status(400).json({ error: '项目ID和重组配置不能为空' });
    }
    
    // 验证项目是否存在
    db.get("SELECT name FROM projects WHERE id = ?", [projectId], (err, project) => {
      if (err) {
        console.error('检查项目失败:', err);
        return res.status(500).json({ error: '检查项目失败' });
      }
      
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }
      
      // 保存重组配置到数据库
      const configData = JSON.stringify(structureMapping);
      const timestamp = new Date().toISOString();
      
      db.run(
        `INSERT OR REPLACE INTO project_restructure_configs 
         (project_id, config_data, updated_at) 
         VALUES (?, ?, ?)`,
        [projectId, configData, timestamp],
        function(err) {
          if (err) {
            console.error('保存重组配置失败:', err);
            return res.status(500).json({ error: '保存重组配置失败' });
          }
          
          console.log(`项目 "${project.name}" 的重组配置已保存到数据库`);
          res.json({ 
            message: '重组配置已保存',
            savedAt: timestamp
          });
        }
      );
    });
  } catch (error) {
    console.error('保存重组配置失败:', error);
    res.status(500).json({ error: '保存重组配置失败' });
  }
});

// 获取项目重组配置 - 从数据库读取
app.get('/api/projects/:projectId/restructure', (req, res) => {
  try {
    const { projectId } = req.params;
    
    db.get(
      "SELECT config_data, updated_at FROM project_restructure_configs WHERE project_id = ?",
      [projectId],
      (err, row) => {
        if (err) {
          console.error('获取重组配置失败:', err);
          return res.status(500).json({ error: '获取重组配置失败' });
        }
        
        if (row) {
          try {
            const structureMapping = JSON.parse(row.config_data);
            res.json({
              hasConfig: true,
              config: {
                structureMapping,
                savedAt: row.updated_at
              }
            });
          } catch (e) {
            console.error('解析重组配置失败:', e);
            res.status(500).json({ error: '解析重组配置失败' });
          }
        } else {
          res.json({
            hasConfig: false
          });
        }
      }
    );
  } catch (error) {
    console.error('获取重组配置失败:', error);
    res.status(500).json({ error: '获取重组配置失败' });
  }
});

// 删除项目重组配置 - 从数据库删除
app.delete('/api/projects/:projectId/restructure', requireAuth, (req, res) => {
  try {
    const { projectId } = req.params;
    
    db.run(
      "DELETE FROM project_restructure_configs WHERE project_id = ?",
      [projectId],
      function(err) {
        if (err) {
          console.error('删除重组配置失败:', err);
          return res.status(500).json({ error: '删除重组配置失败' });
        }
        
        if (this.changes > 0) {
          res.json({ message: '重组配置已删除' });
        } else {
          res.status(404).json({ error: '未找到重组配置' });
        }
      }
    );
  } catch (error) {
    console.error('删除重组配置失败:', error);
    res.status(500).json({ error: '删除重组配置失败' });
  }
});

// AI代码分析接口
app.post('/api/analyze', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 检查当前用户的AI配置
    const userConfig = await new Promise((resolve, reject) => {
        db.get("SELECT ai_api_url, ai_api_key FROM users WHERE id = ?", [userId], (err, user) => {
            if (err) reject(err);
            else resolve(user);
        });
    });
    
    const hasAiConfig = !!(userConfig && userConfig.ai_api_url && userConfig.ai_api_key);
    console.log(`代码分析 - 用户 ${userId} AI配置状态: ${hasAiConfig}`);
    
    if (!hasAiConfig) {
      return res.status(401).json({ 
        error: '请先配置AI API', 
        requiresAIConfig: true 
      });
    }
    
    const { code, filename, action = 'explain' } = req.body;
    
    let prompt = '';
    switch (action) {
      case 'explain':
        prompt = `请分析以下代码文件。请在<thinking>标签中展示你的思考过程，然后提供最终分析结果。

文件名: ${filename}
代码内容：
\`\`\`
${code}
\`\`\`

<thinking>
在这里展示分析思路：
- 首先识别代码的主要结构
- 分析关键函数和类的作用  
- 理解代码的执行流程
- 考虑与其他模块的关系
- 评估代码质量和特点
</thinking>

请提供：
1. 文件的主要功能和作用
2. 核心类/函数的说明
3. 与其他模块的关系
4. 代码架构特点
5. 潜在的改进建议

请用中文回答，格式清晰易读。`;
        break;
      case 'review':
        prompt = `请对以下代码进行代码审查。请在<thinking>标签中展示你的审查思路，然后提供详细的审查结果。

文件名: ${filename}
代码内容：
\`\`\`
${code}
\`\`\`

<thinking>
在这里展示审查思路：
- 检查代码规范和风格
- 识别潜在的bug和问题
- 分析性能瓶颈
- 评估安全风险
- 考虑可维护性问题
</thinking>

请从以下方面进行审查：
1. 代码质量和规范性
2. 潜在的bug和问题
3. 性能优化建议
4. 安全性考虑
5. 可维护性评估

请用中文回答。`;
        break;
      case 'document':
        prompt = `请为以下代码生成详细的技术文档。请在<thinking>标签中展示你的文档规划思路，然后提供完整的文档。

文件名: ${filename}
代码内容：
\`\`\`
${code}
\`\`\`

<thinking>
在这里展示文档规划思路：
- 分析代码的主要功能模块
- 识别需要文档化的API接口
- 梳理依赖关系和使用流程
- 规划文档结构和内容组织
- 考虑用户使用场景和示例
</thinking>

请生成包含以下内容的文档：
1. 模块概述
2. API接口说明
3. 使用示例
4. 依赖关系
5. 配置说明

请用中文回答，使用Markdown格式。`;
        break;
    }
    
    const modelName = getModelForProvider(userConfig.ai_api_url);
    
    const response = await axios.post(userConfig.ai_api_url, {
      model: modelName,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.7,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${userConfig.ai_api_key}`,
        'Content-Type': 'application/json'
      }
    });
    
    const analysisContent = response.data.choices[0].message.content;
    
    // 解析思考过程和最终结果
    let thinking = '';
    let result = analysisContent;
    
    // 检查是否包含思考标记
    const thinkingMatch = analysisContent.match(/<thinking>(.*?)<\/thinking>/s);
    if (thinkingMatch) {
      thinking = thinkingMatch[1].trim();
      result = analysisContent.replace(/<thinking>.*?<\/thinking>/s, '').trim();
    }
    
    res.json({
      analysis: result,
      thinking: thinking,
      hasThinking: thinking.length > 0
    });
  } catch (error) {
    console.error('AI分析错误:', error.response?.data || error.message);
    res.status(500).json({ 
      error: '分析失败',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// 测试AI连接
async function testAIConnection(apiUrl, apiKey, model = null) {
    try {
        console.log(`开始测试AI连接: ${apiUrl}`);
        
        if (!apiUrl || !apiKey) {
            console.log('API URL或API Key为空');
            return { success: false, error: 'API URL和API Key都是必需的' };
        }

        const modelName = model || getModelForProvider(apiUrl);
        console.log(`使用模型进行测试: ${modelName}`);
        
        const response = await axios.post(apiUrl, {
            model: modelName,
            messages: [
                { role: 'user', content: '测试连接，请回复"连接成功"' }
            ],
            max_tokens: 10,
            temperature: 0
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 15000, // 增加超时时间
            validateStatus: function (status) {
                // 只接受2xx状态码为成功
                return status >= 200 && status < 300;
            }
        });
        
        console.log(`API响应状态: ${response.status}`);
        console.log(`API响应数据存在: ${!!response.data}`);
        
        // 检查响应结构是否符合预期
        if (response.data && 
            response.data.choices && 
            Array.isArray(response.data.choices) && 
            response.data.choices.length > 0 &&
            response.data.choices[0].message) {
            console.log('AI连接测试成功');
            return { success: true, message: 'API连接测试成功' };
        } else {
            console.log('API响应格式不正确:', response.data);
            return { success: false, error: 'AI API响应格式不正确或无有效内容' };
        }
    } catch (error) {
        console.log('AI连接测试失败:', error.message);
        
        // 详细的错误处理
        if (error.response) {
            // 服务器返回了错误状态码
            const status = error.response.status;
            const errorData = error.response.data;
            
            if (status === 401) {
                return { success: false, error: 'API密钥无效或已过期' };
            } else if (status === 403) {
                return { success: false, error: 'API密钥权限不足' };
            } else if (status === 404) {
                return { success: false, error: 'API端点不存在，请检查URL是否正确' };
            } else if (status === 429) {
                return { success: false, error: 'API请求频率超限，请稍后重试' };
            } else if (status >= 500) {
                return { success: false, error: 'AI服务器内部错误，请稍后重试' };
            } else {
                const errorMsg = errorData?.error?.message || errorData?.message || '未知API错误';
                return { success: false, error: `API错误 (${status}): ${errorMsg}` };
            }
        } else if (error.request) {
            // 请求已发出但没有收到响应
            return { success: false, error: '无法连接到API服务器，请检查网络连接和URL是否正确' };
        } else if (error.code === 'ECONNABORTED') {
            // 请求超时
            return { success: false, error: '请求超时，请检查网络连接或稍后重试' };
        } else {
            // 其他错误
            return { success: false, error: `连接测试失败: ${error.message}` };
        }
    }
}

// 检测可用模型
async function detectAvailableModels(apiUrl, apiKey) {
    try {
        const provider = identifyAIProvider(apiUrl);
        
        // 根据不同的AI提供商使用不同的模型检测方式
        switch (provider) {
            case 'OpenAI':
                return await detectOpenAIModels(apiUrl, apiKey);
            case 'DeepSeek':
                return await detectDeepSeekModels(apiUrl, apiKey);
            case 'Claude':
                return await detectClaudeModels(apiUrl, apiKey);
            default:
                // 对于自定义API，尝试通用检测方式
                return await detectGenericModels(apiUrl, apiKey);
        }
    } catch (error) {
        console.error('检测模型失败:', error);
        return [];
    }
}

// OpenAI模型检测
async function detectOpenAIModels(apiUrl, apiKey) {
    try {
        const modelsUrl = apiUrl.replace('/chat/completions', '/models');
        console.log('OpenAI模型检测URL:', modelsUrl);
        
        const response = await axios.get(modelsUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('OpenAI API响应状态:', response.status);
        console.log('OpenAI API响应数据类型:', typeof response.data);
        
        if (response.data && response.data.data) {
            const models = response.data.data
                .filter(model => model.id.includes('gpt'))
                .map(model => ({
                    id: model.id,
                    name: model.id,
                    created: model.created
                }));
            console.log('OpenAI检测到的模型:', models);
            return models;
        }
        return [];
    } catch (error) {
        console.error('OpenAI模型检测失败:', error.response?.status, error.response?.data);
        // 如果API不支持模型列表，返回常见的OpenAI模型
        return [
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ];
    }
}

// DeepSeek模型检测
async function detectDeepSeekModels(apiUrl, apiKey) {
    try {
        const modelsUrl = apiUrl.replace('/chat/completions', '/models');
        console.log('DeepSeek模型检测URL:', modelsUrl);
        
        const response = await axios.get(modelsUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('DeepSeek API响应状态:', response.status);
        
        if (response.data && response.data.data) {
            return response.data.data.map(model => ({
                id: model.id,
                name: model.id
            }));
        }
        return [];
    } catch (error) {
        console.error('DeepSeek模型检测失败:', error.response?.status, error.response?.data);
        // 如果API不支持模型列表，返回常见的DeepSeek模型
        return [
            { id: 'deepseek-chat', name: 'DeepSeek Chat' },
            { id: 'deepseek-coder', name: 'DeepSeek Coder' }
        ];
    }
}

// Claude模型检测
async function detectClaudeModels(apiUrl, apiKey) {
    // Claude API通常不提供模型列表端点，返回已知模型
    console.log('Claude模型检测: 使用预设模型列表');
    return [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
    ];
}

// 通用模型检测
async function detectGenericModels(apiUrl, apiKey) {
    try {
        const modelsUrl = apiUrl.replace('/chat/completions', '/models');
        console.log('通用模型检测URL:', modelsUrl);
        
        const response = await axios.get(modelsUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            validateStatus: function (status) {
                return status >= 200 && status < 500; // 接受所有2xx-4xx状态码
            }
        });
        
        console.log('通用API响应状态:', response.status);
        console.log('通用API响应Content-Type:', response.headers['content-type']);
        
        // 检查响应是否为JSON
        if (response.headers['content-type']?.includes('application/json') && response.data && response.data.data) {
            return response.data.data.map(model => ({
                id: model.id || model.name,
                name: model.id || model.name
            }));
        }
        
        console.log('通用API不支持模型列表或返回非JSON格式');
        return [];
    } catch (error) {
        console.error('通用模型检测失败:', error.message);
        return [];
    }
}

// 项目分析API
app.post('/api/analyze-project', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 检查当前用户的AI配置
        const userConfig = await new Promise((resolve, reject) => {
            db.get("SELECT ai_api_url, ai_api_key FROM users WHERE id = ?", [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        const hasAiConfig = !!(userConfig && userConfig.ai_api_url && userConfig.ai_api_key);
        console.log(`项目分析 - 用户 ${userId} AI配置状态: ${hasAiConfig}`);
        
        if (!hasAiConfig) {
            return res.status(401).json({ 
                error: '请先配置AI API', 
                requiresAIConfig: true 
            });
        }
        
        const { projectId } = req.body;
        
        if (!projectId) {
            return res.status(400).json({ error: '项目ID不能为空' });
        }
        
        // 从数据库查找当前用户的项目
        const project = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM projects WHERE id = ? AND user_id = ?", [projectId, userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        console.log('分析项目请求:', { projectId, userId, project: project ? { id: project.id, name: project.name } : null });
        
        if (!project) {
            return res.status(404).json({ 
                error: '项目不存在',
                debug: {
                    requestedId: projectId,
                    userId: userId,
                    message: '项目不存在或不属于当前用户'
                }
            });
        }
        
        // 获取项目文件数据 - 从数据库
        db.get(
            "SELECT structure_data FROM project_structures WHERE project_id = ?",
            [projectId],
            (err, structureRow) => {
                if (err) {
                    console.error('获取项目结构失败:', err);
                    return res.status(500).json({ error: '获取项目结构失败' });
                }
                
                // 获取文件数量
                db.get(
                    "SELECT COUNT(*) as count FROM project_files WHERE project_id = ?",
                    [projectId],
                    async (err, countRow) => {
                        if (err) {
                            console.error('获取文件数量失败:', err);
                            return res.status(500).json({ error: '获取文件数量失败' });
                        }
                        
                        const fileCount = countRow ? countRow.count : 0;
                        if (fileCount === 0) {
                            return res.status(400).json({ 
                                error: '项目文件未上传，请先上传项目文件',
                                debug: {
                                    projectId,
                                    filesCount: fileCount
                                }
                            });
                        }
                        
                        let projectStructure = [];
                        
                        // 使用存储的项目结构或从文件生成
                        if (structureRow && structureRow.structure_data) {
                            try {
                                projectStructure = JSON.parse(structureRow.structure_data);
                            } catch (e) {
                                console.error('解析项目结构失败:', e);
                            }
                        }
                        
                        // 如果没有存储的结构，从文件路径生成
                        if (projectStructure.length === 0) {
                            db.all(
                                "SELECT file_path FROM project_files WHERE project_id = ?",
                                [projectId],
                                async (err, fileRows) => {
                                    if (err) {
                                        console.error('获取文件路径失败:', err);
                                        return res.status(500).json({ error: '获取文件路径失败' });
                                    }
                                    
                                    // 从文件路径生成结构
                                    const filePaths = fileRows.map(row => row.file_path);
                                    projectStructure = generateStructureFromFilePaths(filePaths);
                                    
                                    performAnalysis(project, projectStructure, res);
                                }
                            );
                        } else {
                            performAnalysis(project, projectStructure, res);
                        }
                    }
                );
            }
        );
        
        async function performAnalysis(project, projectStructure, res) {
            try {
                // 构建分析提示 - 仅分析根目录第一层结构
                const projectSummary = generateProjectSummary(project, projectStructure);
                const prompt = `请分析以下项目的根目录第一层结构，提供目录分组建议。

项目名称: ${project.name}
项目路径: ${project.path}

根目录第一层结构分析:
${projectSummary}

分析要求：
1. 只分析根目录下的一级子目录和文件
2. 根据目录名称和根目录文件判断项目类型
3. 提供合理的目录分组方案

请按以下格式回答：

**项目类型**: [Web应用/库项目/微服务/工具等]

**一级目录分析**:
- 目录名: 功能说明

**分组建议**: 
[简单说明分组逻辑]

**必须在最后提供JSON格式的分组映射**:

[STRUCTURE_MAPPING]
{
  "categories": {
    "源代码模块": {
      "description": "主要代码目录",
      "directories": ["实际存在的目录名/"],
      "color": "#3498db"
    },
    "配置构建": {
      "description": "配置和构建文件",
      "directories": ["实际存在的目录名/"],
      "color": "#f39c12"
    },
    "文档资源": {
      "description": "文档和资源文件",
      "directories": ["实际存在的目录名/"],
      "color": "#2ecc71"
    }
  }
}
[/STRUCTURE_MAPPING]

重要提醒：
1. 只包含实际存在的一级目录
2. 目录名必须以"/"结尾
3. JSON必须格式正确
4. 必须包含[STRUCTURE_MAPPING]标签`;

                console.log('🤖 发送AI分析请求，项目摘要长度:', projectSummary.length);

                const modelName = getModelForProvider(userConfig.ai_api_url);
                const response = await Promise.race([
                    axios.post(userConfig.ai_api_url, {
                        model: modelName,
                        messages: [
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        max_tokens: 4000,
                        temperature: 0.7
                    }, {
                        headers: {
                            'Authorization': `Bearer ${userConfig.ai_api_key}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 60000 // 60秒超时
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('AI分析请求超时')), 60000)
                    )
                ]);

                console.log('🎯 AI分析响应状态:', response.status);

                const analysisContent = response.data.choices[0].message.content;
                console.log('📝 AI分析原始回复长度:', analysisContent.length);
                console.log('📄 AI分析内容预览:', analysisContent.substring(0, 200) + '...');
                
                // 解析思考过程和最终结果
                let thinking = '';
                let result = analysisContent;
                let structureMapping = null;
                
                // 检查是否包含思考标记
                const thinkingMatch = analysisContent.match(/<thinking>(.*?)<\/thinking>/s);
                if (thinkingMatch) {
                    thinking = thinkingMatch[1].trim();
                    result = analysisContent.replace(/<thinking>.*?<\/thinking>/s, '').trim();
                }
                
                // 检查是否包含结构映射
                const structureMatch = analysisContent.match(/\[STRUCTURE_MAPPING\](.*?)\[\/STRUCTURE_MAPPING\]/s);
                console.log('🔍 结构映射匹配结果:', structureMatch ? '找到' : '未找到');
                
                if (structureMatch) {
                    try {
                        const mappingText = structureMatch[1].trim();
                        console.log('📊 尝试解析结构映射:', mappingText.substring(0, 100) + '...');
                        structureMapping = JSON.parse(mappingText);
                        result = result.replace(/\[STRUCTURE_MAPPING\].*?\[\/STRUCTURE_MAPPING\]/s, '').trim();
                        console.log('✅ 结构映射解析成功:', Object.keys(structureMapping.categories || {}));
                    } catch (e) {
                        console.error('❌ 解析结构映射失败:', e.message);
                        console.log('🔧 原始映射文本:', structureMatch[1]);
                    }
                } else {
                    console.log('⚠️ AI响应中未找到结构映射标签');
                }
                if (thinkingMatch) {
                    thinking = thinkingMatch[1].trim();
                    result = analysisContent.replace(/<thinking>.*?<\/thinking>/s, '').trim();
                }

                res.json({
                    analysis: result,
                    thinking: thinking,
                    hasThinking: thinking.length > 0,
                    structureMapping: structureMapping,
                    project: {
                        id: project.id,
                        name: project.name,
                        path: project.path
                    }
                });
                
            } catch (error) {
                console.error('项目分析错误详情:', {
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    stack: error.stack?.split('\n').slice(0, 3).join('\n')
                });
                
                let errorMessage = '项目分析失败';
                let details = error.message;
                
                if (error.response) {
                    errorMessage = `AI服务响应错误 (${error.response.status})`;
                    details = error.response.data?.error?.message || error.response.data?.message || error.message;
                } else if (error.message.includes('timeout')) {
                    errorMessage = 'AI分析请求超时';
                    details = '请求处理时间过长，请稍后重试';
                } else if (error.message.includes('network')) {
                    errorMessage = 'AI服务连接失败';
                    details = '无法连接到AI服务，请检查网络连接';
                }
                
                res.status(500).json({ 
                    error: errorMessage,
                    details: details,
                    projectId: projectId
                });
            }
        }
        
    } catch (error) {
        console.error('项目分析错误:', error);
        res.status(500).json({ 
            error: '项目分析失败',
            details: error.message
        });
    }
});

// 生成项目摘要（仅分析根目录第一层结构）
function generateProjectSummary(project, structure) {
    const summary = {
        firstLevelDirectories: [],
        firstLevelFiles: [],
        directoryStats: {},
        fileTypes: {}
    };
    
    // 只分析第一层结构
    for (const item of structure) {
        if (item.type === 'directory') {
            // 统计子目录中的文件数量（不递归内容，只统计数量）
            const childCount = countItemsInDirectory(item);
            summary.firstLevelDirectories.push({
                name: item.name,
                childrenCount: childCount.total,
                filesCount: childCount.files,
                dirsCount: childCount.directories
            });
        } else {
            // 根目录下的文件
            const ext = item.name.split('.').pop()?.toLowerCase() || 'no-ext';
            summary.fileTypes[ext] = (summary.fileTypes[ext] || 0) + 1;
            summary.firstLevelFiles.push(item.name);
        }
    }
    
    // 生成简洁的分析文本
    let summaryText = `项目根目录结构分析:\n\n`;
    
    if (summary.firstLevelDirectories.length > 0) {
        summaryText += `一级目录 (${summary.firstLevelDirectories.length}个):\n`;
        summary.firstLevelDirectories.forEach(dir => {
            summaryText += `- ${dir.name}/ (包含${dir.filesCount}个文件, ${dir.dirsCount}个子目录)\n`;
        });
        summaryText += '\n';
    }
    
    if (summary.firstLevelFiles.length > 0) {
        summaryText += `根目录文件 (${summary.firstLevelFiles.length}个):\n`;
        summary.firstLevelFiles.forEach(file => {
            summaryText += `- ${file}\n`;
        });
        summaryText += '\n';
    }
    
    if (Object.keys(summary.fileTypes).length > 0) {
        summaryText += `根目录文件类型:\n`;
        Object.entries(summary.fileTypes).forEach(([ext, count]) => {
            summaryText += `- .${ext}: ${count}个\n`;
        });
    }
    
    return summaryText;
}

// 递归统计目录中的项目数量（不获取具体内容）
function countItemsInDirectory(directory) {
    let totalFiles = 0;
    let totalDirs = 0;
    
    if (directory.children) {
        for (const child of directory.children) {
            if (child.type === 'directory') {
                totalDirs++;
                const childStats = countItemsInDirectory(child);
                totalFiles += childStats.files;
                totalDirs += childStats.directories;
            } else {
                totalFiles++;
            }
        }
    }
    
    return {
        total: totalFiles + totalDirs,
        files: totalFiles,
        directories: totalDirs
    };
}

// 格式化项目结构为AI可读格式（简化版，避免token超限）
function formatStructureForAI(structure, depth = 0, maxDepth = 3, maxItems = 50) {
    let result = '';
    const indent = '  '.repeat(depth);
    let itemCount = 0;
    
    // 限制深度和项目数量以控制输出长度
    if (depth > maxDepth) {
        return `${indent}... (省略更深层级)\n`;
    }
    
    for (const item of structure) {
        if (itemCount >= maxItems) {
            result += `${indent}... (省略其余 ${structure.length - itemCount} 项)\n`;
            break;
        }
        
        if (item.type === 'directory') {
            result += `${indent}📁 ${item.name}/\n`;
            if (item.children && item.children.length > 0 && depth < maxDepth) {
                // 对子目录进行递归，但限制数量
                const childResult = formatStructureForAI(item.children, depth + 1, maxDepth, 20);
                result += childResult;
            }
        } else {
            // 只显示重要的文件扩展名
            const ext = item.name.split('.').pop()?.toLowerCase();
            const importantExts = ['js', 'ts', 'py', 'java', 'cpp', 'h', 'c', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt', 'scala', 'sh', 'bat', 'sql', 'json', 'xml', 'yaml', 'yml', 'md', 'txt', 'config', 'ini', 'toml'];
            
            if (importantExts.includes(ext) || item.name.includes('README') || item.name.includes('package') || item.name.includes('Cargo') || item.name.includes('Makefile')) {
                result += `${indent}📄 ${item.name}\n`;
                itemCount++;
            }
        }
    }
    
    return result;
}

// 获取项目结构 - 从数据库读取
app.get('/api/projects/:projectId/structure', (req, res) => {
    try {
        const { projectId } = req.params;
        
        // 先检查项目是否存在
        db.get("SELECT name FROM projects WHERE id = ?", [projectId], (err, project) => {
            if (err) {
                console.error('检查项目失败:', err);
                return res.status(500).json({ error: '检查项目失败' });
            }
            
            if (!project) {
                return res.status(404).json({ error: '项目不存在' });
            }
            
            // 获取项目结构
            db.get(
                "SELECT structure_data FROM project_structures WHERE project_id = ?",
                [projectId],
                (err, structureRow) => {
                    if (err) {
                        console.error('获取项目结构失败:', err);
                        return res.status(500).json({ error: '获取项目结构失败' });
                    }
                    
                    let projectStructure = [];
                    
                    if (structureRow && structureRow.structure_data) {
                        try {
                            projectStructure = JSON.parse(structureRow.structure_data);
                        } catch (e) {
                            console.error('解析项目结构失败:', e);
                        }
                    }
                    
                    // 如果没有存储的结构，从文件路径生成
                    if (projectStructure.length === 0) {
                        db.all(
                            "SELECT file_path FROM project_files WHERE project_id = ?",
                            [projectId],
                            (err, fileRows) => {
                                if (err) {
                                    console.error('获取文件路径失败:', err);
                                    return res.status(500).json({ error: '获取文件路径失败' });
                                }
                                
                                // 从文件路径生成结构
                                const filePaths = fileRows.map(row => row.file_path);
                                projectStructure = generateStructureFromFilePaths(filePaths);
                                
                                res.json({
                                    success: true,
                                    structure: projectStructure,
                                    fromFiles: true
                                });
                            }
                        );
                    } else {
                        res.json({
                            success: true,
                            structure: projectStructure,
                            fromFiles: false
                        });
                    }
                }
            );
        });
    } catch (error) {
        console.error('获取项目结构失败:', error);
        res.status(500).json({ error: '获取项目结构失败' });
    }
});

// 搜索文件和内容

// 语言环境检测API
app.get('/api/languages/environment', requireAuth, (req, res) => {
    const languageChecks = [
        { name: 'Node.js', command: 'node -v', key: 'javascript', required: false },
        { name: 'Python', command: 'python3 --version', key: 'python', required: false },
        { name: 'GCC', command: 'gcc --version', key: 'c', required: false },
        { name: 'G++', command: 'g++ --version', key: 'cpp', required: false },
        { name: 'Java', command: 'java -version', key: 'java', required: false },
        { name: 'Go', command: 'go version', key: 'go', required: false },
        { name: '.NET', command: 'dotnet --version', key: 'csharp', required: false },
        { name: 'Rust', command: 'rustc --version', key: 'rust', required: false }
    ];
    
    const results = {};
    let completed = 0;
    
    languageChecks.forEach(({ name, command, key, required }) => {
        exec(command, (error, stdout, stderr) => {
            results[key] = {
                name: name,
                installed: !error,
                version: error ? null : (stdout || stderr).split('\n')[0].trim(),
                installCommand: getInstallCommand(key),
                required: required
            };
            
            completed++;
            if (completed === languageChecks.length) {
                res.json({
                    success: true,
                    languages: results,
                    supportedLanguages: Object.keys(results).filter(k => results[k].installed),
                    missingLanguages: Object.keys(results).filter(k => !results[k].installed)
                });
            }
        });
    });
});

// 获取安装命令的辅助函数
function getInstallCommand(language) {
    const installCommands = {
        'javascript': 'Node.js通常预装，或访问 https://nodejs.org/',
        'python': 'sudo apt install python3',
        'c': 'sudo apt install gcc',
        'cpp': 'sudo apt install g++',
        'java': 'sudo apt install default-jdk',
        'go': '访问 https://golang.org/doc/install',
        'csharp': 'sudo snap install dotnet-sdk',
        'rust': 'curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh'
    };
    return installCommands[language] || '请查看官方文档';
}

// 代码检查和运行功能
const { spawn, exec } = require('child_process');
const { VM } = require('vm2');

// 语言检测函数
function detectLanguage(filename, content) {
    const ext = path.extname(filename).toLowerCase();
    const extensionMap = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.c': 'c',
        '.go': 'go',
        '.rs': 'rust',
        '.cs': 'csharp',
        '.php': 'php',
        '.rb': 'ruby',
        '.sh': 'bash',
        '.bat': 'batch',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json'
    };
    
    return extensionMap[ext] || 'text';
}

// 代码语法检查API
app.post('/api/code/check', requireAuth, (req, res) => {
    const { code, language, filename } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: '代码内容不能为空' });
    }
    
    const detectedLang = language || detectLanguage(filename, code);
    
    try {
        let result = { language: detectedLang, errors: [], warnings: [] };
        
        switch (detectedLang) {
            case 'javascript':
            case 'jsx':
                result = checkJavaScript(code, filename);
                break;
            case 'typescript':
            case 'tsx':
                result = checkTypeScript(code, filename);
                break;
            case 'python':
                result = checkPython(code, filename);
                break;
            case 'c':
                result = checkC(code, filename);
                break;
            case 'cpp':
                result = checkCpp(code, filename);
                break;
            case 'java':
                result = checkJava(code, filename);
                break;
            case 'go':
                result = checkGo(code, filename);
                break;
            case 'csharp':
                result = checkCSharp(code, filename);
                break;
            case 'rust':
                result = checkRust(code, filename);
                break;
            case 'json':
                result = checkJSON(code);
                break;
            default:
                result.warnings.push({
                    line: 1,
                    column: 1,
                    message: `暂不支持 ${detectedLang} 语言的语法检查`,
                    severity: 'warning'
                });
        }
        
        res.json(result);
    } catch (error) {
        console.error('代码检查失败:', error);
        res.status(500).json({ error: '代码检查失败: ' + error.message });
    }
});

// 代码运行API
app.post('/api/code/run', requireAuth, (req, res) => {
    const { code, language, filename, input = '' } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: '代码内容不能为空' });
    }
    
    const detectedLang = language || detectLanguage(filename, code);
    
    try {
        switch (detectedLang) {
            case 'javascript':
            case 'jsx':
                runJavaScript(code, input, res);
                break;
            case 'python':
                runPython(code, input, res);
                break;
            case 'c':
                runC(code, input, res);
                break;
            case 'cpp':
                runCpp(code, input, res);
                break;
            case 'java':
                runJava(code, input, res);
                break;
            case 'go':
                runGo(code, input, res);
                break;
            case 'csharp':
                runCSharp(code, input, res);
                break;
            case 'rust':
                runRust(code, input, res);
                break;
            case 'html':
                runHTML(code, res);
                break;
            default:
                res.status(400).json({ 
                    error: `暂不支持运行 ${detectedLang} 语言`,
                    output: '',
                    executionTime: 0
                });
        }
    } catch (error) {
        console.error('代码运行失败:', error);
        res.status(500).json({ 
            error: '代码运行失败: ' + error.message,
            output: '',
            executionTime: 0
        });
    }
});

// JavaScript语法检查
function checkJavaScript(code, filename) {
    const result = {
        language: 'javascript',
        errors: [],
        warnings: []
    };
    
    try {
        // 使用Node.js内置的VM模块进行语法检查
        const vm = require('vm');
        const script = new vm.Script(code, { 
            filename: filename || 'code.js',
            lineOffset: 0,
            columnOffset: 0
        });
        
        // 如果能成功创建Script对象，说明语法正确
        result.warnings.push({
            line: 1,
            column: 1,
            message: 'JavaScript语法检查通过',
            severity: 'info'
        });
        
    } catch (error) {
        // 解析语法错误
        let line = 1;
        let column = 1;
        
        // 尝试从错误消息中提取行号
        const lineMatch = error.message.match(/line (\d+)/i);
        if (lineMatch) {
            line = parseInt(lineMatch[1]);
        }
        
        // 尝试从错误消息中提取列号
        const columnMatch = error.message.match(/column (\d+)/i);
        if (columnMatch) {
            column = parseInt(columnMatch[1]);
        }
        
        // 尝试从堆栈中获取更精确的位置信息
        if (error.stack) {
            const stackMatch = error.stack.match(/:(\d+):(\d+)/);
            if (stackMatch) {
                line = parseInt(stackMatch[1]) || line;
                column = parseInt(stackMatch[2]) || column;
            }
        }
        
        result.errors.push({
            line: line,
            column: column,
            message: error.message,
            severity: 'error'
        });
    }
    
    // 简单的静态分析检查
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // 检查常见问题
        if (line.includes('console.log') && !line.includes('//')) {
            result.warnings.push({
                line: lineNum,
                column: line.indexOf('console.log') + 1,
                message: '建议在生产环境中移除console.log',
                severity: 'warning'
            });
        }
        
        // 检查未声明的变量（简单版）
        if (line.match(/^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/) && 
            !line.includes('var ') && !line.includes('let ') && !line.includes('const ')) {
            result.warnings.push({
                line: lineNum,
                column: 1,
                message: '建议使用let、const或var声明变量',
                severity: 'warning'
            });
        }
    }
    
    return result;
}

// TypeScript语法检查（简化版）
function checkTypeScript(code, filename) {
    // 目前简化为JavaScript检查，后续可扩展
    const result = checkJavaScript(code, filename);
    result.language = 'typescript';
    return result;
}

// Python语法检查
function checkPython(code, filename) {
    const result = {
        language: 'python',
        errors: [],
        warnings: []
    };
    
    // 简单的Python语法检查
    try {
        // 检查基本语法错误
        const lines = code.split('\n');
        let indentLevel = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;
            
            // 检查缩进
            const leadingSpaces = line.match(/^(\s*)/)[1].length;
            if (line.trim() && leadingSpaces % 4 !== 0) {
                result.warnings.push({
                    line: lineNum,
                    column: 1,
                    message: '建议使用4个空格缩进',
                    severity: 'warning'
                });
            }
            
            // 检查语法结构
            if (line.includes('def ') && !line.endsWith(':')) {
                result.errors.push({
                    line: lineNum,
                    column: line.length,
                    message: '函数定义缺少冒号',
                    severity: 'error'
                });
            }
            
            if ((line.includes('if ') || line.includes('for ') || line.includes('while ')) && 
                !line.endsWith(':') && line.trim()) {
                result.errors.push({
                    line: lineNum,
                    column: line.length,
                    message: '控制结构缺少冒号',
                    severity: 'error'
                });
            }
        }
    } catch (error) {
        result.errors.push({
            line: 1,
            column: 1,
            message: '语法检查出错: ' + error.message,
            severity: 'error'
        });
    }
    
    return result;
}

// JSON语法检查
function checkJSON(code) {
    const result = {
        language: 'json',
        errors: [],
        warnings: []
    };
    
    try {
        JSON.parse(code);
    } catch (error) {
        const match = error.message.match(/position (\d+)/);
        const position = match ? parseInt(match[1]) : 1;
        
        // 计算行号和列号
        const lines = code.substring(0, position).split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;
        
        result.errors.push({
            line: line,
            column: column,
            message: error.message,
            severity: 'error'
        });
    }
    
    return result;
}

// JavaScript代码运行
function runJavaScript(code, input, res) {
    const startTime = Date.now();
    
    try {
        const vm = new VM({
            timeout: 5000, // 5秒超时
            sandbox: {
                console: {
                    log: (...args) => {
                        output += args.join(' ') + '\n';
                    },
                    error: (...args) => {
                        output += 'Error: ' + args.join(' ') + '\n';
                    }
                },
                input: input,
                setTimeout: setTimeout,
                setInterval: setInterval,
                clearTimeout: clearTimeout,
                clearInterval: clearInterval
            }
        });
        
        let output = '';
        
        // 包装代码以捕获返回值
        const wrappedCode = `
            ${code}
        `;
        
        const result = vm.run(wrappedCode);
        
        if (result !== undefined) {
            output += 'Return value: ' + String(result) + '\n';
        }
        
        const executionTime = Date.now() - startTime;
        
        res.json({
            output: output || '执行完成，无输出',
            error: null,
            executionTime: executionTime
        });
        
    } catch (error) {
        const executionTime = Date.now() - startTime;
        res.json({
            output: '',
            error: error.message,
            executionTime: executionTime
        });
    }
}

// Python代码运行
function runPython(code, input, res) {
    const startTime = Date.now();
    
    // 创建临时文件
    const tempFile = path.join(__dirname, 'temp_python_' + Date.now() + '.py');
    
    fs.writeFileSync(tempFile, code);
    
    const pythonProcess = spawn('python3', [tempFile], {
        timeout: 10000 // 10秒超时
    });
    
    let output = '';
    let errorOutput = '';
    
    // 如果有输入，发送给进程
    if (input) {
        pythonProcess.stdin.write(input);
        pythonProcess.stdin.end();
    }
    
    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
        const executionTime = Date.now() - startTime;
        
        // 清理临时文件
        try {
            fs.unlinkSync(tempFile);
        } catch (e) {
            console.error('清理临时文件失败:', e);
        }
        
        res.json({
            output: output || '执行完成，无输出',
            error: errorOutput || (code !== 0 ? `进程退出码: ${code}` : null),
            executionTime: executionTime
        });
    });
    
    pythonProcess.on('error', (error) => {
        const executionTime = Date.now() - startTime;
        
        // 清理临时文件
        try {
            fs.unlinkSync(tempFile);
        } catch (e) {
            console.error('清理临时文件失败:', e);
        }
        
        res.json({
            output: '',
            error: 'Python执行失败: ' + error.message,
            executionTime: executionTime
        });
    });
}

// HTML代码运行（返回预览URL）
function runHTML(code, res) {
    const startTime = Date.now();
    
    try {
        // 创建临时HTML文件
        const tempFile = path.join(__dirname, 'public', 'temp_html_' + Date.now() + '.html');
        
        fs.writeFileSync(tempFile, code);
        
        const executionTime = Date.now() - startTime;
        const fileName = path.basename(tempFile);
        
        res.json({
            output: '生成HTML文件成功',
            error: null,
            executionTime: executionTime,
            previewUrl: `http://localhost:${PORT}/${fileName}`
        });
        
        // 5分钟后清理临时文件
        setTimeout(() => {
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                console.error('清理临时HTML文件失败:', e);
            }
        }, 5 * 60 * 1000);
        
    } catch (error) {
        const executionTime = Date.now() - startTime;
        res.json({
            output: '',
            error: 'HTML文件生成失败: ' + error.message,
            executionTime: executionTime
        });
    }
}

// C语言语法检查
function checkC(code, filename) {
    const result = {
        language: 'c',
        errors: [],
        warnings: []
    };
    
    try {
        const lines = code.split('\n');
        let hasMain = false;
        let hasInclude = false;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;
            
            // 检查是否有main函数
            if (line.includes('int main(') || line.includes('int main (')) {
                hasMain = true;
            }
            
            // 检查是否有include语句
            if (line.startsWith('#include')) {
                hasInclude = true;
            }
            
            // 检查括号匹配
            for (const char of line) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            // 检查常见语法错误
            if (line.includes('printf(') && !line.includes('"')) {
                result.warnings.push({
                    line: lineNum,
                    column: line.indexOf('printf(') + 1,
                    message: 'printf函数通常需要格式字符串',
                    severity: 'warning'
                });
            }
            
            // 检查分号
            if (line.length > 0 && !line.startsWith('#') && !line.startsWith('//') && 
                !line.startsWith('/*') && !line.endsWith(';') && !line.endsWith('{') && 
                !line.endsWith('}') && line.includes('=')) {
                result.warnings.push({
                    line: lineNum,
                    column: line.length,
                    message: '语句可能缺少分号',
                    severity: 'warning'
                });
            }
        }
        
        // 检查基本结构
        if (!hasMain) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议包含main函数作为程序入口',
                severity: 'warning'
            });
        }
        
        if (!hasInclude) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议包含必要的头文件（如stdio.h）',
                severity: 'warning'
            });
        }
        
        if (braceCount !== 0) {
            result.errors.push({
                line: lines.length,
                column: 1,
                message: '括号不匹配',
                severity: 'error'
            });
        }
        
        if (result.errors.length === 0) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: 'C语言基础语法检查通过',
                severity: 'info'
            });
        }
        
    } catch (error) {
        result.errors.push({
            line: 1,
            column: 1,
            message: '语法检查出错: ' + error.message,
            severity: 'error'
        });
    }
    
    return result;
}

// C++语言语法检查
function checkCpp(code, filename) {
    const result = {
        language: 'cpp',
        errors: [],
        warnings: []
    };
    
    try {
        const lines = code.split('\n');
        let hasMain = false;
        let hasInclude = false;
        let hasNamespace = false;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;
            
            // 检查是否有main函数
            if (line.includes('int main(') || line.includes('int main (')) {
                hasMain = true;
            }
            
            // 检查是否有include语句
            if (line.startsWith('#include')) {
                hasInclude = true;
            }
            
            // 检查是否使用了命名空间
            if (line.includes('using namespace std')) {
                hasNamespace = true;
            }
            
            // 检查括号匹配
            for (const char of line) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            // 检查常见语法错误
            if (line.includes('cout') && !line.includes('<<')) {
                result.warnings.push({
                    line: lineNum,
                    column: line.indexOf('cout') + 1,
                    message: 'cout通常需要使用<<操作符',
                    severity: 'warning'
                });
            }
            
            if (line.includes('cin') && !line.includes('>>')) {
                result.warnings.push({
                    line: lineNum,
                    column: line.indexOf('cin') + 1,
                    message: 'cin通常需要使用>>操作符',
                    severity: 'warning'
                });
            }
            
            // 检查分号
            if (line.length > 0 && !line.startsWith('#') && !line.startsWith('//') && 
                !line.startsWith('/*') && !line.endsWith(';') && !line.endsWith('{') && 
                !line.endsWith('}') && (line.includes('=') || line.includes('cout') || line.includes('cin'))) {
                result.warnings.push({
                    line: lineNum,
                    column: line.length,
                    message: '语句可能缺少分号',
                    severity: 'warning'
                });
            }
        }
        
        // 检查基本结构
        if (!hasMain) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议包含main函数作为程序入口',
                severity: 'warning'
            });
        }
        
        if (!hasInclude) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议包含必要的头文件（如iostream）',
                severity: 'warning'
            });
        }
        
        if (hasInclude && line.includes('iostream') && !hasNamespace) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议使用"using namespace std;"简化代码',
                severity: 'warning'
            });
        }
        
        if (braceCount !== 0) {
            result.errors.push({
                line: lines.length,
                column: 1,
                message: '括号不匹配',
                severity: 'error'
            });
        }
        
        if (result.errors.length === 0) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: 'C++语言基础语法检查通过',
                severity: 'info'
            });
        }
        
    } catch (error) {
        result.errors.push({
            line: 1,
            column: 1,
            message: '语法检查出错: ' + error.message,
            severity: 'error'
        });
    }
    
    return result;
}

// C语言代码运行
function runC(code, input, res) {
    const startTime = Date.now();
    
    // 创建临时文件
    const tempFileName = 'temp_c_' + Date.now();
    const sourceFile = path.join(__dirname, tempFileName + '.c');
    const executableFile = path.join(__dirname, tempFileName);
    
    fs.writeFileSync(sourceFile, code);
    
    // 编译C代码
    const compileProcess = spawn('gcc', ['-o', executableFile, sourceFile], {
        timeout: 10000 // 10秒编译超时
    });
    
    let compileOutput = '';
    let compileError = '';
    
    compileProcess.stdout.on('data', (data) => {
        compileOutput += data.toString();
    });
    
    compileProcess.stderr.on('data', (data) => {
        compileError += data.toString();
    });
    
    compileProcess.on('close', (code) => {
        if (code !== 0) {
            // 编译失败
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile, executableFile]);
            
            res.json({
                output: compileOutput,
                error: `编译失败:\n${compileError}`,
                executionTime: executionTime
            });
            return;
        }
        
        // 编译成功，运行程序
        const runProcess = spawn(executableFile, [], {
            timeout: 10000 // 10秒运行超时
        });
        
        let output = '';
        let errorOutput = '';
        
        // 如果有输入，发送给进程
        if (input) {
            runProcess.stdin.write(input);
            runProcess.stdin.end();
        }
        
        runProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        runProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        runProcess.on('close', (exitCode) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile, executableFile]);
            
            res.json({
                output: output || '程序执行完成，无输出',
                error: errorOutput || (exitCode !== 0 ? `程序退出码: ${exitCode}` : null),
                executionTime: executionTime
            });
        });
        
        runProcess.on('error', (error) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile, executableFile]);
            
            res.json({
                output: '',
                error: 'C程序执行失败: ' + error.message,
                executionTime: executionTime
            });
        });
    });
    
    compileProcess.on('error', (error) => {
        const executionTime = Date.now() - startTime;
        
        // 清理临时文件
        cleanupTempFiles([sourceFile, executableFile]);
        
        if (error.code === 'ENOENT') {
            res.json({
                output: '',
                error: '未安装GCC编译器。请安装GCC以支持C语言编译运行。',
                executionTime: executionTime
            });
        } else {
            res.json({
                output: '',
                error: 'C代码编译失败: ' + error.message,
                executionTime: executionTime
            });
        }
    });
}

// C++语言代码运行
function runCpp(code, input, res) {
    const startTime = Date.now();
    
    // 创建临时文件
    const tempFileName = 'temp_cpp_' + Date.now();
    const sourceFile = path.join(__dirname, tempFileName + '.cpp');
    const executableFile = path.join(__dirname, tempFileName);
    
    fs.writeFileSync(sourceFile, code);
    
    // 编译C++代码
    const compileProcess = spawn('g++', ['-o', executableFile, sourceFile], {
        timeout: 10000 // 10秒编译超时
    });
    
    let compileOutput = '';
    let compileError = '';
    
    compileProcess.stdout.on('data', (data) => {
        compileOutput += data.toString();
    });
    
    compileProcess.stderr.on('data', (data) => {
        compileError += data.toString();
    });
    
    compileProcess.on('close', (code) => {
        if (code !== 0) {
            // 编译失败
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile, executableFile]);
            
            res.json({
                output: compileOutput,
                error: `编译失败:\n${compileError}`,
                executionTime: executionTime
            });
            return;
        }
        
        // 编译成功，运行程序
        const runProcess = spawn(executableFile, [], {
            timeout: 10000 // 10秒运行超时
        });
        
        let output = '';
        let errorOutput = '';
        
        // 如果有输入，发送给进程
        if (input) {
            runProcess.stdin.write(input);
            runProcess.stdin.end();
        }
        
        runProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        runProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        runProcess.on('close', (exitCode) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件  
            cleanupTempFiles([sourceFile, executableFile]);
            
            res.json({
                output: output || '程序执行完成，无输出',
                error: errorOutput || (exitCode !== 0 ? `程序退出码: ${exitCode}` : null),
                executionTime: executionTime
            });
        });
        
        runProcess.on('error', (error) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile, executableFile]);
            
            res.json({
                output: '',
                error: 'C++程序执行失败: ' + error.message,
                executionTime: executionTime
            });
        });
    });
    
    compileProcess.on('error', (error) => {
        const executionTime = Date.now() - startTime;
        
        // 清理临时文件
        cleanupTempFiles([sourceFile, executableFile]);
        
        if (error.code === 'ENOENT') {
            res.json({
                output: '',
                error: '未安装G++编译器。请安装G++以支持C++语言编译运行。',
                executionTime: executionTime
            });
        } else {
            res.json({
                output: '',
                error: 'C++代码编译失败: ' + error.message,
                executionTime: executionTime
            });
        }
    });
}

// 清理临时文件的辅助函数
function cleanupTempFiles(files) {
    files.forEach(file => {
        try {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        } catch (e) {
            console.error('清理临时文件失败:', e);
        }
    });
}

// Java语言语法检查
function checkJava(code, filename) {
    const result = {
        language: 'java',
        errors: [],
        warnings: []
    };
    
    try {
        const lines = code.split('\n');
        let hasMain = false;
        let hasPackage = false;
        let hasClass = false;
        let braceCount = 0;
        let className = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;
            
            // 检查包声明
            if (line.startsWith('package ')) {
                hasPackage = true;
            }
            
            // 检查类声明
            if (line.includes('class ')) {
                hasClass = true;
                const match = line.match(/class\s+(\w+)/);
                if (match) {
                    className = match[1];
                }
            }
            
            // 检查是否有main方法
            if (line.includes('public static void main(') || line.includes('public static void main (')) {
                hasMain = true;
            }
            
            // 检查括号匹配
            for (const char of line) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            // 检查分号
            if (line.length > 0 && !line.startsWith('//') && !line.startsWith('/*') &&
                !line.startsWith('package') && !line.startsWith('import') &&
                !line.endsWith(';') && !line.endsWith('{') && !line.endsWith('}') &&
                (line.includes('=') || line.includes('System.out'))) {
                result.warnings.push({
                    line: lineNum,
                    column: line.length,
                    message: '语句可能缺少分号',
                    severity: 'warning'
                });
            }
        }
        
        // 检查基本结构
        if (!hasClass) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议包含至少一个类声明',
                severity: 'warning'
            });
        }
        
        if (!hasMain) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议包含main方法作为程序入口',
                severity: 'warning'
            });
        }
        
        if (braceCount !== 0) {
            result.errors.push({
                line: lines.length,
                column: 1,
                message: '括号不匹配',
                severity: 'error'
            });
        }
        
        // 检查类名和文件名是否匹配（如果有类名的话）
        if (className && filename) {
            const fileBaseName = path.basename(filename, '.java');
            if (className !== fileBaseName) {
                result.warnings.push({
                    line: 1,
                    column: 1,
                    message: `类名 "${className}" 与文件名 "${fileBaseName}" 不匹配`,
                    severity: 'warning'
                });
            }
        }
        
        if (result.errors.length === 0) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: 'Java语言基础语法检查通过',
                severity: 'info'
            });
        }
        
    } catch (error) {
        result.errors.push({
            line: 1,
            column: 1,
            message: '语法检查出错: ' + error.message,
            severity: 'error'
        });
    }
    
    return result;
}

// Go语言语法检查
function checkGo(code, filename) {
    const result = {
        language: 'go',
        errors: [],
        warnings: []
    };
    
    try {
        const lines = code.split('\n');
        let hasPackage = false;
        let hasMain = false;
        let hasImport = false;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;
            
            // 检查包声明
            if (line.startsWith('package ')) {
                hasPackage = true;
            }
            
            // 检查导入语句
            if (line.startsWith('import ') || line === 'import (') {
                hasImport = true;
            }
            
            // 检查是否有main函数
            if (line.includes('func main()') || line.includes('func main ()')) {
                hasMain = true;
            }
            
            // 检查括号匹配
            for (const char of line) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            // 检查fmt.Print相关语句
            if (line.includes('fmt.Print') && !hasImport) {
                result.warnings.push({
                    line: lineNum,
                    column: line.indexOf('fmt.Print') + 1,
                    message: '使用fmt包需要先导入',
                    severity: 'warning'
                });
            }
        }
        
        // 检查基本结构
        if (!hasPackage) {
            result.errors.push({
                line: 1,
                column: 1,
                message: 'Go程序必须包含package声明',
                severity: 'error'
            });
        }
        
        if (!hasMain && hasPackage && lines.some(line => line.includes('package main'))) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '主包应该包含main函数',
                severity: 'warning'
            });
        }
        
        if (braceCount !== 0) {
            result.errors.push({
                line: lines.length,
                column: 1,
                message: '括号不匹配',
                severity: 'error'
            });
        }
        
        if (result.errors.length === 0) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: 'Go语言基础语法检查通过',
                severity: 'info'
            });
        }
        
    } catch (error) {
        result.errors.push({
            line: 1,
            column: 1,
            message: '语法检查出错: ' + error.message,
            severity: 'error'
        });
    }
    
    return result;
}

// C#语言语法检查
function checkCSharp(code, filename) {
    const result = {
        language: 'csharp',
        errors: [],
        warnings: []
    };
    
    try {
        const lines = code.split('\n');
        let hasUsing = false;
        let hasNamespace = false;
        let hasClass = false;
        let hasMain = false;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;
            
            // 检查using语句
            if (line.startsWith('using ')) {
                hasUsing = true;
            }
            
            // 检查命名空间
            if (line.startsWith('namespace ')) {
                hasNamespace = true;
            }
            
            // 检查类声明
            if (line.includes('class ')) {
                hasClass = true;
            }
            
            // 检查是否有Main方法
            if (line.includes('static void Main(') || line.includes('static void Main (')) {
                hasMain = true;
            }
            
            // 检查括号匹配
            for (const char of line) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            // 检查Console相关语句
            if (line.includes('Console.') && !hasUsing) {
                result.warnings.push({
                    line: lineNum,
                    column: line.indexOf('Console.') + 1,
                    message: '建议添加"using System;"以简化代码',
                    severity: 'warning'
                });
            }
            
            // 检查分号
            if (line.length > 0 && !line.startsWith('//') && !line.startsWith('/*') &&
                !line.startsWith('using') && !line.startsWith('namespace') &&
                !line.endsWith(';') && !line.endsWith('{') && !line.endsWith('}') &&
                (line.includes('=') || line.includes('Console.'))) {
                result.warnings.push({
                    line: lineNum,
                    column: line.length,
                    message: '语句可能缺少分号',
                    severity: 'warning'
                });
            }
        }
        
        // 检查基本结构
        if (!hasClass) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议包含至少一个类声明',
                severity: 'warning'
            });
        }
        
        if (!hasMain) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议包含Main方法作为程序入口',
                severity: 'warning'
            });
        }
        
        if (braceCount !== 0) {
            result.errors.push({
                line: lines.length,
                column: 1,
                message: '括号不匹配',
                severity: 'error'
            });
        }
        
        if (result.errors.length === 0) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: 'C#语言基础语法检查通过',
                severity: 'info'
            });
        }
        
    } catch (error) {
        result.errors.push({
            line: 1,
            column: 1,
            message: '语法检查出错: ' + error.message,
            severity: 'error'
        });
    }
    
    return result;
}

// Rust语言语法检查
function checkRust(code, filename) {
    const result = {
        language: 'rust',
        errors: [],
        warnings: []
    };
    
    try {
        const lines = code.split('\n');
        let hasMain = false;
        let hasUse = false;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;
            
            // 检查use语句
            if (line.startsWith('use ')) {
                hasUse = true;
            }
            
            // 检查是否有main函数
            if (line.includes('fn main()') || line.includes('fn main ()')) {
                hasMain = true;
            }
            
            // 检查括号匹配
            for (const char of line) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
            }
            
            // 检查println!宏
            if (line.includes('println!(') && !line.endsWith(';')) {
                result.warnings.push({
                    line: lineNum,
                    column: line.length,
                    message: 'println!宏调用可能缺少分号',
                    severity: 'warning'
                });
            }
        }
        
        // 检查基本结构
        if (!hasMain) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: '建议包含main函数作为程序入口',
                severity: 'warning'
            });
        }
        
        if (braceCount !== 0) {
            result.errors.push({
                line: lines.length,
                column: 1,
                message: '括号不匹配',
                severity: 'error'
            });
        }
        
        if (result.errors.length === 0) {
            result.warnings.push({
                line: 1,
                column: 1,
                message: 'Rust语言基础语法检查通过',
                severity: 'info'
            });
        }
        
    } catch (error) {
        result.errors.push({
            line: 1,
            column: 1,
            message: '语法检查出错: ' + error.message,
            severity: 'error'
        });
    }
    
    return result;
}

// Java代码运行
function runJava(code, input, res) {
    const startTime = Date.now();
    
    // 检查Java是否安装
    exec('java -version', (error) => {
        if (error) {
            const executionTime = Date.now() - startTime;
            return res.json({
                output: '',
                error: '未安装Java环境。请先安装Java JDK。\n安装命令: sudo apt install default-jdk',
                executionTime: executionTime
            });
        }
        
        // 提取类名
        let className = 'Main';
        const classMatch = code.match(/public\s+class\s+(\w+)/);
        if (classMatch) {
            className = classMatch[1];
        }
        
        // 创建临时文件
        const tempFileName = 'temp_java_' + Date.now();
        const sourceFile = path.join(__dirname, className + '.java');
        const classFile = path.join(__dirname, className + '.class');
        
        fs.writeFileSync(sourceFile, code);
        
        // 编译Java代码
        const compileProcess = spawn('javac', [sourceFile], {
            timeout: 15000 // 15秒编译超时
        });
        
        let compileOutput = '';
        let compileError = '';
        
        compileProcess.stdout.on('data', (data) => {
            compileOutput += data.toString();
        });
        
        compileProcess.stderr.on('data', (data) => {
            compileError += data.toString();
        });
        
        compileProcess.on('close', (code) => {
            if (code !== 0) {
                // 编译失败
                const executionTime = Date.now() - startTime;
                
                // 清理临时文件
                cleanupTempFiles([sourceFile, classFile]);
                
                res.json({
                    output: compileOutput,
                    error: `编译失败:\n${compileError}`,
                    executionTime: executionTime
                });
                return;
            }
            
            // 编译成功，运行程序
            const runProcess = spawn('java', [className], {
                cwd: __dirname,
                timeout: 10000 // 10秒运行超时
            });
            
            let output = '';
            let errorOutput = '';
            
            // 如果有输入，发送给进程
            if (input) {
                runProcess.stdin.write(input);
                runProcess.stdin.end();
            }
            
            runProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            runProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            runProcess.on('close', (exitCode) => {
                const executionTime = Date.now() - startTime;
                
                // 清理临时文件
                cleanupTempFiles([sourceFile, classFile]);
                
                res.json({
                    output: output || '程序执行完成，无输出',
                    error: errorOutput || (exitCode !== 0 ? `程序退出码: ${exitCode}` : null),
                    executionTime: executionTime
                });
            });
            
            runProcess.on('error', (error) => {
                const executionTime = Date.now() - startTime;
                
                // 清理临时文件
                cleanupTempFiles([sourceFile, classFile]);
                
                res.json({
                    output: '',
                    error: 'Java程序执行失败: ' + error.message,
                    executionTime: executionTime
                });
            });
        });
        
        compileProcess.on('error', (error) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile, classFile]);
            
            res.json({
                output: '',
                error: 'Java代码编译失败: ' + error.message,
                executionTime: executionTime
            });
        });
    });
}

// Go代码运行
function runGo(code, input, res) {
    const startTime = Date.now();
    
    // 检查Go是否安装
    exec('go version', (error) => {
        if (error) {
            const executionTime = Date.now() - startTime;
            return res.json({
                output: '',
                error: '未安装Go环境。请先安装Go语言。\n安装说明: https://golang.org/doc/install',
                executionTime: executionTime
            });
        }
        
        // 创建临时文件
        const tempFileName = 'temp_go_' + Date.now();
        const sourceFile = path.join(__dirname, tempFileName + '.go');
        
        fs.writeFileSync(sourceFile, code);
        
        // 运行Go代码
        const runProcess = spawn('go', ['run', sourceFile], {
            timeout: 15000 // 15秒超时
        });
        
        let output = '';
        let errorOutput = '';
        
        // 如果有输入，发送给进程
        if (input) {
            runProcess.stdin.write(input);
            runProcess.stdin.end();
        }
        
        runProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        runProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        runProcess.on('close', (exitCode) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile]);
            
            res.json({
                output: output || '程序执行完成，无输出',
                error: errorOutput || (exitCode !== 0 ? `程序退出码: ${exitCode}` : null),
                executionTime: executionTime
            });
        });
        
        runProcess.on('error', (error) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile]);
            
            res.json({
                output: '',
                error: 'Go程序执行失败: ' + error.message,
                executionTime: executionTime
            });
        });
    });
}

// C#代码运行
function runCSharp(code, input, res) {
    const startTime = Date.now();
    
    // 检查.NET是否安装
    exec('dotnet --version', (error) => {
        if (error) {
            const executionTime = Date.now() - startTime;
            return res.json({
                output: '',
                error: '未安装.NET环境。请先安装.NET SDK。\n安装命令: sudo snap install dotnet-sdk',
                executionTime: executionTime
            });
        }
        
        // 创建临时文件
        const tempFileName = 'temp_csharp_' + Date.now();
        const sourceFile = path.join(__dirname, tempFileName + '.cs');
        
        fs.writeFileSync(sourceFile, code);
        
        // 编译并运行C#代码
        const runProcess = spawn('dotnet', ['script', sourceFile], {
            timeout: 15000 // 15秒超时
        });
        
        let output = '';
        let errorOutput = '';
        
        // 如果有输入，发送给进程
        if (input) {
            runProcess.stdin.write(input);
            runProcess.stdin.end();
        }
        
        runProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        runProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        runProcess.on('close', (exitCode) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile]);
            
            res.json({
                output: output || '程序执行完成，无输出',
                error: errorOutput || (exitCode !== 0 ? `程序退出码: ${exitCode}` : null),
                executionTime: executionTime
            });
        });
        
        runProcess.on('error', (error) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile]);
            
            res.json({
                output: '',
                error: 'C#程序执行失败: ' + error.message,
                executionTime: executionTime
            });
        });
    });
}

// Rust代码运行
function runRust(code, input, res) {
    const startTime = Date.now();
    
    // 检查Rust是否安装
    exec('rustc --version', (error) => {
        if (error) {
            const executionTime = Date.now() - startTime;
            return res.json({
                output: '',
                error: '未安装Rust环境。请先安装Rust。\n安装命令: curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh',
                executionTime: executionTime
            });
        }
        
        // 创建临时文件
        const tempFileName = 'temp_rust_' + Date.now();
        const sourceFile = path.join(__dirname, tempFileName + '.rs');
        const executableFile = path.join(__dirname, tempFileName);
        
        fs.writeFileSync(sourceFile, code);
        
        // 编译Rust代码
        const compileProcess = spawn('rustc', ['-o', executableFile, sourceFile], {
            timeout: 20000 // 20秒编译超时
        });
        
        let compileOutput = '';
        let compileError = '';
        
        compileProcess.stdout.on('data', (data) => {
            compileOutput += data.toString();
        });
        
        compileProcess.stderr.on('data', (data) => {
            compileError += data.toString();
        });
        
        compileProcess.on('close', (code) => {
            if (code !== 0) {
                // 编译失败
                const executionTime = Date.now() - startTime;
                
                // 清理临时文件
                cleanupTempFiles([sourceFile, executableFile]);
                
                res.json({
                    output: compileOutput,
                    error: `编译失败:\n${compileError}`,
                    executionTime: executionTime
                });
                return;
            }
            
            // 编译成功，运行程序
            const runProcess = spawn(executableFile, [], {
                timeout: 10000 // 10秒运行超时
            });
            
            let output = '';
            let errorOutput = '';
            
            // 如果有输入，发送给进程
            if (input) {
                runProcess.stdin.write(input);
                runProcess.stdin.end();
            }
            
            runProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            runProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            runProcess.on('close', (exitCode) => {
                const executionTime = Date.now() - startTime;
                
                // 清理临时文件
                cleanupTempFiles([sourceFile, executableFile]);
                
                res.json({
                    output: output || '程序执行完成，无输出',
                    error: errorOutput || (exitCode !== 0 ? `程序退出码: ${exitCode}` : null),
                    executionTime: executionTime
                });
            });
            
            runProcess.on('error', (error) => {
                const executionTime = Date.now() - startTime;
                
                // 清理临时文件
                cleanupTempFiles([sourceFile, executableFile]);
                
                res.json({
                    output: '',
                    error: 'Rust程序执行失败: ' + error.message,
                    executionTime: executionTime
                });
            });
        });
        
        compileProcess.on('error', (error) => {
            const executionTime = Date.now() - startTime;
            
            // 清理临时文件
            cleanupTempFiles([sourceFile, executableFile]);
            
            res.json({
                output: '',
                error: 'Rust代码编译失败: ' + error.message,
                executionTime: executionTime
            });
        });
    });
}

// AI对话历史记录API接口

// 保存对话记录
app.post('/api/chat/save', requireAuth, (req, res) => {
    const { chat_session_id, messages } = req.body;
    const user_id = req.user.user_id;

    if (!chat_session_id || !messages) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO chat_history (user_id, chat_session_id, messages, updated_at)
        VALUES (?, ?, ?, datetime('now'))
    `);

    stmt.run([user_id, chat_session_id, JSON.stringify(messages)], function(err) {
        if (err) {
            console.error('保存对话记录失败:', err);
            return res.status(500).json({ error: '保存对话记录失败' });
        }
        res.json({ success: true, id: this.lastID });
    });

    stmt.finalize();
});

// 获取对话历史记录列表
app.get('/api/chat/history', requireAuth, (req, res) => {
    const user_id = req.user.user_id;

    db.all(`
        SELECT id, chat_session_id, messages, created_at, updated_at
        FROM chat_history 
        WHERE user_id = ? 
        ORDER BY updated_at DESC 
        LIMIT 10
    `, [user_id], (err, rows) => {
        if (err) {
            console.error('获取对话历史失败:', err);
            return res.status(500).json({ error: '获取对话历史失败' });
        }

        const history = rows.map(row => ({
            id: row.id,
            chat_session_id: row.chat_session_id,
            messages: JSON.parse(row.messages),
            created_at: row.created_at,
            updated_at: row.updated_at
        }));

        res.json({ history });
    });
});

// 删除指定对话记录
app.delete('/api/chat/history/:id', requireAuth, (req, res) => {
    const chat_id = req.params.id;
    const user_id = req.user.user_id;

    db.run(`
        DELETE FROM chat_history 
        WHERE id = ? AND user_id = ?
    `, [chat_id, user_id], function(err) {
        if (err) {
            console.error('删除对话记录失败:', err);
            return res.status(500).json({ error: '删除对话记录失败' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: '对话记录不存在或无权限删除' });
        }

        res.json({ success: true });
    });
});

// 清空所有对话记录
app.delete('/api/chat/history', requireAuth, (req, res) => {
    const user_id = req.user.user_id;

    db.run(`
        DELETE FROM chat_history 
        WHERE user_id = ?
    `, [user_id], function(err) {
        if (err) {
            console.error('清空对话记录失败:', err);
            return res.status(500).json({ error: '清空对话记录失败' });
        }

        res.json({ success: true, deleted_count: this.changes });
    });
});

// AI聊天API接口
app.post('/api/chat', requireAuth, async (req, res) => {
    const { message, context } = req.body;
    const user_id = req.user.user_id;

    console.log('收到AI聊天请求:', { 
        user_id, 
        message: message?.substring(0, 50) + '...',
        hasContext: !!context
    });

    if (!message) {
        return res.status(400).json({ error: '缺少消息内容' });
    }

    try {
        // 获取用户的AI配置
        const userAIConfig = await new Promise((resolve, reject) => {
            db.get(
                'SELECT ai_api_url, ai_api_key FROM users WHERE id = ?',
                [user_id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        console.log('用户AI配置:', { 
            user_id, 
            hasConfig: !!userAIConfig,
            hasUrl: !!userAIConfig?.ai_api_url,
            hasKey: !!userAIConfig?.ai_api_key,
            url: userAIConfig?.ai_api_url
        });

        if (!userAIConfig || !userAIConfig.ai_api_url || !userAIConfig.ai_api_key) {
            return res.status(400).json({ error: '请先配置AI API设置' });
        }

        // 构建系统提示词
        let systemPrompt = `你是一个智能代码助手，专门帮助用户分析、创建和修改代码文件。

你的核心能力：
1. 📁 分析当前打开的文件内容和结构
2. 🆕 创建新的代码文件（自动选择合适的文件名和位置）
3. ✏️ 修改现有文件内容（包括直接编辑当前文件）
4. 💡 提供编程建议、解释和最佳实践

重要指令：
- 当用户询问"当前是什么文件"、"这是什么文件"、"分析当前文件"等问题时，如果有当前文件上下文，请分析并说明文件类型、主要功能、技术栈等信息。
- 当用户要求"创建C++文件"、"帮我创建一个HelloWorld"、"生成一个Python脚本"等时，必须使用JSON格式回复。
- 当用户要求扩展、修改、优化当前文件时（如"扩展当前C++文件让它变成可以计算加减法的计算器"），必须使用modify_file操作，filePath使用当前文件路径。
- 文件路径应该合理，如：C++文件用 "main.cpp" 或 "hello.cpp"，Python文件用 "main.py"，JavaScript文件用 "index.js" 等。

⚠️ 重要：当需要执行文件操作时（创建、修改文件），必须严格按照以下格式返回纯JSON，不要添加任何其他文字说明：

创建文件格式：
\`\`\`json
{
    "action": "create_file",
    "filePath": "文件名（如 main.cpp, hello.py）",
    "content": "完整的文件内容",
    "message": "我将为您创建一个[文件类型]文件..."
}
\`\`\`

修改文件格式：
\`\`\`json
{
    "action": "modify_file", 
    "filePath": "目标文件路径",
    "content": "修改后的完整文件内容",
    "message": "我将对该文件进行以下修改..."
}
\`\`\`

分析文件格式：
\`\`\`json
{
    "action": "analyze_file",
    "message": "详细的文件分析结果"
}
\`\`\`

当修改当前文件时，用户会看到一个对比界面，显示原始内容和修改后的内容，可以选择保留修改或撤销。

请始终用中文回答，语气友好专业。`;

        // 添加上下文信息
        if (context) {
            systemPrompt += `\n\n📍 当前工作环境：`;
            
            if (context.currentProject) {
                systemPrompt += `\n• 项目：${context.currentProject.name} (ID: ${context.currentProject.id})`;
                systemPrompt += `\n• 项目路径：${context.currentProject.path}`;
            } else {
                systemPrompt += `\n• 项目：未选择项目`;
            }
            
            if (context.currentFile) {
                systemPrompt += `\n• 当前文件：${context.currentFile}`;
                
                // 分析文件类型
                const fileExt = context.currentFile.split('.').pop().toLowerCase();
                const fileTypeMap = {
                    'js': 'JavaScript',
                    'ts': 'TypeScript', 
                    'py': 'Python',
                    'cpp': 'C++',
                    'c': 'C语言',
                    'java': 'Java',
                    'html': 'HTML',
                    'css': 'CSS',
                    'json': 'JSON配置文件'
                };
                const fileType = fileTypeMap[fileExt] || '代码文件';
                systemPrompt += `\n• 文件类型：${fileType}`;
                
                if (context.currentFileContent) {
                    const contentLength = context.currentFileContent.length;
                    const lineCount = context.currentFileContent.split('\n').length;
                    systemPrompt += `\n• 文件大小：${contentLength} 字符，${lineCount} 行`;
                    systemPrompt += `\n\n📄 当前文件内容：\n\`\`\`${fileExt}\n${context.currentFileContent}\n\`\`\``;
                }
            } else {
                systemPrompt += `\n• 当前文件：无文件打开`;
            }
            
            systemPrompt += `\n\n💡 提示：当用户询问当前文件时，请基于上述信息进行分析。创建新文件时会保存到当前项目中。`;
        }

        // 调用AI API
        const modelName = getModelForProvider(userAIConfig.ai_api_url);
        console.log('使用模型:', modelName, '提供商URL:', userAIConfig.ai_api_url);
        
        const aiResponse = await axios.post(userAIConfig.ai_api_url, {
            model: modelName,
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.3, // 降低温度让AI响应更准确
            max_tokens: 3000
        }, {
            headers: {
                'Authorization': `Bearer ${userAIConfig.ai_api_key}`,
                'Content-Type': 'application/json'
            }
        });

        const aiMessage = aiResponse.data.choices[0].message.content;
        console.log('AI原始响应:', aiMessage.substring(0, 200) + '...');
        
        // 尝试解析JSON响应
        try {
            // 先尝试直接解析
            let jsonResponse = null;
            
            console.log('AI原始响应长度:', aiMessage.length);
            console.log('AI原始响应前500字符:', aiMessage.substring(0, 500));
            
            // 检查是否包含JSON格式
            if (aiMessage.includes('{') && aiMessage.includes('}')) {
                console.log('检测到响应中包含JSON格式');
                
                // 方法1：尝试提取```json代码块中的JSON
                const jsonCodeBlockMatch = aiMessage.match(/```json\s*([\s\S]*?)\s*```/i);
                if (jsonCodeBlockMatch) {
                    console.log('从```json代码块提取到JSON:', jsonCodeBlockMatch[1]);
                    try {
                        jsonResponse = JSON.parse(jsonCodeBlockMatch[1]);
                        console.log('成功解析JSON代码块:', jsonResponse);
                    } catch (e) {
                        console.log('JSON代码块解析失败:', e.message);
                    }
                }
                
                // 方法2：如果方法1失败，尝试提取任何{}包围的JSON
                if (!jsonResponse) {
                    const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        console.log('提取到的JSON字符串:', jsonMatch[0]);
                        try {
                            jsonResponse = JSON.parse(jsonMatch[0]);
                            console.log('成功解析JSON:', jsonResponse);
                        } catch (e) {
                            console.log('JSON解析失败:', e.message);
                        }
                    }
                }
                
                // 方法3：如果仍然失败，尝试多个JSON对象匹配
                if (!jsonResponse) {
                    const multipleJsonMatches = aiMessage.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
                    if (multipleJsonMatches) {
                        for (const match of multipleJsonMatches) {
                            try {
                                console.log('尝试解析JSON片段:', match);
                                const parsed = JSON.parse(match);
                                if (parsed.action) {
                                    jsonResponse = parsed;
                                    console.log('找到有效的JSON操作:', jsonResponse);
                                    break;
                                }
                            } catch (e) {
                                console.log('JSON片段解析失败:', e.message);
                            }
                        }
                    }
                }
                
                if (jsonResponse && jsonResponse.action) {
                    console.log('返回JSON操作响应:', jsonResponse.action);
                    res.json(jsonResponse);
                    return;
                } else {
                    console.log('未找到有效的JSON操作响应');
                }
            } else {
                console.log('响应中不包含JSON格式，作为普通消息处理');
            }
        } catch (e) {
            console.log('JSON解析失败，当作普通消息处理:', e.message);
        }
        
        console.log('返回普通文本响应');
        res.json({ message: aiMessage });

    } catch (error) {
        console.error('AI聊天失败:', error);
        res.status(500).json({ 
            error: 'AI服务暂时不可用',
            details: error.response?.data?.error?.message || error.message
        });
    }
});


app.listen(PORT, () => {
  console.log(`代码可视化分析器运行在 http://localhost:${PORT}`);
});
