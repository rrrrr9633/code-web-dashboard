-- 删除特定用户及其所有相关数据
-- 使用方法: sqlite3 project_files.db < cleanup_user.sql

-- 删除用户1 (12345) 的所有数据
BEGIN TRANSACTION;

-- 1. 删除用户会话
DELETE FROM user_sessions WHERE user_id = 1;

-- 2. 删除项目重组配置
DELETE FROM project_restructure_configs WHERE project_id IN (
    SELECT id FROM projects WHERE user_id = 1
);

-- 3. 删除项目结构
DELETE FROM project_structures WHERE project_id IN (
    SELECT id FROM projects WHERE user_id = 1
);

-- 4. 删除项目文件
DELETE FROM project_files WHERE project_id IN (
    SELECT id FROM projects WHERE user_id = 1
);

-- 5. 删除项目
DELETE FROM projects WHERE user_id = 1;

-- 6. 删除用户
DELETE FROM users WHERE id = 1;

COMMIT;

-- 显示清理结果
SELECT 'Users remaining:' as info, COUNT(*) as count FROM users;
SELECT 'Projects remaining:' as info, COUNT(*) as count FROM projects;
SELECT 'Files remaining:' as info, COUNT(*) as count FROM project_files;
