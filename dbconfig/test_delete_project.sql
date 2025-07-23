-- 测试删除项目功能的脚本
-- 验证删除项目时是否正确删除相关文件

-- 查看当前状态
SELECT '=== 当前数据库状态 ===' as info;
SELECT COUNT(*) as total_projects FROM projects;
SELECT COUNT(*) as total_files FROM project_files;

-- 显示现有项目和文件
SELECT '=== 现有项目 ===' as info;
SELECT id, name, user_id FROM projects;

SELECT '=== 每个项目的文件数量 ===' as info;
SELECT project_id, COUNT(*) as file_count 
FROM project_files 
GROUP BY project_id;

-- 检查外键约束状态
SELECT '=== 外键约束状态 ===' as info;
PRAGMA foreign_keys;
