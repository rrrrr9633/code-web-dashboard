-- 启用外键约束的脚本
-- 这将确保删除项目时自动删除相关文件

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 验证外键约束已启用
SELECT '外键约束状态: ' || CASE WHEN foreign_keys = 1 THEN '已启用' ELSE '未启用' END as status 
FROM pragma_foreign_keys;
