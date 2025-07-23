-- 清理孤立文件和数据
-- 使用方法: sqlite3 project_files.db < cleanup_orphaned.sql

BEGIN TRANSACTION;

-- 删除没有对应项目的文件
DELETE FROM project_files WHERE project_id NOT IN (SELECT id FROM projects);

-- 删除没有对应项目的结构数据
DELETE FROM project_structures WHERE project_id NOT IN (SELECT id FROM projects);

-- 删除没有对应项目的重组配置
DELETE FROM project_restructure_configs WHERE project_id NOT IN (SELECT id FROM projects);

-- 删除过期的用户会话 (超过30天)
DELETE FROM user_sessions WHERE created_at < datetime('now', '-30 days');

COMMIT;

-- 显示清理结果
SELECT 'Orphaned files removed' as operation;
SELECT 'Projects:' as info, COUNT(*) as count FROM projects;
SELECT 'Files:' as info, COUNT(*) as count FROM project_files;
SELECT 'Structures:' as info, COUNT(*) as count FROM project_structures;
SELECT 'Sessions:' as info, COUNT(*) as count FROM user_sessions;
