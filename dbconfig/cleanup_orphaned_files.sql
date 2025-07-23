-- 清理孤立文件的SQL脚本
-- 删除没有对应项目的文件记录

-- 显示清理前的统计信息
SELECT '=== 清理前统计 ===' as info;
SELECT COUNT(*) as total_files FROM project_files;
SELECT COUNT(*) as orphaned_files FROM project_files WHERE project_id NOT IN (SELECT id FROM projects);

-- 显示孤立文件的项目ID
SELECT '=== 孤立文件的项目ID ===' as info;
SELECT DISTINCT project_id, COUNT(*) as file_count 
FROM project_files 
WHERE project_id NOT IN (SELECT id FROM projects)
GROUP BY project_id
ORDER BY file_count DESC;

-- 删除孤立的文件记录
DELETE FROM project_files WHERE project_id NOT IN (SELECT id FROM projects);

-- 显示清理后的统计信息
SELECT '=== 清理后统计 ===' as info;
SELECT COUNT(*) as remaining_files FROM project_files;

-- 验证清理结果
SELECT '=== 验证：每个项目的文件数量 ===' as info;
SELECT p.id, p.name, COUNT(pf.id) as file_count
FROM projects p
LEFT JOIN project_files pf ON p.id = pf.project_id
GROUP BY p.id, p.name
ORDER BY file_count DESC;
