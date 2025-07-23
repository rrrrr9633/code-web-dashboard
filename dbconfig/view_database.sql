-- 查看数据库详细信息
-- 使用方法: sqlite3 project_files.db < view_database.sql

.mode column
.headers on
.width 12 20 25 15

-- 用户信息
SELECT '=== USERS ===' as info;
SELECT id, username, created_at, 
       CASE WHEN ai_api_url IS NOT NULL THEN 'Configured' ELSE 'Not configured' END as ai_status
FROM users;

-- 项目统计
SELECT '=== PROJECTS ===' as info;
SELECT COUNT(*) as total_projects FROM projects;
SELECT user_id, COUNT(*) as project_count FROM projects GROUP BY user_id;

-- 文件统计
SELECT '=== FILES ===' as info;
SELECT COUNT(*) as total_files FROM project_files;
SELECT project_id, COUNT(*) as file_count 
FROM project_files 
GROUP BY project_id 
ORDER BY file_count DESC 
LIMIT 10;

-- 数据库大小信息
SELECT '=== DATABASE INFO ===' as info;
SELECT 
    name as table_name,
    COUNT(*) as record_count
FROM (
    SELECT 'users' as name, COUNT(*) as count FROM users
    UNION ALL
    SELECT 'projects', COUNT(*) FROM projects
    UNION ALL
    SELECT 'project_files', COUNT(*) FROM project_files
    UNION ALL
    SELECT 'project_structures', COUNT(*) FROM project_structures
    UNION ALL
    SELECT 'user_sessions', COUNT(*) FROM user_sessions
    UNION ALL
    SELECT 'project_restructure_configs', COUNT(*) FROM project_restructure_configs
) 
ORDER BY record_count DESC;
