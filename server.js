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

// 检查AI配置状态
app.get('/api/ai-config/status', requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`检查用户 ${userId} 的AI配置状态`);
        
        // 从数据库获取用户的AI配置
        db.get("SELECT ai_api_url, ai_api_key FROM users WHERE id = ?", [userId], (err, user) => {
            if (err) {
                console.error('查询用户AI配置失败:', err);
                return res.status(500).json({ error: '查询配置失败' });
            }
            
            const hasAiConfig = !!(user && user.ai_api_url && user.ai_api_key);
            console.log(`用户 ${userId} AI配置状态: ${hasAiConfig}, URL: ${user?.ai_api_url}, Key存在: ${!!user?.ai_api_key}`);
            
            res.json({
                configured: hasAiConfig,
                config: hasAiConfig ? {
                    apiUrl: user.ai_api_url,
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
        const { apiUrl, apiKey } = req.body;
        const userId = req.user.id;
        
        if (!apiUrl || !apiKey) {
            return res.status(400).json({ error: 'API URL和API Key都是必需的' });
        }
        
        // 验证新的API配置
        const testResult = await testAIConnection(apiUrl, apiKey);
        if (!testResult.success) {
            return res.status(400).json({ 
                error: 'AI API配置验证失败', 
                details: testResult.error 
            });
        }
        
        // 更新数据库中的AI配置
        db.run(
            "UPDATE users SET ai_api_url = ?, ai_api_key = ? WHERE id = ?",
            [apiUrl.trim(), apiKey.trim(), userId],
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
                        provider: identifyAIProvider(apiUrl),
                        lastValidated: new Date().toISOString()
                    }
                });
                
                console.log(`用户 ${req.user.username} AI配置已更新为 ${identifyAIProvider(apiUrl)}`);
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
        const { name, path: projectPath } = req.body;
        
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
                description: `${name} 项目`,
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
                    
                    res.json(newProject);
                    console.log(`用户 ${req.user.username} 添加了项目 "${name}":`, projectPath);
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
        const { content } = req.body;
        
        if (!content && content !== '') {
            return res.status(400).json({ error: '文件内容不能为空' });
        }
        
        console.log(`保存文件请求: 项目=${projectId}, 路径=${filePath}`);
        
        // 验证项目是否属于当前用户
        db.get("SELECT id FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.id], (err, project) => {
            if (err) {
                console.error('验证项目失败:', err);
                return res.status(500).json({ error: '验证项目失败' });
            }
            
            if (!project) {
                return res.status(404).json({ error: '项目不存在或无权限访问' });
            }
            
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
                        updateFileContent(projectId, filePath, content, res);
                    } else {
                        // 如果直接匹配没找到，尝试模糊匹配
                        db.get(
                            "SELECT file_path FROM project_files WHERE project_id = ? AND file_path LIKE ?",
                            [projectId, `%/${filePath}`],
                            (err, row) => {
                                if (err) {
                                    console.error('模糊匹配文件失败:', err);
                                    return res.status(500).json({ error: '查询文件失败' });
                                }
                                
                                if (row) {
                                    // 使用找到的完整路径更新
                                    updateFileContent(projectId, row.file_path, content, res);
                                } else {
                                    return res.status(404).json({ error: '文件不存在' });
                                }
                            }
                        );
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
            
            console.log(`文件已更新: ${filePath}`);
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
    
    const response = await axios.post(userConfig.ai_api_url, {
      model: 'deepseek-chat',
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
async function testAIConnection(apiUrl, apiKey) {
    try {
        const response = await axios.post(apiUrl, {
            model: 'deepseek-chat',
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
            timeout: 10000
        });
        
        if (response.data && response.data.choices && response.data.choices[0]) {
            return { success: true };
        } else {
            return { success: false, error: 'AI API响应格式不正确' };
        }
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data?.error?.message || error.message || '连接失败'
        };
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

                const response = await Promise.race([
                    axios.post(userConfig.ai_api_url, {
                        model: 'deepseek-chat',
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


app.listen(PORT, () => {
  console.log(`代码可视化分析器运行在 http://localhost:${PORT}`);
});
