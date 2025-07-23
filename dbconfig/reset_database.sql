-- 完全重置数据库（删除所有数据）
-- 使用方法: sqlite3 project_files.db < reset_database.sql
-- 警告：这将删除所有用户、项目和文件数据！

BEGIN TRANSACTION;

-- 删除所有数据（保留表结构）
DELETE FROM user_sessions;
DELETE FROM project_restructure_configs;
DELETE FROM project_structures;
DELETE FROM project_files;
DELETE FROM projects;
DELETE FROM users;

-- 重置自增ID
DELETE FROM sqlite_sequence WHERE name IN ('users');

COMMIT;

-- 显示结果
SELECT 'Database reset completed' as status;
SELECT 'Users:' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Projects:', COUNT(*) FROM projects
UNION ALL
SELECT 'Files:', COUNT(*) FROM project_files
UNION ALL
SELECT 'Sessions:', COUNT(*) FROM user_sessions;
