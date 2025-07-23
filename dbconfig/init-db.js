const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 创建初始化的空数据库
function initializeDatabase() {
    const dbPath = path.join(__dirname, 'project_files.db');
    console.log('初始化数据库:', dbPath);
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ 连接数据库失败:', err);
                reject(err);
                return;
            }
            
            console.log('✅ 数据库连接成功');
            
            // 串行执行所有SQL语句
            db.serialize(() => {
                // 创建用户表
                db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) console.error('创建用户表失败:', err);
                    else console.log('✅ 用户表创建成功');
                });
                
                // 创建项目表
                db.run(`
                    CREATE TABLE IF NOT EXISTS projects (
                        id TEXT PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        path TEXT NOT NULL,
                        type TEXT DEFAULT 'local',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                `, (err) => {
                    if (err) console.error('创建项目表失败:', err);
                    else console.log('✅ 项目表创建成功');
                });
                
                // 创建文件表
                db.run(`
                    CREATE TABLE IF NOT EXISTS project_files (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        content TEXT,
                        size INTEGER,
                        modified_time DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) console.error('创建文件表失败:', err);
                    else console.log('✅ 文件表创建成功');
                });
                
                // 创建AI配置表
                db.run(`
                    CREATE TABLE IF NOT EXISTS ai_configs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER UNIQUE NOT NULL,
                        api_url TEXT NOT NULL,
                        api_key TEXT NOT NULL,
                        last_validated DATETIME DEFAULT CURRENT_TIMESTAMP,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                `, (err) => {
                    if (err) console.error('创建AI配置表失败:', err);
                    else console.log('✅ AI配置表创建成功');
                });
                
                // 创建项目重组配置表
                db.run(`
                    CREATE TABLE IF NOT EXISTS project_restructure_configs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id TEXT NOT NULL,
                        config_data TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) console.error('创建重组配置表失败:', err);
                    else console.log('✅ 重组配置表创建成功');
                });
                
                // 创建索引
                db.run(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id)`, (err) => {
                    if (err) console.error('创建项目索引失败:', err);
                    else console.log('✅ 项目索引创建成功');
                });
                
                db.run(`CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files (project_id)`, (err) => {
                    if (err) console.error('创建文件索引失败:', err);
                    else console.log('✅ 文件索引创建成功');
                });
                
                db.run(`CREATE INDEX IF NOT EXISTS idx_project_files_path ON project_files (project_id, file_path)`, (err) => {
                    if (err) console.error('创建文件路径索引失败:', err);
                    else console.log('✅ 文件路径索引创建成功');
                });
                
                // 最后显示完成信息
                db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                    if (err) {
                        console.error('获取表列表失败:', err);
                    } else {
                        console.log('📊 数据库表结构:');
                        tables.forEach(table => {
                            console.log(`  - ${table.name}`);
                        });
                    }
                    
                    // 检查数据库文件大小
                    try {
                        const stats = fs.statSync(dbPath);
                        console.log(`📁 数据库文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
                    } catch (sizeErr) {
                        console.error('获取文件大小失败:', sizeErr);
                    }
                    
                    console.log('✅ 数据库初始化完成');
                    
                    db.close((err) => {
                        if (err) {
                            console.error('关闭数据库连接失败:', err);
                            reject(err);
                        } else {
                            console.log('📚 数据库连接已关闭');
                            resolve();
                        }
                    });
                });
            });
        });
    });
}

// 如果直接运行此脚本
if (require.main === module) {
    initializeDatabase().then(() => {
        console.log('🎉 初始化完成');
        process.exit(0);
    }).catch((error) => {
        console.error('💥 初始化失败:', error);
        process.exit(1);
    });
}

module.exports = { initializeDatabase };
