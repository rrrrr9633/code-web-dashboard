let currentFile = null;
let currentFileContent = null;
let currentProject = null;
let currentRenameProjectId = null;
let projects = [];
let aiConfigured = false;
let selectedDirectory = null; // 当前选中的目录路径

// 拖拽和剪贴板相关变量
let draggedItem = null;
let clipboard = {
    item: null,
    operation: null // 'copy' or 'cut'
};
let dropIndicators = [];

// 调试函数：检查AI配置状态
function debugAIStatus() {
    console.log('🔍 AI配置状态调试:');
    console.log('  - aiConfigured:', aiConfigured);
    console.log('  - typeof aiConfigured:', typeof aiConfigured);
    console.log('  - window.aiConfigured:', window.aiConfigured);
    console.log('  - localStorage authToken:', !!localStorage.getItem('authToken'));
    return aiConfigured;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    checkAIConfiguration();
    loadProjects();
    setupUnifiedProjectForm();
    setupRenameProjectForm();
    setupAIConfigForm();
    loadUserInfo(); // 加载用户信息
    setupProjectManagerDrag(); // 设置项目管理器拖动
    setupModalDragFunctionality(); // 设置模态框拖动功能
    setupFileTreeResize(); // 设置文件树调整大小功能
    setupSidebarResize(); // 设置侧边栏调整大小功能
    
    // 新增的表单初始化
    setupCreateEmptyProjectForm();
    setupAddFileForm();
    setupAddFolderForm();
    setupRenameForm();
    
    // 设置拖拽和键盘事件
    setupDragAndDrop();
    setupKeyboardShortcuts();
    
    // 设置代码选择右键菜单
    setupCodeSelectionMenu();
    
    // 显示数据库持久化提示
    showPersistenceNotification();
});

// 显示数据库持久化通知
function showPersistenceNotification() {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #27ae60;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        max-width: 350px;
        font-size: 14px;
        line-height: 1.4;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center;">
            <div style="margin-right: 10px;">🎉</div>
            <div>
                <strong>永久文件存储已启用！</strong><br>
                您的项目文件现在保存在服务器数据库中，<br>
                刷新页面不再需要重新授权访问文件。
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 5秒后自动消失
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// 检查AI配置状态
async function checkAIConfiguration() {
    try {
        const sessionToken = localStorage.getItem('authToken');
        console.log('🔍 检查AI配置 - Token存在:', !!sessionToken);
        
        if (!sessionToken) {
            console.log('❌ 没有会话令牌，跳转到登录页面');
            // 没有会话令牌，跳转到登录页面
            window.location.href = '/login.html';
            return;
        }

        console.log('📡 发送AI配置检查请求到服务器');
        const response = await fetch('/api/ai-config/status', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        console.log('📥 AI配置检查响应状态:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ AI配置检查结果:', data);
            aiConfigured = data.configured;
            console.log('🔧 设置aiConfigured为:', aiConfigured);
            
            if (data.configured) {
                updateCurrentConfigDisplay(data.config);
            }
        } else {
            console.log('❌ 会话无效，跳转到登录页面');
            // 会话无效，跳转到登录页面
            localStorage.removeItem('authToken');
            localStorage.removeItem('ai_config');
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('❌ 检查AI配置失败:', error);
        window.location.href = '/login.html';
    }
}

// 加载项目列表
async function loadProjects() {
    try {
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch('/api/projects', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        if (response.ok) {
            projects = await response.json();
            // 恢复项目排序
            loadProjectOrder();
        } else {
            // 如果API不可用，初始化空项目列表
            projects = [];
        }
        renderProjectList();
        
        // 根据项目数量显示不同的内容
        if (projects.length > 0) {
            // 有项目时，加载第一个项目
            selectProject(projects[0].id);
        } else {
            // 没有项目时，显示添加项目的提示
            showNoProjectsState();
        }
    } catch (error) {
        console.error('加载项目列表失败:', error);
        // 降级处理，显示空状态
        projects = [];
        renderProjectList();
        showNoProjectsState();
    }
}

// 显示没有项目时的状态
function showNoProjectsState() {
    const fileTree = document.getElementById('fileTree');
    fileTree.innerHTML = `
        <div class="info">
            <i class="fas fa-folder-open" style="font-size: 2em; color: #ccc; margin-bottom: 15px;"></i>
            <h3>暂无项目</h3>
            <p>请使用上方"添加项目"按钮开始</p>
        </div>
    `;
    
    // 重置概览卡片
    updateOverviewCards([]);
    
    // 隐藏文件操作区域
    hideFileOperations();
}

// 渲染项目列表
function renderProjectList() {
    const projectList = document.getElementById('projectList');
    
    if (projects.length === 0) {
        projectList.innerHTML = `
            <div class="empty-projects">
                <i class="fas fa-folder-open" style="font-size: 2em; color: #ccc; margin-bottom: 10px;"></i>
                <p style="color: #666; text-align: center;">暂无项目</p>
                <p style="color: #999; font-size: 0.8em; text-align: center;">点击上方"添加项目"按钮开始</p>
            </div>
        `;
        
        // 同时更新文件树状态
        showNoProjectsState();
        return;
    }
    
    projectList.innerHTML = projects.map((project, index) => `
        <div class="project-item ${currentProject && currentProject.id === project.id ? 'active' : ''}" 
             data-project-id="${project.id}"
             data-project-index="${index}"
             onclick="selectProject('${project.id}')">
            <div class="project-drag-handle" 
                 draggable="true"
                 title="拖动排序"
                 onmousedown="event.stopPropagation()">
                <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="project-info">
                <i class="fas fa-folder"></i>
                <div>
                    <div class="project-name">${project.name}</div>
                    <div class="project-path">${project.path}</div>
                </div>
            </div>
            <div class="project-actions">
                <button class="project-action-btn" onclick="event.stopPropagation(); refreshProject('${project.id}')" title="刷新">
                    <i class="fas fa-sync"></i>
                </button>
                <button class="project-action-btn" onclick="event.stopPropagation(); downloadProject('${project.id}')" title="下载项目">
                    <i class="fas fa-download"></i>
                </button>
                <button class="project-action-btn" onclick="event.stopPropagation(); renameProject('${project.id}')" title="重命名">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="project-action-btn" onclick="event.stopPropagation(); removeProject('${project.id}')" title="移除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // 重新设置拖拽事件监听器
    setupProjectDragAndDrop();
}

// 选择项目
async function selectProject(projectId) {
    console.log('🎯 选择项目:', projectId);
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        console.error('❌ 项目不存在:', projectId);
        showNotification('项目不存在', 'error');
        return;
    }
    
    console.log('✅ 找到项目:', project.name, '(ID:', project.id, ')');
    currentProject = project; // 存储整个项目对象
    console.log('🔄 更新currentProject为:', currentProject.name);
    
    renderProjectList(); // 重新渲染以更新active状态
    await loadProjectStructure(project);
    
    // 显示文件操作区域
    showFileOperations();
}

// 加载项目结构 - 使用本地文件访问模式
async function loadProjectStructure(project = null) {
    try {
        // 检查是否是本地文件项目
        if (project && project.path && project.path.startsWith('[本地]')) {
            // 这是一个本地文件项目，需要特殊处理
            await handleLocalProjectLoad(project);
            return;
        }
        
        let structure = [];
        let restructureConfig = null;
        
        // 如果有项目，从数据库获取结构
        if (project && project.id) {
            try {
                const response = await fetch(`/api/projects/${project.id}/structure`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        structure = data.structure || [];
                        console.log(`从数据库加载了项目 "${project.name}" 的结构，共 ${structure.length} 个根目录/文件`);
                    }
                } else {
                    console.error('获取项目结构失败:', response.status, response.statusText);
                }
            } catch (error) {
                console.error('获取项目结构出错:', error);
            }
            
            // 检查是否有重组配置
            try {
                const restructureResponse = await fetch(`/api/projects/${project.id}/restructure`);
                if (restructureResponse.ok) {
                    const restructureData = await restructureResponse.json();
                    if (restructureData.hasConfig && restructureData.config) {
                        restructureConfig = restructureData.config;
                        console.log('🔄 检测到重组配置，将应用分类显示');
                    }
                }
            } catch (error) {
                console.error('获取重组配置失败:', error);
            }
        }
        
        // 如果有重组配置，应用分类
        let finalStructure = structure;
        if (restructureConfig && restructureConfig.structureMapping) {
            console.log('📂 应用项目重组分类显示');
            console.log('🔧 重组配置:', restructureConfig);
            console.log('📋 结构映射:', restructureConfig.structureMapping);
            console.log('🗂️ 原始结构:', structure);
            finalStructure = categorizeProjectStructure(structure, restructureConfig.structureMapping);
            console.log('✨ 分类后结构:', finalStructure);
        } else {
            console.log('ℹ️ 没有重组配置，使用原始结构');
        }
        
        // 检查重组状态并更新状态指示器
        if (project) {
            await checkRestructureStatus(project.id);
        }
        
        // 更新概览卡片
        updateOverviewCards(finalStructure);
        
        // 渲染文件树
        renderFileTree(finalStructure);
        
        // 显示提示信息
        const fileTree = document.getElementById('fileTree');
        if (structure.length === 0) {
            fileTree.innerHTML = `
                <div class="info">
                    <i class="fas fa-info-circle"></i>
                    <h3>项目结构为空</h3>
                    <p>请使用上方"添加项目"按钮添加项目或上传文件</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载项目结构失败:', error);
        document.getElementById('fileTree').innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                加载项目结构失败: ${error.message}
            </div>
        `;
    }
}

// 处理本地项目加载
async function handleLocalProjectLoad(project) {
    try {
        // 尝试从本地存储恢复项目结构
        const savedStructure = localStorage.getItem(`localProject_${project.id}`);
        let structure = savedStructure ? JSON.parse(savedStructure) : null;
        
        // 如果有保存的结构且不为空，使用它
        if (structure && structure.length > 0) {
            // 更新概览卡片
            updateOverviewCards(structure);
            
            // 渲染文件树
            renderFileTree(structure);
            
            // 显示重新授权按钮（因为文件访问权限已失效）
            const fileTree = document.getElementById('fileTree');
            const reauthorizeButton = `
                <div class="reauthorize-notice" style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <i class="fas fa-exclamation-triangle" style="color: #856404; margin-right: 8px;"></i>
                        <strong style="color: #856404;">需要重新授权文件访问</strong>
                    </div>
                    <p style="margin: 8px 0; color: #856404; font-size: 0.9em;">
                        页面刷新后，本地文件访问权限已失效。你可以查看项目结构，但需要重新授权才能打开文件。
                    </p>
                    <button class="btn btn-primary" onclick="reauthorizeLocalProject('${project.id}')" style="margin-top: 8px; font-size: 0.9em;">
                        <i class="fas fa-key"></i> 重新授权访问
                    </button>
                </div>
            `;
            fileTree.insertAdjacentHTML('afterbegin', reauthorizeButton);
            
            // 检查重组状态
            await checkRestructureStatus(project.id);
            
            return;
        }
        
        // 如果没有保存的结构，显示需要授权的消息
        const fileTree = document.getElementById('fileTree');
        fileTree.innerHTML = `
            <div class="info">
                <i class="fas fa-folder-open" style="font-size: 2em; color: #ccc; margin-bottom: 15px;"></i>
                <h3>本地文件项目</h3>
                <p>此项目需要访问本地文件夹权限才能显示内容</p>
                <button class="btn btn-primary" onclick="reauthorizeLocalProject('${project.id}')" style="margin-top: 15px;">
                    <i class="fas fa-key"></i> 授权访问文件夹
                </button>
            </div>
        `;
        
        // 重置概览卡片
        updateOverviewCards([]);
        
    } catch (error) {
        console.error('处理本地项目失败:', error);
        const fileTree = document.getElementById('fileTree');
        fileTree.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                处理本地项目失败: ${error.message}
            </div>
        `;
    }
}

// 重新授权本地项目访问
async function reauthorizeLocalProject(projectId) {
    try {
        // 检查浏览器支持
        if (!('showDirectoryPicker' in window)) {
            showNotification('您的浏览器不支持此功能，请使用 Chrome 86+ 或 Edge 86+', 'error');
            return;
        }
        
        showNotification('请选择项目文件夹以重新授权访问...', 'info');
        
        // 显示文件夹选择器
        const directoryHandle = await window.showDirectoryPicker();
        
        // 读取目录结构
        const structure = await readDirectoryStructure(directoryHandle);
        
        // 保存到本地存储
        localStorage.setItem(`localProject_${projectId}`, JSON.stringify(structure));
        
        // 保存目录句柄到全局变量（用于当前会话）
        selectedDirectoryHandle = directoryHandle;
        currentLocalStructure = structure;
        
        // 创建文件路径到handle的映射
        createFileHandleMap(structure, directoryHandle);
        
        // 更新显示
        updateOverviewCards(structure);
        renderFileTree(structure);
        
        // 移除重新授权提示
        const reauthorizeNotice = document.querySelector('.reauthorize-notice');
        if (reauthorizeNotice) {
            reauthorizeNotice.remove();
        }
        
        showNotification(`已重新授权访问文件夹: ${directoryHandle.name}`, 'success');
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('重新授权失败:', error);
            showNotification('重新授权失败: ' + error.message, 'error');
        }
    }
}

// 创建文件路径到handle的映射
function createFileHandleMap(structure, rootHandle, basePath = '') {
    structure.forEach(item => {
        const fullPath = basePath ? `${basePath}/${item.name}` : item.name;
        
        if (item.type === 'file') {
            // 为文件项设置handle，这样可以在点击时正确打开
            item.handle = item.handle || null; // 如果已有handle则保留，否则设为null
            item.path = fullPath; // 更新完整路径
        } else if (item.type === 'directory' && item.children) {
            createFileHandleMap(item.children, rootHandle, fullPath);
        }
    });
}

// 检查重组状态
async function checkRestructureStatus(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/restructure`);
        const data = await response.json();
        
        // 更新项目列表中的状态指示器
        updateProjectRestructureStatus(projectId, data.hasConfig);
        
    } catch (error) {
        console.error('检查重组状态失败:', error);
    }
}

// 更新项目重组状态显示
function updateProjectRestructureStatus(projectId, hasRestructure) {
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
        const projectIdFromOnclick = item.getAttribute('onclick');
        if (projectIdFromOnclick && projectIdFromOnclick.includes(`'${projectId}'`)) {
            let statusIndicator = item.querySelector('.restructure-status');
            if (hasRestructure) {
                if (!statusIndicator) {
                    statusIndicator = document.createElement('span');
                    statusIndicator.className = 'restructure-status';
                    statusIndicator.innerHTML = '<i class="fas fa-magic" title="已应用目录重组"></i>';
                    item.querySelector('.project-info').appendChild(statusIndicator);
                }
            } else {
                if (statusIndicator) {
                    statusIndicator.remove();
                }
            }
        }
    });
}

// 更新概览卡片
function updateOverviewCards(structure) {
    // 统计所有项目
    let projectCount = projects.length;
    let moduleCount = 0;
    let fileCount = 0;
    
    // 计算当前项目的文件和模块数量
    if (currentProject && Array.isArray(structure)) {
        function countItems(items) {
            items.forEach(item => {
                if (item.type === 'category') {
                    countItems(item.children || []);
                } else if (item.type === 'directory') {
                    moduleCount++;
                    countItems(item.children || []);
                } else if (item.type === 'file') {
                    fileCount++;
                }
            });
        }
        
        countItems(structure);
    }
    
    // 更新显示
    document.getElementById('projectCount').textContent = projectCount;
    document.getElementById('fileCount').textContent = fileCount;
    document.getElementById('moduleCount').textContent = moduleCount;
}

// 渲染文件树
function renderFileTree(items, container = null) {
    if (!container) {
        container = document.getElementById('fileTree');
        container.innerHTML = '';
    }

    items.forEach(item => {
        const itemElement = createTreeItem(item);
        container.appendChild(itemElement);
    });
}

// 创建树形结构项目
function createTreeItem(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'tree-item';
    itemDiv.setAttribute('data-type', item.type);
    itemDiv.setAttribute('data-path', item.path); // 为所有项目设置路径属性

    const labelDiv = document.createElement('div');
    labelDiv.className = 'tree-label';
    
    if (item.type === 'category') {
        // 分类容器显示
        const categoryColor = item.color || '#e74c3c';
        labelDiv.innerHTML = `
            <i class="fas fa-layer-group" style="color: ${categoryColor};"></i>
            <span style="font-weight: bold; color: ${categoryColor};">${item.name}</span>
            <small style="margin-left: 8px; color: #7f8c8d; font-size: 0.8em;">(${item.children ? item.children.length : 0}项)</small>
        `;
        
        labelDiv.onclick = function() {
            toggleDirectory(itemDiv, item);
        };

        // 添加分类描述
        if (item.description) {
            labelDiv.title = item.description;
        }

        itemDiv.appendChild(labelDiv);

        // 创建子项容器 - 分类默认展开
        if (item.children && item.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'children open';
            renderFileTree(item.children, childrenDiv);
            itemDiv.appendChild(childrenDiv);
            
            // 更新图标为展开状态
            const icon = labelDiv.querySelector('i');
            icon.classList.remove('fa-layer-group');
            icon.classList.add('fa-folder-open');
            icon.style.color = categoryColor;
        }
    } else if (item.type === 'directory') {
        itemDiv.classList.add('directory'); // 添加目录标识类
        labelDiv.innerHTML = `
            <i class="fas fa-folder folder-icon" style="color: #3498db;"></i>
            <span>${item.name}</span>
        `;
        
        labelDiv.onclick = function() {
            toggleDirectory(itemDiv, item);
        };

        itemDiv.appendChild(labelDiv);

        // 创建子项容器
        if (item.children && item.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'children';
            renderFileTree(item.children, childrenDiv);
            itemDiv.appendChild(childrenDiv);
        }
        
        // 添加右键菜单支持
        addContextMenuToTreeItem(itemDiv, item);
        
        // 添加拖拽支持
        addDragAndDropToTreeItem(itemDiv, item);
    } else if (item.type === 'file') {
        const fileIcon = getFileIcon(item.extension);
        labelDiv.innerHTML = `
            <i class="${fileIcon} file-icon"></i>
            <span>${item.name}</span>
        `;
        
        labelDiv.onclick = function() {
            // 清除其他项目的选中状态
            document.querySelectorAll('.tree-item.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 设置当前文件为选中状态
            itemDiv.classList.add('selected');
            selectedDirectory = null; // 清除选中的目录
            
            openFile(item.path, item.handle);
        };

        itemDiv.appendChild(labelDiv);
        
        // 添加右键菜单支持
        addContextMenuToTreeItem(itemDiv, item);
        
        // 添加拖拽支持
        addDragAndDropToTreeItem(itemDiv, item);
    }

    return itemDiv;
}

// 获取分类颜色
function getCategoryColor(category) {
    const colorMap = {
        '源代码模块': '#3498db',      // 蓝色
        '配置构建': '#f39c12',        // 橙色
        '文档资源': '#27ae60',        // 绿色
        '其他文件': '#95a5a6',        // 灰色
        // 保留原有的颜色映射作为备用
        '协议实现': '#3498db',
        '核心服务': '#e67e22',
        '存储层': '#9b59b6',
        '安全认证': '#e74c3c',
        '集群管理': '#1abc9c',
        '基础设施': '#34495e',
        '工具扩展': '#f39c12',
        '测试文档': '#95a5a6',
        '部署配置': '#27ae60',
        '其他模块': '#7f8c8d'
    };
    
    return colorMap[category] || '#7f8c8d';
}

// 获取文件图标
function getFileIcon(extension) {
    const iconMap = {
        '.cpp': 'fab fa-cuttlefish',
        '.h': 'fas fa-file-code',
        '.js': 'fab fa-js-square',
        '.json': 'fas fa-file-code',
        '.md': 'fab fa-markdown',
        '.txt': 'fas fa-file-alt',
        '.yml': 'fas fa-file-code',
        '.yaml': 'fas fa-file-code',
        '.xml': 'fas fa-file-code',
        '.html': 'fab fa-html5',
        '.css': 'fab fa-css3-alt',
        '.py': 'fab fa-python',
        '.java': 'fab fa-java',
        '.ts': 'fas fa-file-code',
        '.sh': 'fas fa-terminal',
        '.dockerfile': 'fab fa-docker'
    };
    
    return iconMap[extension.toLowerCase()] || 'fas fa-file';
}

// 切换目录展开/收起
function toggleDirectory(itemDiv, item) {
    const childrenDiv = itemDiv.querySelector('.children');
    const icon = itemDiv.querySelector('.folder-icon');
    
    // 更新选中的目录
    if (item.type === 'directory') {
        selectedDirectory = item.path;
        
        // 清除其他目录的选中状态
        document.querySelectorAll('.tree-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // 设置当前目录为选中状态
        itemDiv.classList.add('selected');
        itemDiv.setAttribute('data-path', item.path);
        
        console.log(`选中目录: ${selectedDirectory}`);
    }
    
    if (childrenDiv) {
        if (childrenDiv.classList.contains('open')) {
            childrenDiv.classList.remove('open');
            if (icon) {
                icon.classList.remove('fa-folder-open');
                icon.classList.add('fa-folder');
            }
        } else {
            childrenDiv.classList.add('open');
            if (icon) {
                icon.classList.remove('fa-folder');
                icon.classList.add('fa-folder-open');
            }
        }
    }
}

// 加载文件内容 - 统一处理本地文件和远程文件
async function openFile(filePath, handle = null) {
    try {
        // 设置当前文件
        currentFile = filePath;
        currentFileContent = null; // 重置文件内容
        
        // UI状态管理
        document.getElementById('welcomeMessage').style.display = 'none';
        document.getElementById('searchResults').style.display = 'none';
        
        const codeContent = document.getElementById('codeContent');
        codeContent.style.display = 'block';
        
        // 更新文件路径显示
        document.getElementById('filePath').textContent = filePath;
        
        // 显示加载状态
        codeContent.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner"></i>
                正在加载文件...
            </div>
        `;
        
        if (currentProject && currentProject.path && currentProject.path.startsWith('[本地]')) {
            // 如果是本地项目，尝试从服务器获取文件内容
            await loadFileFromServer(filePath);
            return;
        } else if (currentProject && currentProject.id) {
            // 如果是数据库项目，从服务器获取文件内容
            await loadFileFromServer(filePath);
            return;
        } else {
            // 否则显示提示信息
            codeContent.innerHTML = `
                <div class="info">
                    <i class="fas fa-info-circle"></i>
                    请使用本地文件访问功能来查看文件内容
                </div>
            `;
            
            // 禁用AI按钮，因为没有文件内容
            const aiButtons = document.querySelectorAll('.ai-btn');
            aiButtons.forEach(btn => btn.disabled = true);
        }

    } catch (error) {
        console.error('加载文件失败:', error);
        document.getElementById('codeContent').innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                加载文件失败: ${error.message}
            </div>
        `;
    }
}

// 从服务器加载文件内容
async function loadFileFromServer(filePath) {
    try {
        console.log('📂 从服务器加载文件:', filePath, '项目ID:', currentProject.id);
        
        const sessionToken = localStorage.getItem('authToken');
        // 正确处理文件路径，将每个路径段分别编码
        const pathSegments = filePath.split('/').map(segment => encodeURIComponent(segment));
        const encodedPath = pathSegments.join('/');
        const url = `/api/projects/${currentProject.id}/files/${encodedPath}`;
        
        console.log('🌐 请求URL:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        console.log('📡 服务器响应状态:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 服务器响应错误:', errorText);
            throw new Error('文件不存在或无法访问: ' + errorText);
        }
        
        const fileData = await response.json();
        console.log('✅ 文件数据加载成功:', fileData.path);
        
        currentFileContent = fileData.content;
        
        // 启用AI按钮
        const aiButtons = document.querySelectorAll('.ai-btn');
        aiButtons.forEach(btn => btn.disabled = false);
        
        // 渲染文件内容
        renderFileContent(fileData);
        
    } catch (error) {
        console.error('💥 从服务器加载文件失败:', error);
        
        // 显示错误信息
        const codeContent = document.getElementById('codeContent');
        codeContent.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                加载文件失败: ${error.message}
            </div>
        `;
        
        // 禁用AI按钮
        const aiButtons = document.querySelectorAll('.ai-btn');
        aiButtons.forEach(btn => btn.disabled = true);
    }
}

// 渲染文件内容
function renderFileContent(fileData) {
    const codeContainer = document.getElementById('codeContent');
    const fileName = fileData.path.split('/').pop();
    
    // 检查是否应该显示工具栏
    const showToolbar = shouldShowToolbar(fileName);
    
    // 更新工具栏信息
    if (showToolbar) {
        updateLanguageIndicator(fileName);
        currentFile = fileData.path; // 确保设置了currentFile
    }
    
    // 文件信息
    const fileInfo = `
        <div class="file-info">
            <h3><i class="fas fa-file"></i> ${fileName}</h3>
            <p><strong>路径:</strong> ${fileData.path}</p>
            <p><strong>大小:</strong> ${formatFileSize(fileData.size)}</p>
            <p><strong>修改时间:</strong> ${new Date(fileData.modified).toLocaleString('zh-CN')}</p>
            <div class="sync-status" style="margin: 10px 0; padding: 8px 12px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; font-size: 0.9em; color: #856404;">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>提醒：</strong>修改仅保存到服务器，如需同步到本地请使用下载功能
            </div>
            <div class="file-actions">
                <button class="action-btn edit-btn" onclick="toggleEditMode()" title="编辑文件">
                    <i class="fas fa-edit"></i> 编辑
                </button>
                <button class="action-btn save-btn" onclick="saveFile()" title="保存文件 (Ctrl+S)" style="display: none;">
                    <i class="fas fa-save"></i> 保存
                </button>
                <button class="action-btn cancel-btn" onclick="cancelEdit()" title="取消编辑" style="display: none;">
                    <i class="fas fa-times"></i> 取消
                </button>
                <button class="action-btn download-btn" onclick="downloadCurrentFile()" title="下载当前文件">
                    <i class="fas fa-download"></i> 下载
                </button>
            </div>
        </div>
    `;

    // 创建编辑器容器
    const language = getLanguageFromExtension(fileData.extension);
    const highlightedCode = hljs.highlightAuto(fileData.content, [language]).value;
    
    // 代码工具栏（如果支持的话）
    const toolbarHtml = showToolbar ? `
        <div class="code-toolbar" style="display: flex;">
            <div class="code-toolbar-left">
                <div class="language-indicator">${currentCodeLanguage.charAt(0).toUpperCase() + currentCodeLanguage.slice(1)}</div>
                <span style="color: rgba(255,255,255,0.8); font-size: 12px;">${fileName}</span>
            </div>
            <div class="code-toolbar-right">
                <button class="toolbar-btn info" onclick="checkLanguageEnvironment()" title="检查语言环境">
                    <i class="fas fa-info-circle"></i> 环境
                </button>
                <button class="toolbar-btn secondary" onclick="checkCode()" title="代码检查">
                    <i class="fas fa-check-circle"></i> 检查
                </button>
                <button class="toolbar-btn primary" onclick="runCode()" title="运行代码">
                    <i class="fas fa-play"></i> 运行
                </button>
            </div>
        </div>
    ` : '';
    
    const codeContent = `
        <div class="code-container">
            ${fileInfo}
            ${toolbarHtml}
            <!-- 只读模式 -->
            <div id="readOnlyView" class="read-only-view">
                <pre style="${showToolbar ? 'border-radius: 0 0 12px 12px; margin-top: -2px;' : ''}"><code class="language-${language}" id="codeDisplay">${highlightedCode}</code></pre>
            </div>
            <!-- 编辑模式 -->
            <div id="editModeView" class="edit-mode-view" style="display: none;">
                <textarea id="codeEditor" class="code-editor">${fileData.content}</textarea>
            </div>
            
            <!-- 代码检查结果面板 -->
            <div class="code-issues-panel" id="codeIssuesPanel" style="display: none;">
                <div class="issues-header">
                    <span>代码检查结果</span>
                    <button class="toolbar-btn" onclick="hideIssuesPanel()" style="padding: 4px 8px; font-size: 11px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="issuesContent"></div>
            </div>
            
            <!-- 代码执行结果面板 -->
            <div class="code-output-panel" id="codeOutputPanel" style="display: none;">
                <div class="output-header">
                    <span>执行结果</span>
                    <span class="execution-time" id="executionTime"></span>
                    <button class="toolbar-btn" onclick="hideOutputPanel()" style="padding: 4px 8px; font-size: 11px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="output-content" id="outputContent"></div>
            </div>
        </div>
    `;

    codeContainer.innerHTML = codeContent;
    
    // 设置编辑器样式和快捷键
    setupCodeEditor();
    
    // 隐藏之前的结果面板
    hideIssuesPanel();
    hideOutputPanel();
}

// 下载当前文件
function downloadCurrentFile() {
    if (!currentFile || !currentFileContent) {
        showNotification('没有可下载的文件', 'warning');
        return;
    }
    
    const fileName = currentFile.split('/').pop();
    const blob = new Blob([currentFileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification(`文件 "${fileName}" 下载成功！`, 'success');
}

// 设置代码编辑器
function setupCodeEditor() {
    const editor = document.getElementById('codeEditor');
    if (!editor) return;
    
    // 设置编辑器基本属性
    editor.style.fontFamily = 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace';
    editor.style.fontSize = '14px';
    editor.style.lineHeight = '1.5';
    editor.style.tabSize = '4';
    
    // 添加Tab键支持
    editor.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            
            // 插入制表符
            this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 1;
        }
        
        // Ctrl+S 保存
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveFile();
        }
        
        // Esc 取消编辑
        if (e.key === 'Escape') {
            cancelEdit();
        }
    });
    
    // 自动调整高度
    editor.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
}

// 切换编辑模式
function toggleEditMode() {
    const readOnlyView = document.getElementById('readOnlyView');
    const editModeView = document.getElementById('editModeView');
    const editBtn = document.querySelector('.edit-btn');
    const saveBtn = document.querySelector('.save-btn');
    const cancelBtn = document.querySelector('.cancel-btn');
    const editor = document.getElementById('codeEditor');
    
    if (!editModeView || !readOnlyView) return;
    
    // 切换到编辑模式
    readOnlyView.style.display = 'none';
    editModeView.style.display = 'block';
    
    // 切换按钮显示
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';
    
    // 设置编辑器高度并聚焦
    if (editor) {
        editor.style.height = 'auto';
        editor.style.height = editor.scrollHeight + 'px';
        editor.focus();
        
        // 将光标移到文件开头
        editor.setSelectionRange(0, 0);
    }
    
    showNotification('进入编辑模式，按Ctrl+S保存，按Esc取消', 'info');
}

// 保存文件
async function saveFile() {
    const editor = document.getElementById('codeEditor');
    if (!editor || !currentFile || !currentProject) {
        showNotification('无法保存：缺少必要信息', 'error');
        return;
    }
    
    const newContent = editor.value;
    
    // 如果内容没有变化，直接返回
    if (newContent === currentFileContent) {
        showNotification('文件内容未发生变化', 'info');
        return;
    }
    
    try {
        showNotification('正在保存文件...', 'info');
        
        const sessionToken = localStorage.getItem('authToken');
        // 正确处理文件路径，将每个路径段分别编码
        const pathSegments = currentFile.split('/').map(segment => encodeURIComponent(segment));
        const encodedPath = pathSegments.join('/');
        
        const response = await fetch(`/api/projects/${currentProject.id}/files/${encodedPath}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ content: newContent })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // 更新当前文件内容
            currentFileContent = newContent;
            
            // 更新文件信息显示
            updateFileInfo(result);
            
            // 退出编辑模式
            exitEditMode();
            
            showNotification('文件保存成功！', 'success');
            
            // 显示本地同步选项
            showLocalSyncOptions(newContent);
            
        } else {
            throw new Error(result.error || '保存失败');
        }
        
    } catch (error) {
        console.error('保存文件失败:', error);
        showNotification('保存文件失败: ' + error.message, 'error');
    }
}

// 显示本地同步选项
function showLocalSyncOptions(content) {
    // 创建同步选项面板
    const syncPanel = document.createElement('div');
    syncPanel.className = 'sync-panel';
    syncPanel.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        border: 1px solid #e1e8ed;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 15px;
        z-index: 10000;
        min-width: 220px;
        max-width: 280px;
    `;
    
    const fileName = currentFile.split('/').pop();
    
    syncPanel.innerHTML = `
        <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee;">
            <div style="font-weight: bold; color: #333; font-size: 0.9em;">
                <i class="fas fa-sync-alt" style="margin-right: 6px; color: #1a73e8;"></i>
                同步到本地
            </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="sync-option-btn" onclick="downloadSingleFile()" 
                    style="display: flex; align-items: center; padding: 10px 12px; border: 1px solid #1a73e8; border-radius: 6px; background: #f8f9ff; color: #1a73e8; cursor: pointer; font-size: 0.85em; transition: all 0.2s ease;">
                <i class="fas fa-download" style="margin-right: 8px; width: 14px;"></i>
                <span>下载文件</span>
            </button>
            
            <button class="sync-option-btn" onclick="downloadFullProject()" 
                    style="display: flex; align-items: center; padding: 10px 12px; border: 1px solid #27ae60; border-radius: 6px; background: #f8fff8; color: #27ae60; cursor: pointer; font-size: 0.85em; transition: all 0.2s ease;">
                <i class="fas fa-archive" style="margin-right: 8px; width: 14px;"></i>
                <span>下载项目</span>
            </button>
            
            <button class="sync-option-btn" onclick="showSyncInstructions()" 
                    style="display: flex; align-items: center; padding: 10px 12px; border: 1px solid #f39c12; border-radius: 6px; background: #fffbf0; color: #f39c12; cursor: pointer; font-size: 0.85em; transition: all 0.2s ease;">
                <i class="fas fa-info-circle" style="margin-right: 8px; width: 14px;"></i>
                <span>同步说明</span>
            </button>
        </div>
        
        <div style="text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee;">
            <button onclick="closeSyncPanel()" 
                    style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; background: white; color: #666; cursor: pointer; font-size: 0.8em; transition: all 0.2s ease;">
                <i class="fas fa-times" style="margin-right: 4px;"></i> 关闭
            </button>
        </div>
    `;
    
    document.body.appendChild(syncPanel);
    
    // 为按钮添加悬停效果
    const buttons = syncPanel.querySelectorAll('.sync-option-btn');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
    });
    
    // 添加全局closeSyncPanel函数
    window.closeSyncPanel = function() {
        if (syncPanel.parentNode) {
            syncPanel.parentNode.removeChild(syncPanel);
        }
        // 清理全局函数
        delete window.closeSyncPanel;
        delete window.downloadSingleFile;
        delete window.downloadFullProject;
        delete window.showSyncInstructions;
    };
    
    // 添加下载单个文件函数
    window.downloadSingleFile = function() {
        if (!currentFile || !currentFileContent) {
            showNotification('没有可下载的文件内容', 'warning');
            closeSyncPanel();
            return;
        }
        
        const fileName = currentFile.split('/').pop();
        const blob = new Blob([currentFileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification(`文件 "${fileName}" 下载成功！`, 'success');
        closeSyncPanel();
    };
    
    // 添加下载完整项目函数
    window.downloadFullProject = function() {
        if (currentProject) {
            downloadProject(currentProject.id);
            closeSyncPanel();
        }
    };
    
    // 添加显示同步说明函数
    window.showSyncInstructions = function() {
        closeSyncPanel();
        showSyncInstructionsModal();
    };
    
    // 5秒后自动淡化提示
    setTimeout(() => {
        syncPanel.style.opacity = '0.8';
        syncPanel.style.transform = 'scale(0.98)';
    }, 5000);
    
    // 10秒后自动关闭
    setTimeout(() => {
        if (syncPanel.parentNode) {
            closeSyncPanel();
        }
    }, 10000);
}

// 更新本地文件（保留原有函数但增强功能）
async function updateLocalFile(content) {
    // 检查是否是本地项目且有文件访问权限
    if (!currentProject || !currentProject.path || !currentProject.path.startsWith('[本地]')) {
        return;
    }
    
    try {
        // 从localStorage获取本地项目的handle信息
        const localProjectData = localStorage.getItem(`localProject_${currentProject.id}`);
        if (!localProjectData) {
            console.log('没有找到本地项目数据');
            return;
        }
        
        // 注意：由于浏览器安全限制，我们无法直接写入本地文件
        // 这里我们提供下载功能作为替代方案
        showNotification('检测到本地项目，建议下载文件到本地更新', 'info');
        
        // 自动触发下载
        downloadSingleFile();
        
    } catch (error) {
        console.error('更新本地文件失败:', error);
    }
}

// 更新文件信息显示
function updateFileInfo(fileInfo) {
    const fileInfoDiv = document.querySelector('.file-info');
    if (!fileInfoDiv) return;
    
    const sizeElement = fileInfoDiv.querySelector('p:nth-child(3)');
    const timeElement = fileInfoDiv.querySelector('p:nth-child(4)');
    
    if (sizeElement) {
        sizeElement.innerHTML = `<strong>大小:</strong> ${formatFileSize(fileInfo.size)}`;
    }
    
    if (timeElement) {
        timeElement.innerHTML = `<strong>修改时间:</strong> ${new Date(fileInfo.lastModified).toLocaleString('zh-CN')}`;
    }
}

// 取消编辑
function cancelEdit() {
    const editor = document.getElementById('codeEditor');
    if (editor) {
        // 恢复原始内容
        editor.value = currentFileContent;
    }
    
    exitEditMode();
    showNotification('已取消编辑', 'info');
}

// 退出编辑模式
function exitEditMode() {
    const readOnlyView = document.getElementById('readOnlyView');
    const editModeView = document.getElementById('editModeView');
    const editBtn = document.querySelector('.edit-btn');
    const saveBtn = document.querySelector('.save-btn');
    const cancelBtn = document.querySelector('.cancel-btn');
    
    if (!editModeView || !readOnlyView) return;
    
    // 切换到只读模式
    editModeView.style.display = 'none';
    readOnlyView.style.display = 'block';
    
    // 切换按钮显示
    editBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    
    // 重新高亮显示代码
    const language = getLanguageFromExtension(getFileExtension(currentFile));
    const highlightedCode = hljs.highlightAuto(currentFileContent, [language]).value;
    const codeElement = readOnlyView.querySelector('code');
    if (codeElement) {
        codeElement.innerHTML = highlightedCode;
    }
}

// 根据文件扩展名获取语言
function getLanguageFromExtension(extension) {
    const langMap = {
        '.cpp': 'cpp',
        '.h': 'cpp',
        '.c': 'c',
        '.js': 'javascript',
        '.json': 'json',
        '.md': 'markdown',
        '.py': 'python',
        '.java': 'java',
        '.ts': 'typescript',
        '.html': 'html',
        '.css': 'css',
        '.sh': 'bash',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.xml': 'xml',
        '.sql': 'sql'
    };
    
    return langMap[extension.toLowerCase()] || 'text';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// AI代码分析
async function analyzeCode(action) {
    console.log('🤖 开始AI代码分析');
    debugAIStatus(); // 调试AI状态
    
    // 如果AI未配置，尝试重新检查一次
    if (!aiConfigured) {
        console.log('⚠️ AI未配置，尝试重新检查...');
        await checkAIConfiguration();
        debugAIStatus(); // 再次检查状态
    }
    
    if (!aiConfigured) {
        console.log('❌ AI仍未配置，显示配置提示');
        showNotification('请先配置AI服务', 'warning');
        openAIConfigModal();
        return;
    }

    if (!currentFile || !currentFileContent) {
        console.log('❌ 没有选择文件或文件内容为空');
        showNotification('请先选择一个文件', 'warning');
        return;
    }

    console.log('✅ 开始AI分析，文件:', currentFile);

    const aiPanel = document.getElementById('aiPanel');
    const aiContent = document.getElementById('aiContent');
    
    // 显示AI面板
    aiPanel.classList.add('open');
    
    // 显示加载状态
    aiContent.innerHTML = `
        <div class="loading">
            <i class="fas fa-robot"></i>
            AI正在分析代码，请稍候...
        </div>
    `;

    // 禁用按钮
    const aiButtons = document.querySelectorAll('.ai-btn');
    aiButtons.forEach(btn => btn.disabled = true);

    try {
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                code: currentFileContent,
                filename: currentFile,
                action: action
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '分析失败');
        }

        // 使用marked渲染Markdown
        let displayContent = '';
        
        // 如果有思考过程，添加可展开的思考部分
        if (data.hasThinking && data.thinking) {
            displayContent += `
                <div class="thinking-section">
                    <div class="thinking-header" onclick="toggleThinking()">
                        <i class="fas fa-brain"></i>
                        <span>AI思考过程</span>
                        <i class="fas fa-chevron-down thinking-toggle"></i>
                    </div>
                    <div class="thinking-content" id="thinkingContent" style="display: none;">
                        ${marked.parse(data.thinking)}
                    </div>
                </div>
            `;
        }
        
        displayContent += `<div class="analysis-content">${marked.parse(data.analysis)}</div>`;
        aiContent.innerHTML = displayContent;

    } catch (error) {
        console.error('AI分析失败:', error);
        aiContent.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                AI分析失败: ${error.message}
            </div>
        `;
    } finally {
        // 重新启用按钮
        aiButtons.forEach(btn => btn.disabled = false);
    }
}

// 关闭AI面板
function closeAiPanel() {
    const aiPanel = document.getElementById('aiPanel');
    aiPanel.classList.remove('open');
}

// 返回主界面
function goBack() {
    // 隐藏代码内容和搜索结果，显示欢迎界面
    document.getElementById('codeContent').style.display = 'none';
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('welcomeMessage').style.display = 'block';
    
    // 重置文件路径显示
    document.getElementById('filePath').textContent = '选择一个文件开始浏览';
    
    // 禁用AI按钮
    const aiButtons = document.querySelectorAll('.ai-btn');
    aiButtons.forEach(btn => btn.disabled = true);
    
    // 关闭AI面板
    closeAiPanel();
    
    // 重置当前文件
    currentFile = null;
    currentFileContent = null;
}

// 搜索功能
let allFiles = []; // 存储所有文件信息

// 执行搜索
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    
    if (!query) {
        alert('请输入搜索关键词');
        return;
    }
    
    searchFiles(query);
}

// 处理搜索输入
function handleSearch(event) {
    if (event.key === 'Enter') {
        performSearch();
    }
}

// 搜索文件
async function searchFiles(query) {
    try {
        if (!currentProject) {
            displaySearchResults([], query);
            return;
        }

        console.log('🔍 开始搜索文件:', query, '当前项目:', currentProject);
        
        // 使用服务器端搜索API（支持所有类型的项目）
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch(`/api/projects/${currentProject.id}/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ 搜索结果:', data.results);
            displaySearchResults(data.results, query);
            return;
        } else {
            const error = await response.json();
            console.error('❌ 搜索请求失败:', error);
            throw new Error(error.error || '搜索失败');
        }
        
    } catch (error) {
        console.error('💥 搜索失败:', error);
        displaySearchResults([], query);
        showNotification('搜索失败: ' + error.message, 'error');
    }
}

// 在本地文件结构中搜索
function searchInLocalStructure(structure, query, results = [], basePath = '') {
    structure.forEach(item => {
        const fullPath = basePath ? `${basePath}/${item.name}` : item.name;
        
        // 检查文件名是否匹配
        if (item.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
                name: item.name,
                path: fullPath,
                type: item.type,
                handle: item.handle
            });
        }
        
        // 如果是目录，递归搜索子项
        if (item.type === 'directory' && item.children) {
            searchInLocalStructure(item.children, query, results, fullPath);
        }
    });
    
    return results;
}

// 显示搜索结果
function displaySearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const codeContent = document.getElementById('codeContent');
    
    // 隐藏欢迎信息和代码内容
    welcomeMessage.style.display = 'none';
    codeContent.style.display = 'none';
    
    // 显示搜索结果容器
    searchResults.style.display = 'block';
    
    if (results.length === 0) {
        searchResults.innerHTML = `
            <div class="error">
                <i class="fas fa-search"></i>
                <h3>没有找到匹配的结果</h3>
                <p>搜索词: "${query}"</p>
                <p>请尝试其他关键词或检查拼写</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <h3 style="margin-bottom: 20px; color: #667eea;">
            <i class="fas fa-search"></i> 搜索结果 (${results.length} 项)
        </h3>
        <p style="margin-bottom: 20px; color: #666;">搜索词: "${query}"</p>
    `;
    
    results.forEach(result => {
        const highlightedContent = highlightSearchTerm(result.preview || '', query);
        // 对于服务器项目，不需要handle，直接传递false
        const hasHandle = result.handle ? 'true' : 'false';
        html += `
            <div class="search-result-item" onclick="openFileFromSearch('${result.path}', ${hasHandle})">
                <div class="search-result-title">
                    <i class="fas fa-file-code"></i> ${result.name}
                </div>
                <div class="search-result-path">${result.path}</div>
                ${result.preview ? `<div class="search-result-preview">${highlightedContent}</div>` : ''}
            </div>
        `;
    });
    
    searchResults.innerHTML = html;
}

// 高亮搜索词
function highlightSearchTerm(text, term) {
    if (!text || !term) return text;
    
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 3px;">$1</mark>');
}

// 从搜索结果打开文件
function openFileFromSearch(filePath, hasHandle = false) {
    if (hasHandle && currentLocalStructure) {
        // 如果有handle，需要在结构中找到对应的文件项
        const fileItem = findFileInStructure(currentLocalStructure, filePath);
        if (fileItem && fileItem.handle) {
            openFile(filePath, fileItem.handle);
            return;
        }
    }
    
    // 如果没有handle或找不到文件项，使用普通方式打开
    openFile(filePath);
}

// 在文件结构中查找指定路径的文件
function findFileInStructure(structure, targetPath, basePath = '') {
    for (const item of structure) {
        const fullPath = basePath ? `${basePath}/${item.name}` : item.name;
        
        if (fullPath === targetPath) {
            return item;
        }
        
        if (item.type === 'directory' && item.children) {
            const found = findFileInStructure(item.children, targetPath, fullPath);
            if (found) return found;
        }
    }
    
    return null;
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 项目管理相关函数

// 显示统一的项目添加对话框
function showUnifiedProjectDialog() {
    const modal = document.getElementById('unifiedProjectModal');
    modal.style.display = 'block';
    
    // 触发位置恢复事件
    setTimeout(() => {
        modal.dispatchEvent(new Event('show'));
    }, 10);
    
    // 重置到选择界面
    resetProjectOptions();
    
    // 检查浏览器兼容性
    checkBrowserCompatibility();
}

// 关闭统一项目对话框
function closeUnifiedProjectDialog() {
    const modal = document.getElementById('unifiedProjectModal');
    modal.style.display = 'none';
    
    // 重置所有状态
    resetProjectOptions();
    resetLocalFileState();
    
    // 清空表单
    const form = document.getElementById('manualProjectForm');
    if (form) form.reset();
}

// 选择项目添加方式
function selectProjectOption(type) {
    const localSection = document.getElementById('localFileSection');
    const uploadSection = document.getElementById('uploadFileSection');
    const manualSection = document.getElementById('manualAddSection');
    const optionsDiv = document.querySelector('.project-options');
    
    // 隐藏选项卡
    optionsDiv.style.display = 'none';
    
    if (type === 'local') {
        if (localSection) localSection.style.display = 'block';
        if (uploadSection) uploadSection.style.display = 'none';
        if (manualSection) manualSection.style.display = 'none';
        checkBrowserCompatibility();
    } else if (type === 'upload') {
        if (localSection) localSection.style.display = 'none';
        if (uploadSection) uploadSection.style.display = 'block';
        if (manualSection) manualSection.style.display = 'none';
        // 聚焦到项目名称输入框
        setTimeout(() => {
            document.getElementById('uploadProjectName').focus();
        }, 100);
    } else if (type === 'manual') {
        if (localSection) localSection.style.display = 'none';
        if (uploadSection) uploadSection.style.display = 'none';
        if (manualSection) manualSection.style.display = 'block';
        // 聚焦到项目名称输入框
        setTimeout(() => {
            document.getElementById('projectName').focus();
        }, 100);
    }
}

// 重置到选择界面
function resetProjectOptions() {
    const localSection = document.getElementById('localFileSection');
    const uploadSection = document.getElementById('uploadFileSection');
    const manualSection = document.getElementById('manualAddSection');
    const optionsDiv = document.querySelector('.project-options');
    
    // 显示选项卡，隐藏其他
    optionsDiv.style.display = 'grid';
    if (localSection) localSection.style.display = 'none';
    if (uploadSection) uploadSection.style.display = 'none';
    if (manualSection) manualSection.style.display = 'none';
}

// 检查浏览器兼容性
function checkBrowserCompatibility() {
    const infoBox = document.getElementById('compatibilityInfo');
    
    if ('showDirectoryPicker' in window) {
        infoBox.innerHTML = '<i class="fas fa-check-circle"></i> <span>您的浏览器支持本地文件访问功能</span>';
        infoBox.className = 'info-box success';
    } else {
        infoBox.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>您的浏览器不支持本地文件访问，请使用 Chrome 86+ 或 Edge 86+</span>';
        infoBox.className = 'info-box warning';
    }
}

// 重置本地文件状态
function resetLocalFileState() {
    selectedDirectoryHandle = null;
    currentLocalStructure = null;
    const folderInfo = document.getElementById('selectedFolderInfo');
    if (folderInfo) folderInfo.style.display = 'none';
}

// 设置统一项目表单
function setupUnifiedProjectForm() {
    // 处理手动添加项目表单
    const manualForm = document.getElementById('manualProjectForm');
    if (manualForm) {
        manualForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const projectData = {
                name: formData.get('projectName'),
                path: formData.get('projectPath')
            };
            
            try {
                const sessionToken = localStorage.getItem('authToken');
                const response = await fetch('/api/projects', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify(projectData)
                });
                
                if (response.ok) {
                    const newProject = await response.json();
                    projects.push(newProject);
                    renderProjectList();
                    closeUnifiedProjectDialog();
                    
                    // 自动选择新添加的项目
                    selectProject(newProject.id);
                    
                    // 显示成功消息
                    showNotification('项目添加成功！', 'success');
                } else {
                    const error = await response.json();
                    throw new Error(error.error || '添加项目失败');
                }
            } catch (error) {
                console.error('添加项目失败:', error);
                showNotification('添加项目失败: ' + error.message, 'error');
            }
        });
    }
    
    // 处理文件上传表单
    const uploadForm = document.getElementById('uploadProjectForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleFileUpload(e.target);
        });
    }
    
    // 点击模态框外部关闭
    const modal = document.getElementById('unifiedProjectModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeUnifiedProjectDialog();
            }
        });
    }
}

// 刷新项目
async function refreshProject(projectId) {
    try {
        showNotification('正在刷新项目...', 'info');
        
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            showNotification('项目不存在', 'error');
            return;
        }
        
        // 如果是当前选中的项目，重新加载结构
        if (currentProject && currentProject.id === projectId) {
            await loadProjectStructure(project);
        }
        
        showNotification('项目已刷新', 'success');
    } catch (error) {
        console.error('刷新项目失败:', error);
        showNotification('刷新项目失败: ' + error.message, 'error');
    }
}

// 重命名项目
async function renameProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        showNotification('项目不存在', 'error');
        return;
    }
    
    // 不能重命名默认项目
    currentRenameProjectId = projectId;
    document.getElementById('newProjectName').value = project.name;
    document.getElementById('renameProjectModal').style.display = 'block';
    document.getElementById('newProjectName').focus();
    document.getElementById('newProjectName').select();
}

// 关闭重命名项目对话框
function closeRenameProjectDialog() {
    document.getElementById('renameProjectModal').style.display = 'none';
    document.getElementById('renameProjectForm').reset();
    currentRenameProjectId = null;
}

// 设置重命名项目表单
function setupRenameProjectForm() {
    document.getElementById('renameProjectForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!currentRenameProjectId) {
            return;
        }
        
        const formData = new FormData(e.target);
        const newName = formData.get('newProjectName').trim();
        
        if (!newName) {
            showNotification('项目名称不能为空', 'error');
            return;
        }
        
        // 检查名称是否重复
        if (projects.some(p => p.name === newName && p.id !== currentRenameProjectId)) {
            showNotification('项目名称已存在', 'error');
            return;
        }
        
        try {
            const sessionToken = localStorage.getItem('authToken');
            const response = await fetch(`/api/projects/${currentRenameProjectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ name: newName })
            });
            
            if (response.ok) {
                const updatedProject = await response.json();
                
                // 更新本地项目列表
                const projectIndex = projects.findIndex(p => p.id === currentRenameProjectId);
                if (projectIndex !== -1) {
                    projects[projectIndex] = updatedProject;
                }
                
                // 更新当前项目信息
                if (currentProject?.id === currentRenameProjectId) {
                    currentProject = updatedProject;
                }
                
                renderProjectList();
                closeRenameProjectDialog();
                
                showNotification('项目重命名成功！', 'success');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || '重命名项目失败');
            }
        } catch (error) {
            console.error('重命名项目失败:', error);
            showNotification('重命名项目失败: ' + error.message, 'error');
        }
    });
    
    // 点击模态框外部关闭
    document.getElementById('renameProjectModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeRenameProjectDialog();
        }
    });
}

// 移除项目
async function removeProject(projectId) {
    if (!confirm('确定要移除这个项目吗？这将删除项目及其所有文件数据。')) {
        return;
    }
    
    try {
        console.log('🗑️ 正在移除项目:', projectId);
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // 清理本地存储的项目数据
            localStorage.removeItem(`localProject_${projectId}`);
            
            // 从项目列表中移除
            projects = projects.filter(p => p.id !== projectId);
            console.log('📋 更新项目列表，剩余项目数:', projects.length);
            
            // 如果移除的是当前项目，清空当前项目引用
            if (currentProject?.id === projectId) {
                console.log('🔄 移除的是当前项目，重置currentProject');
                currentProject = null;
            }
            
            renderProjectList(); // 这里会自动处理空项目状态
            
            // 如果还有其他项目，选择第一个；否则已由renderProjectList处理空状态
            if (projects.length > 0 && !currentProject) {
                console.log('🎯 自动选择第一个项目:', projects[0].name);
                await selectProject(projects[0].id);
            } else if (projects.length === 0) {
                console.log('📭 没有项目了，显示空状态');
                showNoProjectsState();
            }
            
            // 显示包含文件数量的通知
            const deletedFiles = result.deletedFiles || 0;
            const message = deletedFiles > 0 
                ? `项目已移除，同时删除了 ${deletedFiles} 个文件`
                : '项目已移除';
            showNotification(message, 'success');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '移除项目失败');
        }
    } catch (error) {
        console.error('移除项目失败:', error);
        showNotification('移除项目失败: ' + error.message, 'error');
    }
}

// 下载项目到本地
async function downloadProject(projectId) {
    try {
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            showNotification('项目不存在', 'error');
            return;
        }
        
        showNotification('正在准备下载项目...', 'info');
        
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch(`/api/projects/${projectId}/download`, {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '下载失败');
        }
        
        const projectData = await response.json();
        
        // 使用JSZip创建zip文件
        if (typeof JSZip !== 'undefined') {
            const zip = new JSZip();
            
            // 添加所有文件到zip
            Object.entries(projectData.files).forEach(([filePath, content]) => {
                zip.file(filePath, content);
            });
            
            // 生成zip文件并下载
            const blob = await zip.generateAsync({ type: 'blob' });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectData.projectName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification(`项目 "${projectData.projectName}" 下载成功！包含 ${projectData.totalFiles} 个文件`, 'success');
        } else {
            // 如果没有JSZip，创建一个包含所有文件的文本文件
            let allContent = `项目: ${projectData.projectName}\n`;
            allContent += `文件数量: ${projectData.totalFiles}\n`;
            allContent += '='.repeat(50) + '\n\n';
            
            Object.entries(projectData.files).forEach(([filePath, content]) => {
                allContent += `文件: ${filePath}\n`;
                allContent += '-'.repeat(30) + '\n';
                allContent += content + '\n\n';
            });
            
            // 下载为文本文件
            const blob = new Blob([allContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${projectData.projectName}_export.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification(`项目 "${projectData.projectName}" 已导出为文本文件`, 'success');
        }
        
    } catch (error) {
        console.error('下载项目失败:', error);
        showNotification('下载项目失败: ' + error.message, 'error');
    }
}

// 显示同步说明模态框
function showSyncInstructionsModal() {
    const modal = document.createElement('div');
    modal.className = 'sync-instructions-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    `;
    
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="color: #1a73e8; margin: 0 0 10px 0;">
                <i class="fas fa-sync-alt"></i> 本地文件同步指南
            </h2>
            <p style="color: #666; margin: 0;">了解如何保持服务器修改与本地文件的同步</p>
        </div>
        
        <div style="margin-bottom: 25px;">
            <h3 style="color: #e74c3c; margin-bottom: 10px;">
                <i class="fas fa-exclamation-triangle"></i> 重要说明
            </h3>
            <div style="background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 15px;">
                <p style="margin: 0; color: #c53030;">
                    由于浏览器安全限制，在线编辑器无法直接修改您本地的文件。
                    编辑操作只会更新服务器数据库中的副本。
                </p>
            </div>
        </div>
        
        <div style="margin-bottom: 25px;">
            <h3 style="color: #27ae60; margin-bottom: 15px;">
                <i class="fas fa-lightbulb"></i> 推荐同步方案
            </h3>
            
            <div style="margin-bottom: 15px;">
                <div style="background: #f0f8ff; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px;">
                    <h4 style="color: #1a73e8; margin: 0 0 10px 0;">
                        <i class="fas fa-download"></i> 方案一：下载更新的文件
                    </h4>
                    <ul style="margin: 0; padding-left: 20px; color: #666;">
                        <li>每次保存后，使用"下载单个文件"获取最新版本</li>
                        <li>手动替换本地对应的文件</li>
                        <li>适合：偶尔修改几个文件的情况</li>
                    </ul>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 8px; padding: 15px;">
                    <h4 style="color: #27ae60; margin: 0 0 10px 0;">
                        <i class="fas fa-archive"></i> 方案二：下载完整项目
                    </h4>
                    <ul style="margin: 0; padding-left: 20px; color: #666;">
                        <li>定期下载整个项目的ZIP包</li>
                        <li>解压到本地，覆盖原有文件</li>
                        <li>适合：大量修改或定期同步的情况</li>
                    </ul>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="background: #fffbf0; border: 1px solid #f7e6a4; border-radius: 8px; padding: 15px;">
                    <h4 style="color: #f39c12; margin: 0 0 10px 0;">
                        <i class="fas fa-code-branch"></i> 方案三：使用版本控制（推荐）
                    </h4>
                    <ul style="margin: 0; padding-left: 20px; color: #666;">
                        <li>下载项目后，使用Git等版本控制工具</li>
                        <li>可以跟踪所有修改历史</li>
                        <li>支持多人协作和版本回退</li>
                    </ul>
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 25px;">
            <h3 style="color: #6f42c1; margin-bottom: 15px;">
                <i class="fas fa-magic"></i> 快捷操作
            </h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="downloadCurrentProject()" 
                        style="flex: 1; min-width: 140px; padding: 12px; border: 1px solid #27ae60; border-radius: 8px; background: #27ae60; color: white; cursor: pointer;">
                    <i class="fas fa-download"></i> 下载当前项目
                </button>
                <button onclick="showBatchDownloadOptions()" 
                        style="flex: 1; min-width: 140px; padding: 12px; border: 1px solid #1a73e8; border-radius: 8px; background: #1a73e8; color: white; cursor: pointer;">
                    <i class="fas fa-list"></i> 批量下载选项
                </button>
            </div>
        </div>
        
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
            <button onclick="closeSyncInstructionsModal()" 
                    style="padding: 12px 24px; border: 1px solid #ddd; border-radius: 8px; background: white; color: #666; cursor: pointer;">
                <i class="fas fa-times"></i> 关闭
            </button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 添加关闭函数
    window.closeSyncInstructionsModal = function() {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        delete window.closeSyncInstructionsModal;
        delete window.downloadCurrentProject;
        delete window.showBatchDownloadOptions;
    };
    
    // 下载当前项目
    window.downloadCurrentProject = function() {
        if (currentProject) {
            downloadProject(currentProject.id);
            closeSyncInstructionsModal();
        }
    };
    
    // 显示批量下载选项
    window.showBatchDownloadOptions = function() {
        closeSyncInstructionsModal();
        showBatchDownloadModal();
    };
    
    // 点击背景关闭
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeSyncInstructionsModal();
        }
    });
}

// 显示批量下载模态框
function showBatchDownloadModal() {
    const modal = document.createElement('div');
    modal.className = 'batch-download-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    `;
    
    const projectList = projects.map(project => `
        <div style="display: flex; align-items: center; padding: 10px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 8px;">
            <input type="checkbox" id="project_${project.id}" value="${project.id}" style="margin-right: 12px;">
            <div style="flex: 1;">
                <div style="font-weight: bold; color: #333;">${project.name}</div>
                <div style="font-size: 0.8em; color: #666;">${project.path}</div>
            </div>
            <button onclick="downloadProject('${project.id}')" 
                    style="padding: 6px 12px; border: 1px solid #1a73e8; border-radius: 6px; background: #f8f9ff; color: #1a73e8; cursor: pointer; font-size: 0.8em;">
                <i class="fas fa-download"></i>
            </button>
        </div>
    `).join('');
    
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="color: #1a73e8; margin: 0 0 10px 0;">
                <i class="fas fa-archive"></i> 批量项目下载
            </h2>
            <p style="color: #666; margin: 0;">选择要下载的项目</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            ${projectList}
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center; padding-top: 20px; border-top: 1px solid #eee;">
            <button onclick="selectAllProjects()" 
                    style="padding: 10px 16px; border: 1px solid #27ae60; border-radius: 6px; background: #f8fff8; color: #27ae60; cursor: pointer;">
                <i class="fas fa-check-square"></i> 全选
            </button>
            <button onclick="downloadSelectedProjects()" 
                    style="padding: 10px 16px; border: 1px solid #1a73e8; border-radius: 6px; background: #1a73e8; color: white; cursor: pointer;">
                <i class="fas fa-download"></i> 下载选中
            </button>
            <button onclick="closeBatchDownloadModal()" 
                    style="padding: 10px 16px; border: 1px solid #ddd; border-radius: 6px; background: white; color: #666; cursor: pointer;">
                <i class="fas fa-times"></i> 关闭
            </button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 添加相关函数
    window.closeBatchDownloadModal = function() {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        delete window.closeBatchDownloadModal;
        delete window.selectAllProjects;
        delete window.downloadSelectedProjects;
    };
    
    window.selectAllProjects = function() {
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
    };
    
    window.downloadSelectedProjects = function() {
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedIds.length === 0) {
            showNotification('请选择要下载的项目', 'warning');
            return;
        }
        
        // 依次下载选中的项目
        selectedIds.forEach((projectId, index) => {
            setTimeout(() => {
                downloadProject(projectId);
            }, index * 1000); // 间隔1秒下载，避免同时下载太多
        });
        
        showNotification(`正在下载 ${selectedIds.length} 个项目...`, 'info');
        closeBatchDownloadModal();
    };
    
    // 点击背景关闭
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeBatchDownloadModal();
        }
    });
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9em;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // 动画显示
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 获取通知图标
function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// 获取通知颜色
function getNotificationColor(type) {
    switch (type) {
        case 'success': return '#4CAF50';
        case 'error': return '#f44336';
        case 'warning': return '#ff9800';
        default: return '#2196F3';
    }
}

// 初始化highlight.js
hljs.highlightAll();

// AI配置管理功能
function setupAIConfigForm() {
    const form = document.getElementById('aiConfigUpdateForm');
    const presetButtons = document.querySelectorAll('#aiConfigModal .preset-btn');
    const apiUrlInput = document.getElementById('configApiUrl');
    
    // 预设按钮处理
    presetButtons.forEach(button => {
        button.addEventListener('click', function() {
            presetButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const url = this.dataset.url;
            if (url) {
                apiUrlInput.value = url;
            }
        });
    });

    // 表单提交处理
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await updateAIConfiguration();
    });
}

function openAIConfigModal() {
    const modal = document.getElementById('aiConfigModal');
    modal.style.display = 'block';
    
    // 触发位置恢复事件
    setTimeout(() => {
        modal.dispatchEvent(new Event('show'));
    }, 10);
    
    // 加载当前配置
    loadCurrentAIConfig();
    
    // 初始化拖动功能
    initModalDrag(modal);
    // 初始化调整大小功能
    initModalResize(modal);
}

function initModalDrag(modal) {
    const header = modal.querySelector('.modal-header');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        const modalContent = modal.querySelector('.modal-content');
        const rect = modalContent.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const modalContent = modal.querySelector('.modal-content');
        modalContent.style.left = (e.clientX - offsetX) + 'px';
        modalContent.style.top = (e.clientY - offsetY) + 'px';
        modalContent.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'move';
        }
    });
}

function initModalResize(modal) {
    const handle = modal.querySelector('.resize-handle');
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        const modalContent = modal.querySelector('.modal-content');
        startWidth = parseInt(window.getComputedStyle(modalContent).width);
        startHeight = parseInt(window.getComputedStyle(modalContent).height);
        startX = e.clientX;
        startY = e.clientY;
        handle.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const modalContent = modal.querySelector('.modal-content');
        const newWidth = startWidth + (e.clientX - startX);
        const newHeight = startHeight + (e.clientY - startY);
        
        // 设置最小尺寸限制
        if (newWidth > 600 && newHeight > 450) { // 400px * 1.5 = 600px, 300px * 1.5 = 450px
            modalContent.style.width = newWidth + 'px';
            modalContent.style.height = newHeight + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            handle.style.cursor = 'se-resize';
        }
    });
}

function closeAIConfigModal() {
    const modal = document.getElementById('aiConfigModal');
    modal.style.display = 'none';
}

async function loadCurrentAIConfig() {
    try {
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch('/api/ai-config/status', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.configured) {
                updateCurrentConfigDisplay(data.config);
                
                // 填充表单
                document.getElementById('configApiUrl').value = data.config.apiUrl;
                
                // 选择对应的预设按钮
                const presetButtons = document.querySelectorAll('#aiConfigModal .preset-btn');
                presetButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.url === data.config.apiUrl) {
                        btn.classList.add('active');
                    }
                });
            }
        }
    } catch (error) {
        console.error('加载AI配置失败:', error);
    }
}

function updateCurrentConfigDisplay(config) {
    const currentConfigDiv = document.getElementById('currentConfig');
    const lastValidated = new Date(config.lastValidated).toLocaleString('zh-CN');
    
    currentConfigDiv.innerHTML = `
        <h4><i class="fas fa-check-circle" style="color: #28a745;"></i> 当前AI配置</h4>
        <p><strong>API URL:</strong> ${config.apiUrl}</p>
        <p><strong>最后验证:</strong> ${lastValidated}</p>
        <p style="color: #28a745; margin: 0;"><i class="fas fa-shield-alt"></i> 配置有效</p>
    `;
}

async function updateAIConfiguration() {
    const apiUrl = document.getElementById('configApiUrl').value.trim();
    const apiKey = document.getElementById('configApiKey').value.trim();
    const submitButton = document.querySelector('#aiConfigUpdateForm .btn-primary');
    const loading = submitButton.querySelector('.config-loading');
    const btnText = submitButton.querySelector('.config-btn-text');
    const testResult = document.getElementById('configTestResult');

    if (!apiUrl || !apiKey) {
        showConfigResult('请填写完整的API URL和API Key', 'error');
        return;
    }

    // 显示加载状态
    submitButton.disabled = true;
    loading.style.display = 'inline-block';
    btnText.style.display = 'none';
    testResult.style.display = 'none';

    try {
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch('/api/ai-config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ apiUrl, apiKey })
        });

        const data = await response.json();

        if (response.ok) {
            showConfigResult('AI配置更新成功！', 'success');
            updateCurrentConfigDisplay(data.config);
            aiConfigured = true;
            
            // 更新账户信息区域的AI状态
            checkUserAIStatus();
            
            // 清空密码字段
            document.getElementById('configApiKey').value = '';
            
            // 延迟关闭模态框
            setTimeout(() => {
                closeAIConfigModal();
            }, 1500);
        } else {
            showConfigResult(data.error + (data.details ? ': ' + data.details : ''), 'error');
        }
    } catch (error) {
        showConfigResult('更新失败: ' + error.message, 'error');
    } finally {
        // 隐藏加载状态
        submitButton.disabled = false;
        loading.style.display = 'none';
        btnText.style.display = 'inline';
    }
}

function showConfigResult(message, type) {
    const testResult = document.getElementById('configTestResult');
    testResult.textContent = message;
    testResult.className = `test-result ${type}`;
    testResult.style.display = 'block';
}

// 项目分析功能
async function analyzeProject() {
    console.log('🏗️ 开始项目分析');
    console.log('📋 当前项目状态:', currentProject ? `${currentProject.name} (ID: ${currentProject.id})` : 'null');
    debugAIStatus(); // 调试AI状态
    
    if (!currentProject) {
        console.log('❌ 没有选择项目');
        showNotification('请先选择一个项目', 'warning');
        return;
    }

    // 检查是否为本地项目，禁止分析
    if (currentProject.path && currentProject.path.startsWith('[本地]')) {
        console.log('❌ 本地项目不支持AI分析');
        showNotification('本地文件夹项目不支持AI分析功能，请使用上传到服务器的项目', 'warning');
        return;
    }
    
    // 如果AI未配置，尝试重新检查一次
    if (!aiConfigured) {
        console.log('⚠️ AI未配置，尝试重新检查...');
        await checkAIConfiguration();
        debugAIStatus(); // 再次检查状态
    }
    
    if (!aiConfigured) {
        console.log('❌ AI仍未配置，显示配置提示');
        showNotification('请先配置AI服务', 'warning');
        openAIConfigModal();
        return;
    }

    // 双重验证：确保项目仍然存在于项目列表中
    const projectExists = projects.find(p => p.id === currentProject.id);
    if (!projectExists) {
        console.log('❌ 当前项目已不存在于项目列表中，重置currentProject');
        currentProject = null;
        showNotification('当前项目已不存在，请重新选择项目', 'warning');
        return;
    }

    console.log('✅ 开始项目分析，项目:', currentProject.name, '(ID:', currentProject.id, ')');

    try {
        // 首先检查是否已有分析结果
        const existingConfigResponse = await fetch(`/api/projects/${currentProject.id}/restructure`);
        const existingConfig = await existingConfigResponse.json();
        
        if (existingConfig.hasConfig) {
            // 已有分析结果，询问用户是否重新分析
            const shouldReanalyze = await showAnalysisOptionsDialog(existingConfig.config);
            if (!shouldReanalyze) {
                // 用户选择使用现有配置，显示现有的分析结果
                showExistingAnalysisResult(existingConfig.config, currentProject.id);
                return;
            }
        }
        
        // 执行新的分析
        await performNewAnalysis();
        
    } catch (error) {
        console.error('项目分析失败:', error);
        showNotification('项目分析失败: ' + error.message, 'error');
    }
}

// 显示分析选项对话框
function showAnalysisOptionsDialog(existingConfig) {
    return new Promise((resolve) => {
        const savedDate = new Date(existingConfig.savedAt).toLocaleString('zh-CN');
        
        const modal = document.createElement('div');
        modal.className = 'analysis-options-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeAnalysisOptionsDialog()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-history"></i> 发现已有分析结果</h3>
                </div>
                <div class="modal-body">
                    <div class="existing-analysis-info">
                        <p><strong>项目:</strong> ${existingConfig.projectName}</p>
                        <p><strong>分析时间:</strong> ${savedDate}</p>
                        <p><strong>状态:</strong> <span class="status-applied"><i class="fas fa-check"></i> 已应用重组配置</span></p>
                    </div>
                    <div class="options">
                        <p>请选择您希望的操作：</p>
                        <div class="option-buttons">
                            <button class="option-btn use-existing" onclick="resolveAnalysisOptions(false)">
                                <i class="fas fa-eye"></i>
                                查看现有分析结果
                            </button>
                            <button class="option-btn reanalyze" onclick="resolveAnalysisOptions(true)">
                                <i class="fas fa-refresh"></i>
                                重新分析项目
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 存储resolve函数供按钮调用
        window.currentAnalysisOptionsResolve = resolve;
    });
}

// 关闭分析选项对话框
function closeAnalysisOptionsDialog() {
    const modal = document.querySelector('.analysis-options-modal');
    if (modal) {
        document.body.removeChild(modal);
    }
    if (window.currentAnalysisOptionsResolve) {
        window.currentAnalysisOptionsResolve(false);
        delete window.currentAnalysisOptionsResolve;
    }
}

// 解析分析选项
function resolveAnalysisOptions(shouldReanalyze) {
    if (window.currentAnalysisOptionsResolve) {
        window.currentAnalysisOptionsResolve(shouldReanalyze);
        delete window.currentAnalysisOptionsResolve;
    }
    closeAnalysisOptionsDialog();
}

// 显示现有分析结果
function showExistingAnalysisResult(config, projectId) {
    const aiPanel = document.getElementById('aiPanel');
    const aiContent = document.getElementById('aiContent');
    
    const savedDate = new Date(config.savedAt).toLocaleString('zh-CN');
    
    let displayContent = `<div class="analysis-result existing-result">
        <h3><i class="fas fa-history"></i> 已保存的分析结果</h3>
        <div class="existing-info">
            <p><strong>分析时间:</strong> ${savedDate}</p>
            <p><strong>状态:</strong> <span class="status-applied"><i class="fas fa-check"></i> 已应用重组配置</span></p>
        </div>
    `;
    
    // 如果有重组配置，显示重组和重置按钮
    if (config.structureMapping) {
        displayContent += `
            <div class="restructure-section">
                <p class="restructure-info">当前项目已应用AI重组配置，目录结构已优化。</p>
                <button class="restructure-btn reset-btn" onclick="resetProjectRestructure('${projectId}')">
                    <i class="fas fa-undo"></i> 重置为原始结构
                </button>
                <button class="restructure-btn reanalyze-btn" onclick="analyzeProject()">
                    <i class="fas fa-refresh"></i> 重新分析项目
                </button>
            </div>
        `;
    }
    
    displayContent += `</div>`;
    
    aiContent.innerHTML = displayContent;
    aiPanel.classList.add('open');
    
    showNotification('已显示保存的分析结果', 'info');
}

// 执行新的分析
async function performNewAnalysis() {
    showNotification('正在分析项目，请稍候...', 'info');
    
    const sessionToken = localStorage.getItem('authToken');
    const response = await fetch('/api/analyze-project', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ 
            projectId: currentProject.id
        })
    });

    if (response.ok) {
        const result = await response.json();
        
        // 显示AI面板
        const aiPanel = document.getElementById('aiPanel');
        const aiContent = document.getElementById('aiContent');
        
        let displayContent = `<div class="analysis-result">
            <h3><i class="fas fa-project-diagram"></i> 项目分析报告</h3>`;
        
        // 如果有思考过程，添加可展开的思考部分
        if (result.hasThinking && result.thinking) {
            displayContent += `
                <div class="thinking-section">
                    <div class="thinking-header" onclick="toggleThinking()">
                        <i class="fas fa-brain"></i>
                        <span>AI思考过程</span>
                        <i class="fas fa-chevron-down thinking-toggle"></i>
                    </div>
                    <div class="thinking-content" id="thinkingContent" style="display: none;">
                        ${formatAnalysisResult(result.thinking)}
                    </div>
                </div>
            `;
        }
        
        displayContent += `
            <div class="analysis-content">${formatAnalysisResult(result.analysis)}</div>`;
        
        // 如果有结构映射，添加重组按钮
        if (result.structureMapping) {
            displayContent += `
                <div class="restructure-section">
                    <button class="restructure-btn" onclick="applyProjectRestructure('${result.project.id}', '${encodeURIComponent(JSON.stringify(result.structureMapping))}')">
                        <i class="fas fa-magic"></i> 应用目录重组
                    </button>
                    <button class="restructure-btn reset-btn" onclick="resetProjectRestructure('${result.project.id}')">
                        <i class="fas fa-undo"></i> 重置为原始结构
                    </button>
                </div>
            `;
        }
        
        displayContent += `</div>`;
        
        aiContent.innerHTML = displayContent;
        
        aiPanel.classList.add('open');
        showNotification('项目分析完成', 'success');
    } else {
        const error = await response.json();
        console.error('项目分析错误:', error);
        showNotification(error.error || '项目分析失败', 'error');
    }
}

function formatAnalysisResult(analysis) {
    // 简单的Markdown渲染
    return analysis
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

// 初始化AI面板拖动功能
function initAiPanelDraggable() {
    const aiPanel = document.getElementById('aiPanel');
    const header = document.getElementById('aiPanelHeader');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        // 计算鼠标相对于面板左上角的偏移量
        offsetX = e.clientX - aiPanel.getBoundingClientRect().left;
        offsetY = e.clientY - aiPanel.getBoundingClientRect().top;
        header.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        // 计算新位置
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        // 设置面板位置
        aiPanel.style.left = `${x}px`;
        aiPanel.style.top = `${y}px`;
        aiPanel.style.right = 'auto'; // 覆盖默认right定位
        aiPanel.style.transform = 'none';
        mouseMoveTimeout = null;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'move';
        }
    });
}



// ESC键控制显示/隐藏
function setupEscKeyControl() {
    const aiPanel = document.getElementById('aiPanel');
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            aiPanel.classList.toggle('open');
            // 清除所有内联位置样式，确保CSS控制
            aiPanel.style.left = '';
            aiPanel.style.top = '';
            aiPanel.style.right = '';
            aiPanel.style.transform = '';
        }
    });
}

// 初始化AI面板调整大小功能
function initAiPanelResizable() {
    const aiPanel = document.getElementById('aiPanel');
    const handle = aiPanel.querySelector('.resize-handle');
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        // 记录初始位置和尺寸
        startX = e.clientX;
        startY = e.clientY;
        startWidth = aiPanel.offsetWidth;
        startHeight = aiPanel.offsetHeight;
        aiPanel.style.transition = 'none'; // 禁用过渡动画
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        // 计算新尺寸
        const newWidth = Math.max(450, startWidth + (e.clientX - startX)); // 300px * 1.5 = 450px
        const newHeight = Math.max(600, startHeight + (e.clientY - startY)); // 400px * 1.5 = 600px
        // 设置新尺寸
        aiPanel.style.width = `${newWidth}px`;
        aiPanel.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            aiPanel.style.transition = 'all 0.3s ease'; // 恢复过渡动画
        }
    });
}

// 页面加载时初始化面板功能
document.addEventListener('DOMContentLoaded', () => {
    initAiPanelDraggable();
    initAiPanelResizable();
    setupEscKeyControl();
});

// 切换思考过程显示
function toggleThinking() {
    const thinkingContent = document.getElementById('thinkingContent');
    const toggleIcon = document.querySelector('.thinking-toggle');
    
    if (thinkingContent.style.display === 'none') {
        thinkingContent.style.display = 'block';
        toggleIcon.classList.remove('fa-chevron-down');
        toggleIcon.classList.add('fa-chevron-up');
    } else {
        thinkingContent.style.display = 'none';
        toggleIcon.classList.remove('fa-chevron-up');
        toggleIcon.classList.add('fa-chevron-down');
    }
}

// 应用项目重组
async function applyProjectRestructure(projectId, encodedMapping) {
    try {
        const structureMapping = JSON.parse(decodeURIComponent(encodedMapping));
        
        showNotification('正在应用目录重组...', 'info');
        
        // 重新获取项目结构
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            showNotification('项目不存在', 'error');
            return;
        }
        
        // 保存重组配置到服务器
        const sessionToken = localStorage.getItem('authToken');
        const saveResponse = await fetch(`/api/projects/${projectId}/restructure`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ structureMapping })
        });
        
        if (!saveResponse.ok) {
            throw new Error('保存重组配置失败');
        }
        
        // 只有当重组的项目是当前选中的项目时，才重新加载项目结构
        if (currentProject && currentProject.id === projectId) {
            console.log('🔄 重组的项目是当前项目，重新加载结构');
            await loadProjectStructure(project);
        } else {
            console.log('ℹ️ 重组的项目不是当前项目，不重新加载结构');
        }
        
        // 更新状态显示
        updateProjectRestructureStatus(projectId, true);
        
        showNotification(`项目 "${project.name}" 的目录重组已保存`, 'success');
        
    } catch (error) {
        console.error('应用目录重组失败:', error);
        showNotification('应用目录重组失败: ' + error.message, 'error');
    }
}

// 重置项目重组配置
async function resetProjectRestructure(projectId) {
    if (!confirm('确定要重置为原始目录结构吗？这将删除所有保存的重组配置。')) {
        return;
    }
    
    try {
        showNotification('正在重置目录结构...', 'info');
        
        // 删除服务器上的重组配置
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch(`/api/projects/${projectId}/restructure`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('删除重组配置失败');
        }
        
        // 只有当重置的项目是当前选中的项目时，才重新加载项目结构
        const project = projects.find(p => p.id === projectId);
        if (project && currentProject && currentProject.id === projectId) {
            console.log('🔄 重置的项目是当前项目，重新加载结构');
            await loadProjectStructure(project);
        } else {
            console.log('ℹ️ 重置的项目不是当前项目，不重新加载结构');
        }
        
        // 更新状态显示
        updateProjectRestructureStatus(projectId, false);
        
        const projectName = project ? project.name : '未知项目';
        showNotification(`项目 "${projectName}" 的目录结构已重置为原始状态`, 'success');
        
    } catch (error) {
        console.error('重置目录结构失败:', error);
        showNotification('重置目录结构失败: ' + error.message, 'error');
    }
}

// 根据AI分析对项目结构进行分类
function categorizeProjectStructure(structure, mapping) {
    console.log('🔧 开始分类项目结构');
    console.log('📁 输入结构:', structure);
    console.log('🗺️ 映射配置:', mapping);
    
    if (!mapping || !mapping.categories) {
        console.log('⚠️ 没有有效的映射配置，返回原始结构');
        return structure;
    }
    
    // 验证映射配置的完整性
    const categories = mapping.categories;
    const validCategories = {};
    
    Object.keys(categories).forEach(categoryName => {
        const category = categories[categoryName];
        if (category && category.directories && Array.isArray(category.directories)) {
            validCategories[categoryName] = category;
        } else {
            console.warn(`⚠️ 跳过无效的分类配置 "${categoryName}":`, category);
        }
    });
    
    if (Object.keys(validCategories).length === 0) {
        console.log('⚠️ 没有有效的分类配置，返回原始结构');
        return structure;
    }
    
    const categorizedStructure = [];
    const uncategorized = [];
    
    console.log('📚 有效分类:', Object.keys(validCategories));
    
    // 为每个分类创建容器
    Object.keys(validCategories).forEach(categoryName => {
        const category = validCategories[categoryName];
        console.log(`🏷️ 处理分类: ${categoryName}`, category);
        
        const categoryContainer = {
            name: categoryName,
            type: 'category',
            path: '',
            description: category.description,
            color: category.color || getCategoryColor(categoryName),
            children: []
        };
        
        // 查找属于这个分类的目录
        structure.forEach(item => {
            if (item.type === 'directory') {
                const itemPath = item.name + '/';
                // 安全检查：确保 category.directories 存在且是数组
                if (!category.directories || !Array.isArray(category.directories)) {
                    console.warn(`⚠️ 分类 "${categoryName}" 的 directories 属性无效:`, category.directories);
                    return;
                }
                const isMatched = category.directories.some(dir => {
                    const match = dir === itemPath || 
                           itemPath.toLowerCase().includes(dir.toLowerCase().replace('/', '')) ||
                           dir.toLowerCase().replace('/', '').includes(item.name.toLowerCase());
                    if (match) {
                        console.log(`✅ 匹配成功: ${item.name} -> ${categoryName} (规则: ${dir})`);
                    }
                    return match;
                });
                
                if (isMatched) {
                    categoryContainer.children.push(item);
                }
            }
        });
        
        // 只有非空分类才添加
        if (categoryContainer.children.length > 0) {
            console.log(`📦 添加分类 "${categoryName}" 包含 ${categoryContainer.children.length} 个项目`);
            categorizedStructure.push(categoryContainer);
        } else {
            console.log(`📭 分类 "${categoryName}" 为空，跳过`);
        }
    });
    
    // 添加未分类的项目
    structure.forEach(item => {
        let isCategorized = false;
        
        if (item.type === 'directory') {
            const itemPath = item.name + '/';
            Object.values(validCategories).forEach(category => {
                // 安全检查：确保 category.directories 存在且是数组
                if (!category.directories || !Array.isArray(category.directories)) {
                    return;
                }
                if (category.directories.some(dir => 
                    dir === itemPath || 
                    itemPath.toLowerCase().includes(dir.toLowerCase().replace('/', '')) ||
                    dir.toLowerCase().replace('/', '').includes(item.name.toLowerCase())
                )) {
                    isCategorized = true;
                }
            });
        }
        
        if (!isCategorized) {
            console.log(`📄 未分类项目: ${item.name}`);
            uncategorized.push(item);
        }
    });
    
    // 如果有未分类的项目，添加到"其他"分类
    if (uncategorized.length > 0) {
        console.log(`📂 创建"其他模块"分类，包含 ${uncategorized.length} 个项目`);
        categorizedStructure.push({
            name: '其他模块',
            type: 'category',
            path: '',
            description: '未分类的模块和文件',
            color: '#7f8c8d',
            children: uncategorized
        });
    }
    
    console.log('🎯 分类完成，最终结构:', categorizedStructure);
    return categorizedStructure;
}

// 本地文件管理器功能
let selectedDirectoryHandle = null;
let currentLocalStructure = null;

// 选择本地文件夹（在统一对话框中使用）
async function selectLocalFolder() {
    try {
        // 检查浏览器支持
        if (!('showDirectoryPicker' in window)) {
            showNotification('您的浏览器不支持此功能，请使用 Chrome 86+ 或 Edge 86+', 'error');
            return;
        }
        
        // 显示文件夹选择器
        selectedDirectoryHandle = await window.showDirectoryPicker();
        
        // 显示选择的文件夹信息
        const folderInfo = document.getElementById('selectedFolderInfo');
        const folderName = document.getElementById('selectedFolderName');
        
        folderName.textContent = selectedDirectoryHandle.name;
        folderInfo.style.display = 'block';
        
        showNotification(`已选择文件夹: ${selectedDirectoryHandle.name}`, 'success');
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('选择文件夹失败:', error);
            showNotification('选择文件夹失败: ' + error.message, 'error');
        }
    }
}

// 加载本地目录结构并创建项目（合并功能）
async function loadAndCreateLocalProject() {
    if (!selectedDirectoryHandle) {
        showNotification('请先选择一个文件夹', 'warning');
        return;
    }
    
    try {
        showNotification('正在创建项目并读取目录结构...', 'info');
        
        // 1. 首先创建项目
        const projectData = {
            name: selectedDirectoryHandle.name,
            path: `[本地] ${selectedDirectoryHandle.name}`,
            description: '从本地文件夹创建的项目'
        };
        
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify(projectData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '创建项目失败');
        }
        
        const newProject = await response.json();
        projects.push(newProject);
        renderProjectList();
        
        // 2. 然后读取目录结构
        currentLocalStructure = await readDirectoryStructure(selectedDirectoryHandle);
        
        // 3. 读取并上传文件内容到服务器
        showNotification('正在上传文件内容到服务器...', 'info');
        const filesData = await readAllFileContents(selectedDirectoryHandle, currentLocalStructure);
        
        await uploadProjectFiles(newProject.id, filesData, currentLocalStructure);
        
        // 4. 保存结构到本地存储以便页面刷新后恢复
        localStorage.setItem(`localProject_${newProject.id}`, JSON.stringify(currentLocalStructure));
        
        // 5. 选择新项目并加载结构 - 使用selectProject函数确保状态正确同步
        console.log('🎯 创建完成，选择新项目:', newProject.name, '(ID:', newProject.id, ')');
        await selectProject(newProject.id);
        
        // 关闭模态框
        closeUnifiedProjectDialog();
        
        showNotification('项目创建成功，文件已上传到服务器！', 'success');
        
    } catch (error) {
        console.error('创建项目失败:', error);
        showNotification('创建项目失败: ' + error.message, 'error');
    }
}

// 原来的独立函数保留以兼容其他调用
async function showLocalFileManager() {
    showUnifiedProjectDialog();
    // 自动选择本地文件选项
    setTimeout(() => {
        selectProjectOption('local');
    }, 100);
}

// 关闭本地文件管理器（重定向到统一对话框）
function closeLocalFileManager() {
    closeUnifiedProjectDialog();
}

// 递归读取目录结构
async function readDirectoryStructure(directoryHandle, maxDepth = 5, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
        return [];
    }
    
    const items = [];
    
    try {
        for await (const entry of directoryHandle.values()) {
            if (entry.name.startsWith('.')) {
                continue; // 跳过隐藏文件/文件夹
            }
            
            if (entry.kind === 'directory') {
                // 跳过常见的构建目录
                if (['node_modules', 'build', 'dist', '.git', '.vscode'].includes(entry.name)) {
                    continue;
                }
                
                const children = await readDirectoryStructure(entry, maxDepth, currentDepth + 1);
                items.push({
                    name: entry.name,
                    type: 'directory',
                    path: entry.name,
                    children: children,
                    handle: entry
                });
            } else if (entry.kind === 'file') {
                const extension = getFileExtension(entry.name);
                items.push({
                    name: entry.name,
                    type: 'file',
                    path: entry.name,
                    extension: extension,
                    handle: entry
                });
            }
        }
    } catch (error) {
        console.error('读取目录失败:', error);
    }
    
    return items.sort((a, b) => {
        // 目录优先，然后按名称排序
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}

// 读取所有文件内容
async function readAllFileContents(directoryHandle, structure, basePath = '') {
    const files = [];
    let totalSize = 0;
    const maxFileSize = 50 * 1024 * 1024; // 50MB per file limit
    const maxTotalSize = 2 * 1024 * 1024 * 1024; // 2GB total limit
    
    for (const item of structure) {
        const fullPath = basePath ? `${basePath}/${item.name}` : item.name;
        
        if (item.type === 'file' && item.handle) {
            try {
                // 只读取文本文件且不超过大小限制
                if (isTextFileExtension(item.extension)) {
                    const file = await item.handle.getFile();
                    
                    // 跳过太大的文件
                    if (file.size > maxFileSize) {
                        console.log(`跳过大文件: ${fullPath} (${file.size} bytes)`);
                        continue;
                    }
                    
                    // 检查总大小限制
                    if (totalSize + file.size > maxTotalSize) {
                        console.log(`达到总大小限制，停止读取更多文件`);
                        break;
                    }
                    
                    const content = await file.text();
                    
                    files.push({
                        path: fullPath,
                        content: content,
                        size: file.size,
                        lastModified: file.lastModified
                    });
                    
                    totalSize += file.size;
                    
                    // 显示进度
                    if (files.length % 10 === 0) {
                        showNotification(`已读取 ${files.length} 个文件...`, 'info');
                    }
                }
            } catch (error) {
                console.warn(`读取文件失败 ${fullPath}:`, error);
            }
        } else if (item.type === 'directory' && item.children) {
            const childFiles = await readAllFileContents(directoryHandle, item.children, fullPath);
            files.push(...childFiles);
            
            // 重新计算总大小
            totalSize = files.reduce((sum, f) => sum + f.size, 0);
            if (totalSize > maxTotalSize) {
                break;
            }
        }
    }
    
    console.log(`读取完成: ${files.length} 个文件, 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    return files;
}

// 检查是否为文本文件扩展名
function isTextFileExtension(extension) {
    const textExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.css', '.html', '.xml', '.json', '.md', '.txt', '.sql', '.sh', '.bat', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.php', '.rb', '.go', '.rs', '.swift', '.kt'];
    return textExtensions.includes(extension.toLowerCase());
}

// 上传项目文件到服务器（分批上传）
async function uploadProjectFiles(projectId, files, structure) {
    try {
        const sessionToken = localStorage.getItem('authToken');
        const batchSize = 20; // 每批上传20个文件
        const batches = [];
        
        // 将文件分批
        for (let i = 0; i < files.length; i += batchSize) {
            batches.push(files.slice(i, i + batchSize));
        }
        
        console.log(`准备分 ${batches.length} 批上传 ${files.length} 个文件`);
        
        // 分批上传
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            showNotification(`上传批次 ${i + 1}/${batches.length} (${batch.length} 个文件)...`, 'info');
            
            const response = await fetch(`/api/projects/${projectId}/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({
                    files: batch,
                    structure: i === 0 ? structure : [], // 只在第一批时发送结构
                    isLastBatch: i === batches.length - 1
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `上传批次 ${i + 1} 失败`);
            }
            
            const result = await response.json();
            console.log(`批次 ${i + 1} 上传成功:`, result);
        }
        
        showNotification(`所有文件上传完成！`, 'success');
        return { success: true, totalFiles: files.length };
    } catch (error) {
        console.error('上传文件失败:', error);
        throw error;
    }
}

// 获取文件扩展名
function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
}

// 重写openFile函数以支持本地文件访问
async function openLocalFile(filePath, handle) {
    try {
        // 设置当前文件
        currentFile = filePath;
        
        // UI状态管理
        document.getElementById('welcomeMessage').style.display = 'none';
        document.getElementById('searchResults').style.display = 'none';
        
        // 显示加载状态
        const codeContent = document.getElementById('codeContent');
        codeContent.style.display = 'block';
        codeContent.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner"></i>
                正在加载文件...
            </div>
        `;

        // 读取文件内容
        const file = await handle.getFile();
        const content = await file.text();
        currentFileContent = content;

        // 更新文件路径显示
        document.getElementById('filePath').textContent = filePath;

        // 启用AI按钮
        const aiButtons = document.querySelectorAll('.ai-btn');
        aiButtons.forEach(btn => btn.disabled = false);

        // 渲染文件内容
        const fileData = {
            path: filePath,
            content: content,
            size: file.size,
            modified: file.lastModified,
            extension: getFileExtension(file.name)
        };
        
        renderFileContent(fileData);

    } catch (error) {
        console.error('加载本地文件失败:', error);
        document.getElementById('codeContent').innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                加载文件失败: ${error.message}
            </div>
        `;
    }
}

// 账户信息相关功能
function loadUserInfo() {
    try {
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        const userName = userInfo.username || '未知用户';
        
        // 更新用户名显示
        document.getElementById('userName').textContent = userName;
        
        // 检查AI配置状态
        checkUserAIStatus();
    } catch (error) {
        console.error('加载用户信息失败:', error);
        document.getElementById('userName').textContent = '加载失败';
    }
}

async function checkUserAIStatus() {
    try {
        const sessionToken = localStorage.getItem('authToken');
        if (!sessionToken) {
            document.getElementById('aiStatusText').textContent = '未登录';
            return;
        }

        const response = await fetch('/api/ai-config/status', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const statusElement = document.getElementById('aiStatusText');
            const statusIcon = document.querySelector('.ai-status i');
            
            // 重要：同步更新全局AI配置状态
            aiConfigured = data.configured;
            console.log('🔄 checkUserAIStatus更新aiConfigured为:', aiConfigured);
            
            if (data.configured && data.config) {
                const provider = data.config.provider || '未知服务';
                statusElement.textContent = `使用 ${provider}`;
                statusIcon.style.color = '#27ae60';
                statusIcon.className = 'fas fa-robot';
            } else {
                statusElement.textContent = 'AI未配置';
                statusIcon.style.color = '#e74c3c';
                statusIcon.className = 'fas fa-exclamation-triangle';
            }
        } else {
            document.getElementById('aiStatusText').textContent = '检查失败';
            document.querySelector('.ai-status i').style.color = '#666';
            // 如果请求失败，不改变aiConfigured状态
        }
    } catch (error) {
        console.error('检查AI配置状态失败:', error);
        document.getElementById('aiStatusText').textContent = '检查失败';
        // 如果发生错误，不改变aiConfigured状态
    }
}

function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    const isVisible = userMenu.style.display !== 'none';
    
    if (isVisible) {
        userMenu.style.display = 'none';
    } else {
        userMenu.style.display = 'block';
        // 点击其他地方时关闭菜单
        setTimeout(() => {
            document.addEventListener('click', closeUserMenuOnClickOutside, { once: true });
        }, 100);
    }
}

function closeUserMenuOnClickOutside(event) {
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.getElementById('userAvatarBtn');
    
    if (!userMenu.contains(event.target) && !userAvatar.contains(event.target)) {
        userMenu.style.display = 'none';
    }
}

function logout() {
    if (confirm('确定要登出吗？')) {
        // 清除本地存储
        localStorage.removeItem('authToken');
        localStorage.removeItem('user_info');
        localStorage.removeItem('aiConfig');
        
        // 跳转到登录页面
        window.location.href = '/login.html';
    }
}

// 文件上传处理函数
async function handleFileUpload(form) {
    const projectName = form.projectName.value.trim();
    const filesInput = form.files;
    const files = Array.from(filesInput.files);
    
    if (!projectName) {
        showNotification('请输入项目名称', 'error');
        return;
    }
    
    if (files.length === 0) {
        showNotification('请选择要上传的文件夹', 'error');
        return;
    }
    
    // 检查文件总大小
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    
    if (totalSize > maxSize) {
        showNotification(`文件总大小超过2GB限制，当前大小：${formatFileSize(totalSize)}`, 'error');
        return;
    }
    
    try {
        // 显示进度
        showUploadProgress(true);
        updateProgress(0, '正在创建项目...', 0, files.length, 0, totalSize);
        
        // 1. 首先创建项目
        const sessionToken = localStorage.getItem('authToken');
        const projectResponse = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                name: projectName,
                path: `uploaded/${projectName}` // 虚拟路径，表示上传的项目
            })
        });
        
        if (!projectResponse.ok) {
            const error = await projectResponse.json();
            throw new Error(error.error || '创建项目失败');
        }
        
        const newProject = await projectResponse.json();
        updateProgress(5, '项目创建成功，开始上传文件...', 0, files.length, 0, totalSize);
        
        // 2. 分批上传文件
        const batchSize = 10; // 每批上传10个文件
        let uploadedFiles = 0;
        let uploadedSize = 0;
        
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const batchData = [];
            
            // 读取当前批次的文件内容
            for (const file of batch) {
                try {
                    const content = await readFileAsText(file);
                    batchData.push({
                        path: file.webkitRelativePath || file.name,
                        content: content,
                        size: file.size,
                        lastModified: file.lastModified,
                        type: file.type
                    });
                } catch (readError) {
                    console.warn(`无法读取文件 ${file.name}:`, readError);
                    // 对于无法读取的文件，记录基本信息
                    batchData.push({
                        path: file.webkitRelativePath || file.name,
                        content: `[无法读取文件内容: ${readError.message}]`,
                        size: file.size,
                        lastModified: file.lastModified,
                        type: file.type
                    });
                }
            }
            
            // 上传当前批次
            const isLastBatch = i + batchSize >= files.length;
            
            let requestBody = {
                files: batchData,
                isLastBatch: isLastBatch
            };
            
            // 在最后一批添加项目结构信息
            if (isLastBatch) {
                const projectStructure = generateProjectStructure(files);
                requestBody.structure = projectStructure;
            }
            
            const uploadResponse = await fetch(`/api/projects/${newProject.id}/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!uploadResponse.ok) {
                const error = await uploadResponse.json();
                throw new Error(error.error || '上传文件失败');
            }
            
            // 更新进度
            uploadedFiles += batch.length;
            uploadedSize += batch.reduce((sum, file) => sum + file.size, 0);
            const progress = Math.round((uploadedFiles / files.length) * 95) + 5; // 5-100%
            
            updateProgress(
                progress, 
                `正在上传文件... 批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}`,
                uploadedFiles,
                files.length,
                uploadedSize,
                totalSize
            );
        }
        
        // 3. 完成上传
        updateProgress(100, '上传完成！', files.length, files.length, totalSize, totalSize);
        
        // 更新项目列表
        projects.push(newProject);
        renderProjectList();
        
        // 自动选择新项目
        selectProject(newProject.id);
        
        // 延迟关闭对话框
        setTimeout(() => {
            closeUnifiedProjectDialog();
            showNotification(`项目 "${projectName}" 上传成功！共上传 ${files.length} 个文件`, 'success');
        }, 1500);
        
    } catch (error) {
        console.error('文件上传失败:', error);
        showNotification('文件上传失败: ' + error.message, 'error');
        showUploadProgress(false);
    }
}

// 读取文件为文本
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            resolve(e.target.result);
        };
        
        reader.onerror = function() {
            reject(new Error('文件读取失败'));
        };
        
        // 根据文件类型选择读取方式
        if (isTextFile(file.name) || file.size < 1024 * 1024) { // 小于1MB的文件尝试作为文本读取
            reader.readAsText(file, 'UTF-8');
        } else {
            // 大文件或二进制文件存储基本信息
            resolve(`[二进制文件: ${file.name}, 大小: ${formatFileSize(file.size)}]`);
        }
    });
}

// 检查是否为文本文件
function isTextFile(filename) {
    const textExtensions = [
        '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
        '.css', '.scss', '.sass', '.less', '.html', '.htm', '.xml', '.json', 
        '.md', '.txt', '.sql', '.sh', '.bat', '.yml', '.yaml', '.toml', '.ini', 
        '.cfg', '.conf', '.log', '.csv', '.php', '.rb', '.go', '.rs', '.kt',
        '.swift', '.m', '.mm', '.vue', '.svelte', '.dockerfile', '.gitignore'
    ];
    
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return textExtensions.includes(ext);
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 生成项目结构
function generateProjectStructure(files) {
    const structure = [];
    const dirMap = new Map();
    
    // 检测是否所有文件都有相同的根目录前缀
    let commonRootPrefix = null;
    if (files.length > 0) {
        const allPaths = files.map(file => file.webkitRelativePath || file.name);
        const firstPath = allPaths[0];
        
        // 检查是否有webkitRelativePath（表示是文件夹上传）
        if (firstPath.includes('/')) {
            const firstParts = firstPath.split('/');
            const potentialRoot = firstParts[0];
            
            // 检查是否所有文件都以同样的根目录开始
            const allHaveSameRoot = allPaths.every(path => {
                const parts = path.split('/');
                return parts.length > 1 && parts[0] === potentialRoot;
            });
            
            if (allHaveSameRoot) {
                commonRootPrefix = potentialRoot;
                console.log('检测到公共根目录:', commonRootPrefix, '将跳过显示');
            }
        }
    }
    
    // 从文件列表生成目录结构
    for (const file of files) {
        const filePath = file.webkitRelativePath || file.name;
        let parts = filePath.split('/');
        
        // 如果检测到公共根目录，跳过它
        if (commonRootPrefix && parts.length > 1 && parts[0] === commonRootPrefix) {
            parts = parts.slice(1); // 移除根目录部分
        }
        
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
                    extension: getFileExtension(part),
                    size: file.size
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

// 获取文件扩展名
function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
}

// 显示/隐藏上传进度
function showUploadProgress(show) {
    const progressDiv = document.getElementById('uploadProgress');
    if (progressDiv) {
        progressDiv.style.display = show ? 'block' : 'none';
    }
}

// 更新上传进度
function updateProgress(percent, text, uploadedFiles, totalFiles, uploadedSize, totalSize) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');
    const uploadedFilesSpan = document.getElementById('uploadedFiles');
    const totalFilesSpan = document.getElementById('totalFiles');
    const uploadedSizeSpan = document.getElementById('uploadedSize');
    const totalSizeSpan = document.getElementById('totalSize');
    
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressText) progressText.textContent = text;
    if (progressPercent) progressPercent.textContent = percent + '%';
    if (uploadedFilesSpan) uploadedFilesSpan.textContent = uploadedFiles;
    if (totalFilesSpan) totalFilesSpan.textContent = totalFiles;
    if (uploadedSizeSpan) uploadedSizeSpan.textContent = formatFileSize(uploadedSize);
    if (totalSizeSpan) totalSizeSpan.textContent = formatFileSize(totalSize);
}

// 设置项目管理器拖动功能
function setupProjectManagerDrag() {
    const projectManager = document.getElementById('projectManager');
    const projectHeader = document.getElementById('projectHeader');
    
    if (!projectManager || !projectHeader) return;
    
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    
    // 监听拖动开始
    projectHeader.addEventListener('mousedown', function(e) {
        // 只有点击拖动手柄区域才能拖动
        if (e.target === projectHeader || e.target.tagName === 'H3' || e.target.className.includes('fa-folder-open')) {
            isDragging = true;
            projectManager.classList.add('dragging');
            
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = projectManager.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            // 设置为绝对定位
            projectManager.style.position = 'fixed';
            projectManager.style.left = initialLeft + 'px';
            projectManager.style.top = initialTop + 'px';
            projectManager.style.width = rect.width + 'px';
            projectManager.style.zIndex = '1000';
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
        }
    });
    
    function handleMouseMove(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newLeft = initialLeft + deltaX;
        const newTop = initialTop + deltaY;
        
        // 限制在视窗范围内
        const maxLeft = window.innerWidth - projectManager.offsetWidth;
        const maxTop = window.innerHeight - projectManager.offsetHeight;
        
        const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
        const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
        
        projectManager.style.left = constrainedLeft + 'px';
        projectManager.style.top = constrainedTop + 'px';
    }
    
    function handleMouseUp() {
        if (!isDragging) return;
        
        isDragging = false;
        projectManager.classList.remove('dragging');
        
        // 保存位置到localStorage
        const rect = projectManager.getBoundingClientRect();
        localStorage.setItem('projectManagerPosition', JSON.stringify({
            left: rect.left,
            top: rect.top
        }));
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
    
    // 恢复保存的位置
    const savedPosition = localStorage.getItem('projectManagerPosition');
    if (savedPosition) {
        try {
            const position = JSON.parse(savedPosition);
            const rect = projectManager.getBoundingClientRect();
            
            // 确保位置在视窗范围内
            const maxLeft = window.innerWidth - rect.width;
            const maxTop = window.innerHeight - rect.height;
            
            const constrainedLeft = Math.max(0, Math.min(position.left, maxLeft));
            const constrainedTop = Math.max(0, Math.min(position.top, maxTop));
            
            projectManager.style.position = 'fixed';
            projectManager.style.left = constrainedLeft + 'px';
            projectManager.style.top = constrainedTop + 'px';
            projectManager.style.width = rect.width + 'px';
            projectManager.style.zIndex = '1000';
        } catch (e) {
            console.warn('恢复项目管理器位置失败:', e);
        }
    }
}

// 设置模态框拖动功能
function setupModalDragFunctionality() {
    // 为所有模态框添加拖动功能
    const modals = ['unifiedProjectModal', 'aiConfigModal', 'renameProjectModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        const modalContent = modal.querySelector('.modal-content');
        const modalHeader = modal.querySelector('.modal-header');
        
        if (!modalContent || !modalHeader) return;
        
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        modalHeader.addEventListener('mousedown', function(e) {
            // 只有点击标题栏才能拖动，避免点击按钮时触发拖动
            if (e.target.closest('.close-modal') || e.target.closest('button')) {
                return;
            }
            
            isDragging = true;
            modalContent.style.userSelect = 'none';
            modalContent.classList.add('dragging');
            
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = modalContent.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            // 确保模态框可以拖动
            modalContent.style.position = 'fixed';
            modalContent.style.left = initialLeft + 'px';
            modalContent.style.top = initialTop + 'px';
            modalContent.style.transform = 'none';
            modalContent.style.zIndex = '1001';
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
        });
        
        function handleMouseMove(e) {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;
            
            // 限制在视窗范围内
            const modalWidth = modalContent.offsetWidth;
            const modalHeight = modalContent.offsetHeight;
            
            newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - modalWidth - 10));
            newTop = Math.max(10, Math.min(newTop, window.innerHeight - modalHeight - 10));
            
            modalContent.style.left = newLeft + 'px';
            modalContent.style.top = newTop + 'px';
        }
        
        function handleMouseUp() {
            if (!isDragging) return;
            
            isDragging = false;
            modalContent.style.userSelect = '';
            modalContent.classList.remove('dragging');
            
            // 保存位置到localStorage
            const rect = modalContent.getBoundingClientRect();
            localStorage.setItem(`${modalId}Position`, JSON.stringify({
                left: rect.left,
                top: rect.top
            }));
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
        
        // 恢复保存的位置（当模态框显示时调用）
        modal.addEventListener('show', function() {
            const savedPosition = localStorage.getItem(`${modalId}Position`);
            if (savedPosition) {
                try {
                    const position = JSON.parse(savedPosition);
                    
                    // 确保位置在视窗范围内
                    const modalWidth = modalContent.offsetWidth;
                    const modalHeight = modalContent.offsetHeight;
                    
                    // 计算有效位置
                    const validLeft = Math.max(0, Math.min(position.left, window.innerWidth - modalWidth));
                    const validTop = Math.max(0, Math.min(position.top, window.innerHeight - modalHeight));
                    
                    modalContent.style.left = validLeft + 'px';
                    modalContent.style.top = validTop + 'px';
                } catch (e) {
                    console.warn('恢复模态框位置失败:', e);
                }
            }
        });
    });
}

// ======================== 项目拖拽排序功能 ========================

let draggedProjectIndex = null;
let draggedProjectElement = null;

// 设置项目拖拽和放置功能
function setupProjectDragAndDrop() {
    const projectItems = document.querySelectorAll('.project-item');
    const dragHandles = document.querySelectorAll('.project-drag-handle');
    
    console.log('设置拖拽事件 - 项目数量:', projectItems.length, '拖拽手柄数量:', dragHandles.length);
    
    // 为拖拽手柄设置拖拽开始事件
    dragHandles.forEach((handle, index) => {
        console.log(`设置拖拽手柄 ${index}:`, handle);
        handle.addEventListener('dragstart', handleDragStart);
        handle.addEventListener('dragend', handleDragEnd);
    });
    
    // 为项目元素设置拖拽目标事件
    projectItems.forEach((item, index) => {
        console.log(`设置项目拖拽目标 ${index}:`, item.dataset.projectIndex);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
    });
    
    console.log('拖拽事件设置完成');
}

// 开始拖拽
function handleDragStart(e) {
    console.log('拖拽开始事件触发，目标元素:', e.target, '当前目标:', e.currentTarget);
    
    // 获取拖拽手柄的父级项目元素
    const projectElement = e.currentTarget.closest('.project-item');
    if (!projectElement) {
        console.log('拖拽开始失败 - 找不到项目元素');
        return;
    }
    
    draggedProjectElement = projectElement;
    draggedProjectIndex = parseInt(projectElement.dataset.projectIndex);
    
    console.log('拖拽开始成功 - 项目索引:', draggedProjectIndex, '项目数据:', projectElement.dataset);
    
    // 设置拖拽效果
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', projectElement.outerHTML);
    
    // 添加拖拽样式
    projectElement.style.opacity = '0.5';
    projectElement.classList.add('dragging');
    
    console.log('开始拖拽项目:', projects[draggedProjectIndex]?.name, '索引:', draggedProjectIndex);
}

// 拖拽过程中
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

// 进入拖拽目标
function handleDragEnter(e) {
    e.preventDefault();
    const targetElement = e.currentTarget;
    
    if (targetElement !== draggedProjectElement) {
        targetElement.classList.add('drag-over');
    }
}

// 离开拖拽目标
function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

// 放置
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const targetElement = e.currentTarget;
    const targetIndex = parseInt(targetElement.dataset.projectIndex);
    
    console.log('拖拽放置 - 目标索引:', targetIndex, '拖拽索引:', draggedProjectIndex);
    
    targetElement.classList.remove('drag-over');
    
    if (draggedProjectIndex !== null && targetIndex !== null && targetIndex !== draggedProjectIndex) {
        console.log('执行排序操作...');
        
        // 重新排序项目数组
        const draggedProject = projects[draggedProjectIndex];
        console.log('拖拽的项目:', draggedProject?.name);
        
        // 创建新的项目数组
        const newProjects = [...projects];
        
        // 从原位置移除拖拽的项目
        newProjects.splice(draggedProjectIndex, 1);
        
        // 计算正确的插入位置
        let insertIndex = targetIndex;
        if (draggedProjectIndex < targetIndex) {
            // 往下拖动时，目标索引需要减1（因为已经移除了拖拽项目）
            insertIndex = targetIndex - 1;
        }
        
        // 插入到新位置
        newProjects.splice(insertIndex, 0, draggedProject);
        
        console.log('项目重新排序:', draggedProject.name, '从索引', draggedProjectIndex, '移动到', insertIndex);
        console.log('新的项目顺序:', newProjects.map((p, i) => `${i}: ${p.name}`));
        
        // 更新全局项目数组
        projects.splice(0, projects.length, ...newProjects);
        
        // 保存新的排序到本地存储
        saveProjectOrder();
        
        // 重新渲染项目列表
        renderProjectList();
        
        // 显示成功通知
        showNotification(`项目 "${draggedProject.name}" 已重新排序`, 'success');
    } else {
        console.log('排序条件不满足:', {
            draggedProjectIndex,
            targetIndex,
            same: targetIndex === draggedProjectIndex
        });
    }
    
    return false;
}

// 拖拽结束
function handleDragEnd(e) {
    // 获取拖拽手柄的父级项目元素
    const projectElement = e.currentTarget.closest('.project-item');
    if (projectElement) {
        // 清理拖拽状态
        projectElement.style.opacity = '1';
        projectElement.classList.remove('dragging');
    }
    
    // 清理所有拖拽相关的样式
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    draggedProjectIndex = null;
    draggedProjectElement = null;
}

// 保存项目排序到本地存储
function saveProjectOrder() {
    try {
        const projectOrder = projects.map(project => project.id);
        localStorage.setItem('projectOrder', JSON.stringify(projectOrder));
        console.log('项目排序已保存到本地存储:', projectOrder);
    } catch (error) {
        console.error('保存项目排序失败:', error);
    }
}

// 加载项目排序从本地存储
function loadProjectOrder() {
    try {
        const savedOrder = localStorage.getItem('projectOrder');
        if (savedOrder) {
            const projectOrder = JSON.parse(savedOrder);
            
            // 根据保存的顺序重新排序项目数组
            const reorderedProjects = [];
            
            // 首先添加按保存顺序排列的项目
            projectOrder.forEach(projectId => {
                const project = projects.find(p => p.id === projectId);
                if (project) {
                    reorderedProjects.push(project);
                }
            });
            
            // 然后添加不在保存顺序中的新项目
            projects.forEach(project => {
                if (!projectOrder.includes(project.id)) {
                    reorderedProjects.push(project);
                }
            });
            
            projects = reorderedProjects;
            console.log('已从本地存储恢复项目排序');
        }
    } catch (error) {
        console.error('加载项目排序失败:', error);
    }
}

// ============= 文件树调整大小功能 =============

// 设置文件树调整大小功能
function setupFileTreeResize() {
    const resizeHandle = document.getElementById('treeResizeHandle');
    const treeContainer = document.getElementById('fileTree');
    const treeWrapper = document.querySelector('.file-tree-wrapper');
    
    if (!resizeHandle || !treeContainer || !treeWrapper) {
        console.log('文件树调整大小元素未找到，跳过初始化');
        return;
    }

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    // 从localStorage加载保存的高度
    const savedHeight = localStorage.getItem('fileTreeHeight');
    if (savedHeight) {
        treeContainer.style.height = savedHeight + 'px';
        console.log('已从本地存储恢复文件树高度:', savedHeight);
    }

    // 鼠标按下开始拖拽
    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startY = e.clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(treeContainer).height, 10);
        
        treeWrapper.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        
        console.log('开始调整文件树大小:', startHeight);
        
        e.preventDefault();
    });

    // 鼠标移动时调整大小
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;

        const currentY = e.clientY;
        const deltaY = currentY - startY;
        const newHeight = startHeight + deltaY;
        
        // 限制最小和最大高度
        const minHeight = 400; // 200px * 2 = 400px
        const maxHeight = Math.min(1600, window.innerHeight * 0.6); // 800px * 2 = 1600px
        
        if (newHeight >= minHeight && newHeight <= maxHeight) {
            treeContainer.style.height = newHeight + 'px';
        }
        
        e.preventDefault();
    });

    // 鼠标松开结束拖拽
    document.addEventListener('mouseup', function(e) {
        if (isResizing) {
            isResizing = false;
            treeWrapper.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // 保存新的高度到localStorage
            const currentHeight = parseInt(treeContainer.style.height, 10);
            localStorage.setItem('fileTreeHeight', currentHeight);
            
            console.log('文件树大小调整完成:', currentHeight);
            showNotification(`文件树高度已调整为 ${currentHeight}px`, 'success');
        }
    });

    // 双击重置到默认高度
    resizeHandle.addEventListener('dblclick', function() {
        const defaultHeight = 800; // 400px * 2 = 800px
        treeContainer.style.height = defaultHeight + 'px';
        localStorage.setItem('fileTreeHeight', defaultHeight);
        
        showNotification('文件树高度已重置为默认值', 'success');
        console.log('文件树高度重置为默认值:', defaultHeight);
    });

    // 窗口大小改变时调整最大高度限制
    window.addEventListener('resize', function() {
        const currentHeight = parseInt(treeContainer.style.height, 10);
        const maxHeight = Math.min(1600, window.innerHeight * 0.6); // 800px * 2 = 1600px
        
        if (currentHeight > maxHeight) {
            treeContainer.style.height = maxHeight + 'px';
            localStorage.setItem('fileTreeHeight', maxHeight);
        }
    });

    console.log('文件树调整大小功能已初始化');
}

// 展开所有文件夹
function expandAllFolders() {
    const allFolders = document.querySelectorAll('.tree-item[data-type="directory"]');
    allFolders.forEach(folder => {
        const childrenDiv = folder.querySelector('.children');
        const icon = folder.querySelector('.folder-icon');
        
        if (childrenDiv && !childrenDiv.classList.contains('open')) {
            childrenDiv.classList.add('open');
            if (icon) {
                icon.classList.remove('fa-folder');
                icon.classList.add('fa-folder-open');
            }
        }
    });
    
    showNotification('已展开所有文件夹', 'success');
}

// 折叠所有文件夹
function collapseAllFolders() {
    const allFolders = document.querySelectorAll('.tree-item[data-type="directory"]');
    allFolders.forEach(folder => {
        const childrenDiv = folder.querySelector('.children');
        const icon = folder.querySelector('.folder-icon');
        
        if (childrenDiv && childrenDiv.classList.contains('open')) {
            childrenDiv.classList.remove('open');
            if (icon) {
                icon.classList.remove('fa-folder-open');
                icon.classList.add('fa-folder');
            }
        }
    });
    
    showNotification('已折叠所有文件夹', 'success');
}

// ============= 侧边栏宽度调整功能 =============

// 设置侧边栏宽度调整功能
function setupSidebarResize() {
    const resizeHandle = document.getElementById('sidebarResizeHandle');
    const sidebar = document.querySelector('.sidebar');
    
    if (!resizeHandle || !sidebar) {
        console.log('侧边栏调整大小元素未找到，跳过初始化');
        return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    // 从localStorage加载保存的宽度
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
        sidebar.style.width = savedWidth + 'px';
        console.log('已从本地存储恢复侧边栏宽度:', savedWidth);
    }

    // 鼠标按下开始拖拽
    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
        
        sidebar.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        console.log('开始调整侧边栏宽度:', startWidth);
        
        e.preventDefault();
    });

    // 鼠标移动时调整大小
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;

        const currentX = e.clientX;
        const deltaX = currentX - startX;
        const newWidth = startWidth + deltaX;
        
        // 限制最小和最大宽度
        const minWidth = 420; // 280px * 1.5 = 420px
        const maxWidth = Math.min(1200, window.innerWidth * 0.6); // 800px * 1.5 = 1200px
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            sidebar.style.width = newWidth + 'px';
        }
        
        e.preventDefault();
    });

    // 鼠标松开结束拖拽
    document.addEventListener('mouseup', function(e) {
        if (isResizing) {
            isResizing = false;
            sidebar.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // 保存新的宽度到localStorage
            const currentWidth = parseInt(sidebar.style.width, 10);
            localStorage.setItem('sidebarWidth', currentWidth);
            
            console.log('侧边栏宽度调整完成:', currentWidth);
            showNotification(`侧边栏宽度已调整为 ${currentWidth}px`, 'success');
        }
    });

    // 双击重置到默认宽度
    resizeHandle.addEventListener('dblclick', function() {
        const defaultWidth = 570; // 380px * 1.5 = 570px
        sidebar.style.width = defaultWidth + 'px';
        localStorage.setItem('sidebarWidth', defaultWidth);
        
        showNotification('侧边栏宽度已重置为默认值', 'success');
        console.log('侧边栏宽度重置为默认值:', defaultWidth);
    });

    // 窗口大小改变时调整最大宽度限制
    window.addEventListener('resize', function() {
        const currentWidth = parseInt(sidebar.style.width, 10);
        const maxWidth = Math.min(1200, window.innerWidth * 0.6); // 800px * 1.5 = 1200px
        
        if (currentWidth > maxWidth) {
            sidebar.style.width = maxWidth + 'px';
            localStorage.setItem('sidebarWidth', maxWidth);
        }
    });

    console.log('侧边栏宽度调整功能已初始化');
}

// 代码检查和运行功能
let currentCodeLanguage = 'javascript';
let currentCodeFileName = '';

// 语言检测函数
function detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const extensionMap = {
        'js': 'javascript',
        'jsx': 'javascript', 
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'cc': 'cpp',
        'cxx': 'cpp',
        'c': 'c',
        'go': 'go',
        'rs': 'rust',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'sh': 'bash',
        'bat': 'batch',
        'html': 'html',
        'css': 'css',
        'json': 'json'
    };
    
    return extensionMap[ext] || 'text';
}

// 更新语言指示器
function updateLanguageIndicator(filename) {
    currentCodeLanguage = detectLanguage(filename);
    currentCodeFileName = filename;
    
    const indicator = document.getElementById('languageIndicator');
    const fileDisplay = document.getElementById('fileNameDisplay');
    
    if (indicator) {
        indicator.textContent = currentCodeLanguage.charAt(0).toUpperCase() + currentCodeLanguage.slice(1);
    }
    
    if (fileDisplay) {
        fileDisplay.textContent = filename;
    }
}

// 显示代码工具栏
function showCodeToolbar() {
    const toolbar = document.getElementById('codeToolbar');
    if (toolbar) {
        toolbar.style.display = 'flex';
    }
}

// 隐藏代码工具栏
function hideCodeToolbar() {
    const toolbar = document.getElementById('codeToolbar');
    if (toolbar) {
        toolbar.style.display = 'none';
    }
}

// 代码检查功能
async function checkCode() {
    if (!currentFile || !currentFileContent) {
        showNotification('请先选择一个代码文件', 'warning');
        return;
    }
    
    // 获取当前显示的代码内容（可能是编辑过的）
    let code = currentFileContent;
    const editModeView = document.getElementById('editModeView');
    const codeEditor = document.getElementById('codeEditor');
    
    // 如果处于编辑模式，使用编辑器中的内容
    if (editModeView && editModeView.style.display !== 'none' && codeEditor) {
        code = codeEditor.value;
    }
    
    try {
        showNotification('正在检查代码...', 'info');
        
        const response = await fetch('/api/code/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                code: code,
                language: currentCodeLanguage,
                filename: currentCodeFileName
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayCodeIssues(result);
            showNotification('代码检查完成', 'success');
        } else {
            showNotification('代码检查失败: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('代码检查失败:', error);
        showNotification('代码检查失败: ' + error.message, 'error');
    }
}

// 显示代码检查结果
function displayCodeIssues(result) {
    const issuesPanel = document.getElementById('codeIssuesPanel');
    const issuesContent = document.getElementById('issuesContent');
    
    if (!issuesPanel || !issuesContent) return;
    
    issuesContent.innerHTML = '';
    
    const totalIssues = result.errors.length + result.warnings.length;
    
    if (totalIssues === 0) {
        issuesContent.innerHTML = `
            <div class="issue-item">
                <div class="issue-icon" style="color: #28a745;">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="issue-details">
                    <div class="issue-message">代码检查通过，未发现问题！</div>
                </div>
            </div>
        `;
    } else {
        // 显示错误
        result.errors.forEach(error => {
            const errorElement = document.createElement('div');
            errorElement.className = 'issue-item';
            errorElement.innerHTML = `
                <div class="issue-icon error">
                    <i class="fas fa-times-circle"></i>
                </div>
                <div class="issue-details">
                    <div class="issue-message">${error.message}</div>
                    <div class="issue-location">第 ${error.line} 行, 第 ${error.column} 列</div>
                </div>
            `;
            issuesContent.appendChild(errorElement);
        });
        
        // 显示警告
        result.warnings.forEach(warning => {
            const warningElement = document.createElement('div');
            warningElement.className = 'issue-item';
            warningElement.innerHTML = `
                <div class="issue-icon warning">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="issue-details">
                    <div class="issue-message">${warning.message}</div>
                    <div class="issue-location">第 ${warning.line} 行, 第 ${warning.column} 列</div>
                </div>
            `;
            issuesContent.appendChild(warningElement);
        });
    }
    
    // 更新标题显示问题数量
    const header = issuesPanel.querySelector('.issues-header span');
    if (header) {
        header.textContent = `代码检查结果 (${result.errors.length} 错误, ${result.warnings.length} 警告)`;
    }
    
    issuesPanel.style.display = 'block';
}

// 隐藏检查结果面板
function hideIssuesPanel() {
    const issuesPanel = document.getElementById('codeIssuesPanel');
    if (issuesPanel) {
        issuesPanel.style.display = 'none';
    }
}

// 代码运行功能
async function runCode() {
    if (!currentFile || !currentFileContent) {
        showNotification('请先选择一个代码文件', 'warning');
        return;
    }
    
    // 获取当前显示的代码内容（可能是编辑过的）
    let code = currentFileContent;
    const editModeView = document.getElementById('editModeView');
    const codeEditor = document.getElementById('codeEditor');
    
    // 如果处于编辑模式，使用编辑器中的内容
    if (editModeView && editModeView.style.display !== 'none' && codeEditor) {
        code = codeEditor.value;
    }
    
    // 检查是否支持运行该语言
    const supportedLanguages = ['javascript', 'python', 'html', 'c', 'cpp', 'java', 'go', 'csharp', 'rust'];
    if (!supportedLanguages.includes(currentCodeLanguage)) {
        showNotification(`暂不支持运行 ${currentCodeLanguage} 语言`, 'warning');
        return;
    }
    
    // 对于某些语言，可能需要输入
    let input = '';
    if (['python', 'c', 'cpp', 'java', 'go', 'csharp', 'rust'].includes(currentCodeLanguage)) {
        const languageNames = {
            'python': 'Python',
            'c': 'C',
            'cpp': 'C++',
            'java': 'Java',
            'go': 'Go',
            'csharp': 'C#',
            'rust': 'Rust'
        };
        input = await showInputDialog(`输入${languageNames[currentCodeLanguage]}程序运行时的输入数据（可选）：`);
        if (input === null) return; // 用户取消
    }
    
    try {
        showNotification('正在运行代码...', 'info');
        
        const response = await fetch('/api/code/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                code: code,
                language: currentCodeLanguage,
                filename: currentCodeFileName,
                input: input
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayCodeOutput(result);
            if (result.error) {
                showNotification('代码运行完成，但有错误', 'warning');
            } else {
                showNotification('代码运行完成', 'success');
            }
        } else {
            showNotification('代码运行失败: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('代码运行失败:', error);
        showNotification('代码运行失败: ' + error.message, 'error');
    }
}

// 显示代码运行结果
function displayCodeOutput(result) {
    const outputPanel = document.getElementById('codeOutputPanel');
    const outputContent = document.getElementById('outputContent');
    const executionTime = document.getElementById('executionTime');
    
    if (!outputPanel || !outputContent) return;
    
    // 更新执行时间
    if (executionTime) {
        executionTime.textContent = `执行时间: ${result.executionTime}ms`;
    }
    
    // 清空之前的内容
    outputContent.innerHTML = '';
    outputContent.className = 'output-content';
    
    if (result.error) {
        outputContent.className += ' output-error';
        outputContent.textContent = result.error;
    } else {
        outputContent.className += ' output-success';
        outputContent.textContent = result.output;
    }
    
    // 如果是HTML，显示预览链接
    if (result.previewUrl) {
        const previewLink = document.createElement('div');
        previewLink.innerHTML = `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #404040;">
                <a href="${result.previewUrl}" target="_blank" style="color: #51cf66; text-decoration: underline;">
                    📄 在新窗口中预览HTML
                </a>
            </div>
        `;
        outputContent.appendChild(previewLink);
    }
    
    outputPanel.style.display = 'block';
}

// 隐藏输出面板
function hideOutputPanel() {
    const outputPanel = document.getElementById('codeOutputPanel');
    if (outputPanel) {
        outputPanel.style.display = 'none';
    }
}

// 显示输入对话框
function showInputDialog(message) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'input-dialog';
        dialog.innerHTML = `
            <div class="input-dialog-content">
                <h3>${message}</h3>
                <textarea id="inputTextarea" placeholder="请输入数据..."></textarea>
                <div class="input-dialog-buttons">
                    <button class="cancel-btn" onclick="this.closest('.input-dialog').remove(); window.inputDialogResolve(null);">取消</button>
                    <button class="confirm-btn" onclick="window.inputDialogResolve(document.getElementById('inputTextarea').value); this.closest('.input-dialog').remove();">确定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        document.getElementById('inputTextarea').focus();
        
        // 设置全局回调函数
        window.inputDialogResolve = resolve;
        
        // ESC键取消
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
                resolve(null);
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    });
}

// 判断是否应该显示工具栏
function shouldShowToolbar(filename) {
    const codeExtensions = [
        'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'cc', 'cxx', 'c', 
        'go', 'rs', 'php', 'rb', 'sh', 'bat', 'html', 'css', 'json'
    ];
    const ext = filename.split('.').pop().toLowerCase();
    return codeExtensions.includes(ext);
}

// ============= 新增功能：创建空项目、添加文件/文件夹、重命名 =============

// 创建空项目
function createEmptyProject() {
    document.getElementById('createEmptyProjectModal').style.display = 'block';
}

// 关闭创建空项目模态框
function closeCreateEmptyProjectModal() {
    document.getElementById('createEmptyProjectModal').style.display = 'none';
    document.getElementById('createEmptyProjectForm').reset();
}

// 设置创建空项目表单
function setupCreateEmptyProjectForm() {
    const form = document.getElementById('createEmptyProjectForm');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const projectName = formData.get('projectName').trim();
            const projectDescription = formData.get('projectDescription').trim();
            
            if (!projectName) {
                showNotification('项目名称不能为空', 'error');
                return;
            }
            
            // 验证项目名称
            if (projectName.includes('/') || projectName.includes('\\') || projectName.includes('..')) {
                showNotification('项目名称包含非法字符', 'error');
                return;
            }
            
            try {
                console.log(`🆕 创建空项目: ${projectName}`);
                
                const sessionToken = localStorage.getItem('authToken');
                const response = await fetch('/api/projects', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        name: projectName,
                        path: `/empty-project/${projectName}`,
                        description: projectDescription || `${projectName} - 空项目`,
                        isEmpty: true,
                        projectType: 'empty' // 标记为空项目类型
                    })
                });
                
                if (response.ok) {
                    const newProject = await response.json();
                    console.log(`✅ 空项目创建成功:`, newProject);
                    
                    // 更新本地项目列表
                    projects.push(newProject);
                    renderProjectList();
                    closeCreateEmptyProjectModal();
                    
                    // 自动选择新创建的项目
                    await selectProject(newProject.id);
                    
                    // 确保显示文件操作区域
                    showFileOperations();
                    
                    showNotification(`空项目 "${projectName}" 创建成功！您现在可以添加文件和文件夹。`, 'success');
                } else {
                    const error = await response.json();
                    throw new Error(error.error || '创建项目失败');
                }
            } catch (error) {
                console.error('创建空项目失败:', error);
                showNotification('创建项目失败: ' + error.message, 'error');
            }
        });
    }
}

// 显示文件操作区域
function showFileOperations() {
    const fileOperations = document.getElementById('fileOperations');
    if (fileOperations) {
        fileOperations.style.display = 'flex';
    }
}

// 隐藏文件操作区域
function hideFileOperations() {
    const fileOperations = document.getElementById('fileOperations');
    if (fileOperations) {
        fileOperations.style.display = 'none';
    }
}

// 添加新文件
function addNewFile() {
    if (!currentProject) {
        showNotification('请先选择一个项目', 'error');
        return;
    }
    
    // 更新目标路径显示
    const targetPathElement = document.getElementById('fileTargetPath');
    if (targetPathElement) {
        targetPathElement.textContent = selectedDirectory || '根目录';
    }
    
    document.getElementById('addFileModal').style.display = 'block';
}

// 关闭添加文件模态框
function closeAddFileModal() {
    document.getElementById('addFileModal').style.display = 'none';
    document.getElementById('addFileForm').reset();
}

// 添加新文件夹
function addNewFolder() {
    if (!currentProject) {
        showNotification('请先选择一个项目', 'error');
        return;
    }
    
    // 更新目标路径显示
    const targetPathElement = document.getElementById('folderTargetPath');
    if (targetPathElement) {
        targetPathElement.textContent = selectedDirectory || '根目录';
    }
    
    document.getElementById('addFolderModal').style.display = 'block';
}

// 关闭添加文件夹模态框
function closeAddFolderModal() {
    document.getElementById('addFolderModal').style.display = 'none';
    document.getElementById('addFolderForm').reset();
}

// 设置添加文件表单
function setupAddFileForm() {
    const form = document.getElementById('addFileForm');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const fileName = formData.get('fileName').trim();
            const fileContent = formData.get('fileContent').trim();
            
            if (!fileName) {
                showNotification('文件名不能为空', 'error');
                return;
            }
            
            if (!currentProject) {
                showNotification('请先选择一个项目', 'error');
                return;
            }
            
            // 验证文件名格式
            if (fileName.includes('..') || fileName.startsWith('/') || fileName.includes('\\')) {
                showNotification('文件名包含非法字符', 'error');
                return;
            }
            
            // 构建完整的文件路径（考虑选中的目录）
            let fullFileName = fileName;
            if (selectedDirectory) {
                fullFileName = selectedDirectory + '/' + fileName;
                console.log(`在选中目录 "${selectedDirectory}" 下创建文件: ${fileName} -> ${fullFileName}`);
            } else {
                console.log(`在根目录下创建文件: ${fileName}`);
            }
            
            try {
                console.log(`📁 为项目 "${currentProject.name}" (ID: ${currentProject.id}) 创建文件: ${fullFileName}`);
                
                const sessionToken = localStorage.getItem('authToken');
                const response = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(fullFileName)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        content: fileContent || '',
                        projectId: currentProject.id // 明确指定项目ID
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log(`✅ 文件创建成功:`, result);
                    
                    closeAddFileModal();
                    
                    // 重新加载当前项目的结构
                    await loadProjectStructure(currentProject);
                    
                    // 显示同步选项
                    showLocalSyncOptions();
                    
                    const targetLocation = selectedDirectory ? `文件夹 "${selectedDirectory}"` : '根目录';
                    showNotification(`文件 "${fileName}" 已添加到项目 "${currentProject.name}" 的${targetLocation}`, 'success');
                } else {
                    const error = await response.json();
                    throw new Error(error.error || '创建文件失败');
                }
            } catch (error) {
                console.error('创建文件失败:', error);
                showNotification('创建文件失败: ' + error.message, 'error');
            }
        });
    }
}

// 设置添加文件夹表单
function setupAddFolderForm() {
    const form = document.getElementById('addFolderForm');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const folderName = formData.get('folderName').trim();
            
            if (!folderName) {
                showNotification('文件夹名称不能为空', 'error');
                return;
            }
            
            if (!currentProject) {
                showNotification('请先选择一个项目', 'error');
                return;
            }
            
            // 验证文件夹名格式
            if (folderName.includes('..') || folderName.startsWith('/') || folderName.includes('\\') || folderName.includes('.')) {
                showNotification('文件夹名称包含非法字符', 'error');
                return;
            }
            
            // 构建完整的文件夹路径（考虑选中的目录）
            let fullFolderName = folderName;
            if (selectedDirectory) {
                fullFolderName = selectedDirectory + '/' + folderName;
                console.log(`在选中目录 "${selectedDirectory}" 下创建文件夹: ${folderName} -> ${fullFolderName}`);
            } else {
                console.log(`在根目录下创建文件夹: ${folderName}`);
            }
            
            try {
                console.log(`📁 为项目 "${currentProject.name}" (ID: ${currentProject.id}) 创建文件夹: ${fullFolderName}`);
                
                // 通过创建一个占位文件来创建文件夹
                const placeholderFileName = `${fullFolderName}/.gitkeep`;
                const placeholderContent = `# 文件夹占位文件\n\n此文件用于保持 "${folderName}" 文件夹结构。\n当文件夹中有其他文件时，可以安全删除此文件。\n\n项目: ${currentProject.name}\n创建时间: ${new Date().toLocaleString()}`;
                
                const sessionToken = localStorage.getItem('authToken');
                const response = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(placeholderFileName)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        content: placeholderContent,
                        projectId: currentProject.id, // 明确指定项目ID
                        isPlaceholder: true // 标记为占位文件
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log(`✅ 文件夹创建成功:`, result);
                    
                    closeAddFolderModal();
                    
                    // 重新加载当前项目的结构
                    await loadProjectStructure(currentProject);
                    
                    // 显示同步选项
                    showLocalSyncOptions();
                    
                    const targetLocation = selectedDirectory ? `文件夹 "${selectedDirectory}"` : '根目录';
                    showNotification(`文件夹 "${folderName}" 已添加到项目 "${currentProject.name}" 的${targetLocation}`, 'success');
                } else {
                    const error = await response.json();
                    throw new Error(error.error || '创建文件夹失败');
                }
            } catch (error) {
                console.error('创建文件夹失败:', error);
                showNotification('创建文件夹失败: ' + error.message, 'error');
            }
        });
    }
}

// 重命名相关变量
let renameTarget = null;
let renameType = null;

// 显示重命名模态框
function showRenameModal(targetPath, targetType, currentName) {
    renameTarget = targetPath;
    renameType = targetType;
    
    const modal = document.getElementById('renameModal');
    const input = document.getElementById('renameInput');
    const help = document.getElementById('renameHelp');
    
    input.value = currentName;
    help.textContent = targetType === 'file' ? 
        '请输入新的文件名（包含扩展名）' : 
        '请输入新的文件夹名称';
    
    modal.style.display = 'block';
    input.focus();
    input.select();
}

// 关闭重命名模态框
function closeRenameModal() {
    document.getElementById('renameModal').style.display = 'none';
    document.getElementById('renameForm').reset();
    renameTarget = null;
    renameType = null;
}

// 设置重命名表单
function setupRenameForm() {
    const form = document.getElementById('renameForm');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const newName = formData.get('newName').trim();
            
            if (!newName) {
                showNotification('名称不能为空', 'error');
                return;
            }
            
            if (!currentProject || !renameTarget) {
                showNotification('重命名参数无效', 'error');
                return;
            }
            
            try {
                await performRename(renameTarget, newName, renameType);
                closeRenameModal();
                
                // 重新加载当前项目的结构
                await loadProjectStructure(currentProject);
                
                // 显示同步选项
                showLocalSyncOptions();
                
                showNotification(`${renameType === 'file' ? '文件' : '文件夹'}重命名成功！`, 'success');
            } catch (error) {
                console.error('重命名失败:', error);
                showNotification('重命名失败: ' + error.message, 'error');
            }
        });
    }
}

// 执行重命名操作
async function performRename(oldPath, newName, type) {
    if (!currentProject) {
        throw new Error('没有选择项目');
    }
    
    const sessionToken = localStorage.getItem('authToken');
    
    if (type === 'file') {
        // 计算新路径
        const pathParts = oldPath.split('/');
        pathParts[pathParts.length - 1] = newName;
        const newPath = pathParts.join('/');
        
        // 使用新的PATCH API重命名文件
        const response = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(oldPath)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ 
                newPath: newPath,
                operation: 'rename'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '重命名文件失败');
        }
        
        const result = await response.json();
        console.log(`文件重命名完成: ${oldPath} -> ${newPath}`);
        return result;
        
    } else if (type === 'folder') {
        // 文件夹重命名：找到所有以该路径为前缀的文件，批量重命名
        const pathParts = oldPath.split('/');
        pathParts[pathParts.length - 1] = newName;
        const newBasePath = pathParts.join('/');
        
        // 获取文件夹下所有文件
        const filesResponse = await fetch(`/api/projects/${currentProject.id}/files`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        
        if (!filesResponse.ok) {
            throw new Error('获取项目文件列表失败');
        }
        
        const filesData = await filesResponse.json();
        const filesToRename = filesData.files.filter(file => 
            file.path.startsWith(oldPath + '/') || file.path === oldPath
        );
        
        // 批量重命名文件
        const renamePromises = filesToRename.map(async (file) => {
            const relativePath = file.path.substring(oldPath.length);
            const newFilePath = newBasePath + relativePath;
            
            return fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(file.path)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ 
                    newPath: newFilePath,
                    operation: 'move'
                })
            });
        });
        
        await Promise.all(renamePromises);
        console.log(`文件夹重命名完成: ${oldPath} -> ${newBasePath}`);
        
        return { success: true, message: '文件夹重命名成功' };
    }
}

// 添加右键菜单功能到文件树项目
function addContextMenuToTreeItem(itemElement, item) {
    console.log('为项目添加右键菜单:', {
        path: item.path,
        type: item.type,
        name: item.name
    });
    
    itemElement.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation(); // 防止事件冒泡
        
        console.log('触发右键菜单事件:', {
            path: item.path,
            type: item.type,
            name: item.name,
            eventTarget: e.target
        });
        showContextMenu(e.pageX, e.pageY, item);
    });
}

// 显示根目录上下文菜单
function showRootContextMenu(x, y) {
    // 移除已存在的菜单
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="addNewFile(); this.parentElement.remove();">
            <i class="fas fa-file-plus"></i>
            新建文件
        </div>
        <div class="context-menu-item" onclick="addNewFolder(); this.parentElement.remove();">
            <i class="fas fa-folder-plus"></i>
            新建文件夹
        </div>
        <hr style="margin: 4px 0; border: none; border-top: 1px solid #eee;">
        <div class="context-menu-item ${clipboard.item ? '' : 'disabled'}" onclick="pasteItem(''); this.parentElement.remove();">
            <i class="fas fa-paste"></i>
            粘贴到根目录
        </div>
        ${clipboard.item ? `
        <div class="context-menu-item" onclick="clearClipboard(); this.parentElement.remove();">
            <i class="fas fa-times"></i>
            清空剪贴板
        </div>
        ` : ''}
    `;
    
    document.body.appendChild(menu);
    menu.style.display = 'block';
    
    // 点击其他地方关闭菜单
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }, 100);
    }, 100);
}

// 显示上下文菜单
function showContextMenu(x, y, item) {
    // 添加调试信息
    console.log('显示上下文菜单:', {
        path: item.path,
        type: item.type,
        name: item.name
    });
    
    // 移除已存在的菜单
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    if (item.type === 'file') {
        console.log('创建文件菜单');
        menu.innerHTML = `
            <div class="context-menu-item" onclick="openFile('${item.path}')">
                <i class="fas fa-file-alt"></i>
                打开文件
            </div>
            <div class="context-menu-item" onclick="addFileToAIChat('${item.path}')">
                <i class="fas fa-robot" style="color: #4CAF50;"></i>
                添加到AI对话
            </div>
            <hr style="margin: 4px 0; border: none; border-top: 1px solid #eee;">
            <div class="context-menu-item" onclick="copyItem('${item.path}', 'file')">
                <i class="fas fa-copy"></i>
                复制
            </div>
            <div class="context-menu-item" onclick="cutItem('${item.path}', 'file')">
                <i class="fas fa-cut"></i>
                剪切
            </div>
            <div class="context-menu-item ${clipboard.item ? '' : 'disabled'}" onclick="pasteItem('${item.path}')">
                <i class="fas fa-paste"></i>
                粘贴
            </div>
            <hr style="margin: 4px 0; border: none; border-top: 1px solid #eee;">
            <div class="context-menu-item" onclick="showRenameModal('${item.path}', 'file', '${item.name}')">
                <i class="fas fa-edit"></i>
                重命名
            </div>
            <div class="context-menu-item danger" onclick="deleteFile('${item.path}')">
                <i class="fas fa-trash"></i>
                删除文件
            </div>
        `;
    } else if (item.type === 'directory') {
        console.log('创建文件夹菜单');
        menu.innerHTML = `
            <div class="context-menu-item" onclick="copyItem('${item.path}', 'directory')">
                <i class="fas fa-copy"></i>
                复制文件夹
            </div>
            <div class="context-menu-item" onclick="cutItem('${item.path}', 'directory')">
                <i class="fas fa-cut"></i>
                剪切文件夹
            </div>
            <div class="context-menu-item ${clipboard.item ? '' : 'disabled'}" onclick="pasteItem('${item.path}')">
                <i class="fas fa-paste"></i>
                粘贴到此处
            </div>
            <hr style="margin: 4px 0; border: none; border-top: 1px solid #eee;">
            <div class="context-menu-item" onclick="showRenameModal('${item.path}', 'folder', '${item.name}')">
                <i class="fas fa-edit"></i>
                重命名文件夹
            </div>
            <div class="context-menu-item danger" onclick="deleteFolder('${item.path}')">
                <i class="fas fa-trash"></i>
                删除文件夹
            </div>
        `;
    } else {
        console.warn('未知的项目类型:', item.type);
    }
    
    document.body.appendChild(menu);
    menu.style.display = 'block';
    
    // 点击其他地方关闭菜单
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }, 100);
    }, 100);
}

// 删除文件
async function deleteFile(filePath) {
    if (!confirm(`确定要删除文件 "${filePath}" 吗？`)) {
        return;
    }
    
    if (!currentProject) {
        showNotification('没有选择项目', 'error');
        return;
    }
    
    try {
        showNotification('正在删除文件...', 'info');
        
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(filePath)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '删除文件失败');
        }
        
        const result = await response.json();
        
        // 如果删除的是当前打开的文件，清空显示区域
        if (currentFile === filePath) {
            currentFile = null;
            currentFileContent = null;
            
            // 安全地更新文件内容显示区域
            const fileContentElement = document.getElementById('file-content');
            const codeContentElement = document.getElementById('codeContent');
            
            if (fileContentElement) {
                fileContentElement.innerHTML = '<p style="text-align: center; color: #666; margin-top: 50px;">请选择一个文件查看内容</p>';
            }
            
            if (codeContentElement) {
                codeContentElement.style.display = 'none';
            }
            
            // 显示欢迎消息
            const welcomeElement = document.getElementById('welcomeMessage');
            if (welcomeElement) {
                welcomeElement.style.display = 'block';
            }
        }
        
        // 重新加载项目结构
        await loadProjectStructure(currentProject);
        
        showNotification('文件删除成功！', 'success');
        
    } catch (error) {
        console.error('删除文件失败:', error);
        showNotification('删除文件失败: ' + error.message, 'error');
    }
}

// 删除文件夹
async function deleteFolder(folderPath) {
    if (!confirm(`确定要删除文件夹 "${folderPath}" 及其所有内容吗？\n\n⚠️ 此操作不可撤销！`)) {
        return;
    }
    
    if (!currentProject) {
        showNotification('没有选择项目', 'error');
        return;
    }
    
    try {
        showNotification('正在删除文件夹...', 'info');
        
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch(`/api/projects/${currentProject.id}/folders/${encodeURIComponent(folderPath)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '删除文件夹失败');
        }
        
        const result = await response.json();
        
        // 如果删除的文件夹包含当前打开的文件，清空显示区域
        if (currentFile && currentFile.startsWith(folderPath + '/')) {
            currentFile = null;
            currentFileContent = null;
            document.getElementById('file-content').innerHTML = '<p style="text-align: center; color: #666; margin-top: 50px;">请选择一个文件查看内容</p>';
        }
        
        // 重新加载项目结构
        await loadProjectStructure(currentProject);
        
        showNotification(`文件夹删除成功！删除了 ${result.deletedFiles} 个文件`, 'success');
        
    } catch (error) {
        console.error('删除文件夹失败:', error);
        showNotification('删除文件夹失败: ' + error.message, 'error');
    }
}

// 显示本地同步选项
function showLocalSyncOptions() {
    const notification = document.createElement('div');
    notification.className = 'notification info';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #17a2b8;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        max-width: 400px;
        font-size: 14px;
        line-height: 1.4;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start;">
            <div style="margin-right: 12px; margin-top: 2px;">
                <i class="fas fa-sync-alt"></i>
            </div>
            <div>
                <strong>文件已更新！</strong><br>
                项目文件结构已在服务器端更新。<br>
                <small style="opacity: 0.9;">如需本地文件夹同步，请手动下载项目文件。</small>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 5秒后自动消失
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}
// 检查语言环境
async function checkLanguageEnvironment() {
    try {
        showNotification('正在检查语言环境...', 'info');
        
        const response = await fetch('/api/languages/environment', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayLanguageEnvironment(result);
            showNotification('语言环境检查完成', 'success');
        } else {
            throw new Error(result.error || '检查语言环境失败');
        }
        
    } catch (error) {
        console.error('检查语言环境失败:', error);
        showNotification('检查语言环境失败: ' + error.message, 'error');
    }
}

// 显示语言环境状态
function displayLanguageEnvironment(envData) {
    // 创建环境状态面板
    const panel = document.createElement('div');
    panel.className = 'language-environment-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #e1e8ed;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        padding: 25px;
        z-index: 10000;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        min-width: 500px;
    `;
    
    const installedLanguages = envData.supportedLanguages;
    const missingLanguages = envData.missingLanguages;
    
    panel.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f8f0;">
            <i class="fas fa-cogs" style="font-size: 24px; color: #28a745; margin-right: 12px;"></i>
            <h3 style="margin: 0; color: #333; font-size: 1.3em;">编程语言环境状态</h3>
        </div>
        
        ${installedLanguages.length > 0 ? `
            <div style="margin-bottom: 25px;">
                <h4 style="color: #28a745; margin-bottom: 12px; display: flex; align-items: center;">
                    <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
                    已安装的语言 (${installedLanguages.length})
                </h4>
                <div style="display: grid; gap: 8px;">
                    ${installedLanguages.map(lang => {
                        const langData = envData.languages[lang];
                        return `
                            <div style="display: flex; align-items: center; padding: 10px 15px; background: #f8fff8; border: 1px solid #d4edda; border-radius: 8px;">
                                <i class="fas fa-check-circle" style="color: #28a745; margin-right: 10px;"></i>
                                <div style="flex: 1;">
                                    <strong style="color: #155724;">${langData.name}</strong>
                                    <div style="font-size: 0.85em; color: #666; margin-top: 2px;">${langData.version}</div>
                                </div>
                                <span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold;">可用</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : ''}
        
        ${missingLanguages.length > 0 ? `
            <div style="margin-bottom: 25px;">
                <h4 style="color: #dc3545; margin-bottom: 12px; display: flex; align-items: center;">
                    <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                    未安装的语言 (${missingLanguages.length})
                </h4>
                <div style="display: grid; gap: 8px;">
                    ${missingLanguages.map(lang => {
                        const langData = envData.languages[lang];
                        return `
                            <div style="display: flex; align-items: flex-start; padding: 12px 15px; background: #fff5f5; border: 1px solid #f5c6cb; border-radius: 8px;">
                                <i class="fas fa-times-circle" style="color: #dc3545; margin-right: 10px; margin-top: 2px;"></i>
                                <div style="flex: 1;">
                                    <strong style="color: #721c24;">${langData.name}</strong>
                                    <div style="font-size: 0.8em; color: #666; margin-top: 4px; background: #f8f9fa; padding: 6px 8px; border-radius: 4px; border-left: 3px solid #6f42c1;">
                                        <i class="fas fa-terminal" style="margin-right: 5px; color: #6f42c1;"></i>
                                        ${langData.installCommand}
                                    </div>
                                </div>
                                <span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold;">未安装</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : ''}
        
        <div style="padding-top: 15px; border-top: 1px solid #eee;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="font-size: 0.85em; color: #666;">
                    <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
                    总共支持 ${Object.keys(envData.languages).length} 种编程语言
                </div>
                <button onclick="closeLanguageEnvironmentPanel()" 
                        style="padding: 8px 16px; border: 1px solid #6f42c1; border-radius: 6px; background: #6f42c1; color: white; cursor: pointer; font-size: 0.9em; transition: all 0.2s ease;">
                    <i class="fas fa-times" style="margin-right: 5px;"></i> 关闭
                </button>
            </div>
        </div>
    `;
    
    // 添加关闭面板的函数到全局作用域
    window.closeLanguageEnvironmentPanel = function() {
        if (panel.parentNode) {
            panel.style.transform = 'translate(-50%, -50%) scale(0.9)';
            panel.style.opacity = '0';
            setTimeout(() => {
                panel.parentNode.removeChild(panel);
                delete window.closeLanguageEnvironmentPanel;
            }, 200);
        }
    };
    
    // 添加到页面
    document.body.appendChild(panel);
    
    // 入场动画
    requestAnimationFrame(() => {
        panel.style.transform = 'translate(-50%, -50%) scale(1)';
        panel.style.opacity = '1';
    });
}

// 设置拖拽功能
function setupDragAndDrop() {
    // 全局拖拽结束事件
    document.addEventListener('dragend', function() {
        // 清理拖拽状态
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        // 清理根目录拖拽样式
        const fileTree = document.getElementById('fileTree');
        if (fileTree) {
            fileTree.classList.remove('drag-over-root');
        }
        draggedItem = null;
    });
    
    // 防止默认拖拽行为
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
    });
    
    // 为文件树区域添加右键菜单
    const fileTree = document.getElementById('fileTree');
    if (fileTree) {
        fileTree.addEventListener('contextmenu', function(e) {
            // 查找最近的树项目元素
            const treeItem = e.target.closest('.tree-item');
            
            console.log('文件树右键事件:', {
                target: e.target.tagName,
                targetClass: e.target.className,
                treeItem: treeItem ? 'found' : 'not found',
                treeItemPath: treeItem ? treeItem.getAttribute('data-path') : 'none'
            });
            
            // 如果点击的不是文件树项目，显示根目录菜单
            if (!treeItem) {
                e.preventDefault();
                console.log('显示根目录菜单');
                showRootContextMenu(e.pageX, e.pageY);
            }
            // 如果点击的是文件树项目，让项目自己的事件处理器处理
        });
        
        // 为根目录添加拖拽目标功能
        fileTree.addEventListener('dragover', function(e) {
            // 只有当拖拽目标不是文件树项目时才处理根目录拖拽
            if (!e.target.closest('.tree-item')) {
                e.preventDefault();
                if (draggedItem) {
                    fileTree.classList.add('drag-over-root');
                    e.dataTransfer.dropEffect = 'move';
                }
            }
        });
        
        fileTree.addEventListener('dragleave', function(e) {
            // 检查是否真正离开了文件树区域
            const rect = fileTree.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;
            
            // 如果鼠标位置在文件树区域外，或者relatedTarget不在文件树内，移除样式
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom || 
                (!e.relatedTarget || !fileTree.contains(e.relatedTarget))) {
                fileTree.classList.remove('drag-over-root');
            }
        });
        
        fileTree.addEventListener('drop', function(e) {
            // 只有当拖拽目标不是文件树项目时才处理根目录拖拽
            if (!e.target.closest('.tree-item')) {
                e.preventDefault();
                fileTree.classList.remove('drag-over-root');
                
                if (draggedItem) {
                    // 移动到根目录
                    moveItemToFolder(draggedItem, '');
                }
            }
        });
    }
}

// 为文件树项目添加拖拽功能
function addDragAndDropToTreeItem(itemElement, item) {
    // 使项目可拖拽
    itemElement.draggable = true;
    
    // 拖拽开始
    itemElement.addEventListener('dragstart', function(e) {
        e.stopPropagation(); // 防止事件冒泡
        draggedItem = item;
        itemElement.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.path);
    });
    
    // 拖拽结束
    itemElement.addEventListener('dragend', function(e) {
        itemElement.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        // 清除根目录的拖拽样式
        const fileTree = document.getElementById('fileTree');
        if (fileTree) {
            fileTree.classList.remove('drag-over-root');
        }
    });
    
    // 只有文件夹可以作为拖拽目标
    if (item.type === 'directory') {
        itemElement.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (draggedItem && draggedItem.path !== item.path) {
                // 只有当拖拽的是文件夹时，才需要检查是否移动到自己的子目录
                if (draggedItem.type === 'directory' && item.path.startsWith(draggedItem.path + '/')) {
                    // 不允许文件夹移动到自己的子目录
                    e.dataTransfer.dropEffect = 'none';
                    return;
                }
                itemElement.classList.add('drag-over');
                e.dataTransfer.dropEffect = 'move';
            }
        });
        
        itemElement.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // 只有当鼠标真正离开元素时才移除样式
            if (!itemElement.contains(e.relatedTarget)) {
                itemElement.classList.remove('drag-over');
            }
        });
        
        itemElement.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            itemElement.classList.remove('drag-over');
            
            if (draggedItem && draggedItem.path !== item.path) {
                // 检查是否将文件拖拽到它当前所在的文件夹
                const draggedParentPath = draggedItem.path.includes('/') 
                    ? draggedItem.path.substring(0, draggedItem.path.lastIndexOf('/'))
                    : '';
                
                if (draggedParentPath === item.path) {
                    showNotification(`文件已在 ${item.path || '根目录'} 文件夹中`, 'info');
                    return;
                }
                
                // 只有当拖拽的是文件夹时，才需要检查是否移动到自己的子目录
                if (draggedItem.type === 'directory' && item.path.startsWith(draggedItem.path + '/')) {
                    showNotification('不能将文件夹移动到自己的子目录', 'error');
                    return;
                }
                // 执行移动操作
                moveItemToFolder(draggedItem, item.path);
            }
        });
    }
}

// 移动项目到文件夹
async function moveItemToFolder(item, targetFolderPath) {
    if (!currentProject) {
        showNotification('没有选择项目', 'error');
        return;
    }
    
    try {
        const itemName = item.path.split('/').pop();
        // 如果目标路径为空，则移动到根目录
        const newPath = targetFolderPath ? targetFolderPath + '/' + itemName : itemName;
        
        // 检查是否是无意义的移动（目标路径和源路径相同）
        if (item.path === newPath) {
            // 根据项目类型和位置给出更准确的提示
            if (item.type === 'directory') {
                if (targetFolderPath === '') {
                    showNotification(`文件夹 "${item.name}" 已在根目录`, 'info');
                } else {
                    showNotification(`文件夹 "${item.name}" 已在 "${targetFolderPath}" 中`, 'info');
                }
            } else {
                if (targetFolderPath === '') {
                    showNotification(`文件 "${item.name}" 已在根目录`, 'info');
                } else {
                    showNotification(`文件 "${item.name}" 已在 "${targetFolderPath}" 中`, 'info');
                }
            }
            return;
        }
        
        // 检查是否是将文件夹移动到自己内部
        if (item.type === 'directory' && newPath.startsWith(item.path + '/')) {
            showNotification('不能将文件夹移动到自己内部', 'error');
            return;
        }
        
        if (item.type === 'file') {
            // 移动文件
            const sessionToken = localStorage.getItem('authToken');
            const response = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(item.path)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ 
                    newPath: newPath,
                    operation: 'move'
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '移动文件失败');
            }
            
            const targetLocation = targetFolderPath || '根目录';
            showNotification(`文件已移动到 ${targetLocation}`, 'success');
        } else if (item.type === 'directory') {
            // 移动文件夹（需要移动文件夹内所有文件）
            await moveFolderContents(item.path, newPath);
            const targetLocation = targetFolderPath || '根目录';
            showNotification(`文件夹已移动到 ${targetLocation}`, 'success');
        }
        
        // 重新加载项目结构
        await loadProjectStructure(currentProject);
        
    } catch (error) {
        console.error('移动失败:', error);
        showNotification('移动失败: ' + error.message, 'error');
    }
}

// 复制项目
function copyItem(itemPath, itemType) {
    clipboard.item = { path: itemPath, type: itemType };
    clipboard.operation = 'copy';
    
    showNotification(`已复制 ${itemType === 'file' ? '文件' : '文件夹'}: ${itemPath}`, 'info');
    updateClipboardStatus();
}

// 剪切项目
function cutItem(itemPath, itemType) {
    clipboard.item = { path: itemPath, type: itemType };
    clipboard.operation = 'cut';
    
    showNotification(`已剪切 ${itemType === 'file' ? '文件' : '文件夹'}: ${itemPath}`, 'info');
    updateClipboardStatus();
    
    // 添加剪切视觉效果
    const treeItems = document.querySelectorAll('.tree-item');
    treeItems.forEach(item => {
        const itemPathAttr = item.getAttribute('data-path');
        if (itemPathAttr === itemPath) {
            item.classList.add('clipboard-cut');
        }
    });
}

// 粘贴项目
async function pasteItem(targetPath) {
    if (!clipboard.item) {
        showNotification('剪贴板为空', 'warning');
        return;
    }
    
    if (!currentProject) {
        showNotification('没有选择项目', 'error');
        return;
    }
    
    try {
        const itemName = clipboard.item.path.split('/').pop();
        const newPath = targetPath ? targetPath + '/' + itemName : itemName;
        
        if (clipboard.operation === 'copy') {
            // 复制操作
            if (clipboard.item.type === 'file') {
                await copyFile(clipboard.item.path, newPath);
            } else {
                await copyFolder(clipboard.item.path, newPath);
            }
            showNotification(`已复制到 ${targetPath || '根目录'}`, 'success');
        } else if (clipboard.operation === 'cut') {
            // 剪切操作（移动）
            if (clipboard.item.type === 'file') {
                await moveFile(clipboard.item.path, newPath);
            } else {
                await moveFolderContents(clipboard.item.path, newPath);
            }
            showNotification(`已移动到 ${targetPath || '根目录'}`, 'success');
            
            // 清空剪贴板
            clearClipboard();
        }
        
        // 重新加载项目结构
        await loadProjectStructure(currentProject);
        
    } catch (error) {
        console.error('粘贴失败:', error);
        showNotification('粘贴失败: ' + error.message, 'error');
    }
}

// 复制文件
async function copyFile(sourcePath, targetPath) {
    const sessionToken = localStorage.getItem('authToken');
    
    // 获取源文件内容
    const getResponse = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(sourcePath)}`, {
        headers: {
            'Authorization': `Bearer ${sessionToken}`
        }
    });
    
    if (!getResponse.ok) {
        throw new Error('获取源文件内容失败');
    }
    
    const fileData = await getResponse.json();
    
    // 创建新文件
    const putResponse = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(targetPath)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
            content: fileData.content,
            projectId: currentProject.id
        })
    });
    
    if (!putResponse.ok) {
        const errorData = await putResponse.json();
        throw new Error(errorData.error || '创建目标文件失败');
    }
}

// 移动文件
async function moveFile(sourcePath, targetPath) {
    const sessionToken = localStorage.getItem('authToken');
    
    const response = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(sourcePath)}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ 
            newPath: targetPath,
            operation: 'move'
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '移动文件失败');
    }
}

// 复制文件夹
async function copyFolder(sourcePath, targetPath) {
    // 获取项目结构
    const sessionToken = localStorage.getItem('authToken');
    const response = await fetch(`/api/projects/${currentProject.id}/files`, {
        headers: {
            'Authorization': `Bearer ${sessionToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error('获取项目结构失败');
    }
    
    const data = await response.json();
    const files = data.files || [];
    
    // 找到所有在源文件夹中的文件
    const sourceFiles = files.filter(file => 
        file.path.startsWith(sourcePath + '/') || file.path === sourcePath
    );
    
    // 复制每个文件
    for (const file of sourceFiles) {
        const relativePath = file.path.substring(sourcePath.length);
        const newFilePath = targetPath + relativePath;
        await copyFile(file.path, newFilePath);
    }
}

// 移动文件夹内容
async function moveFolderContents(sourcePath, targetPath) {
    // 获取项目结构
    const sessionToken = localStorage.getItem('authToken');
    const response = await fetch(`/api/projects/${currentProject.id}/files`, {
        headers: {
            'Authorization': `Bearer ${sessionToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error('获取项目结构失败');
    }
    
    const data = await response.json();
    const files = data.files || [];
    
    // 找到所有在源文件夹中的文件
    const sourceFiles = files.filter(file => 
        file.path.startsWith(sourcePath + '/') || file.path === sourcePath
    );
    
    // 移动每个文件
    for (const file of sourceFiles) {
        const relativePath = file.path.substring(sourcePath.length);
        const newFilePath = targetPath + relativePath;
        await moveFile(file.path, newFilePath);
    }
}

// 更新剪贴板状态显示
function updateClipboardStatus() {
    // 清除所有剪贴板相关的样式
    document.querySelectorAll('.clipboard-cut, .clipboard-copy').forEach(el => {
        el.classList.remove('clipboard-cut', 'clipboard-copy');
    });
    
    // 更新剪贴板状态指示器
    updateClipboardIndicator();
    
    if (clipboard.item) {
        const treeItems = document.querySelectorAll('.tree-item');
        treeItems.forEach(item => {
            const itemPath = item.getAttribute('data-path');
            if (itemPath === clipboard.item.path) {
                item.classList.add(`clipboard-${clipboard.operation}`);
            }
        });
    }
}

// 更新剪贴板指示器
function updateClipboardIndicator() {
    // 移除现有的指示器
    const existingIndicator = document.querySelector('.clipboard-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // 如果有剪贴板内容，创建指示器
    if (clipboard.item) {
        const indicator = document.createElement('div');
        indicator.className = 'clipboard-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${clipboard.operation === 'cut' ? '#dc3545' : '#28a745'};
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        `;
        
        const operationIcon = clipboard.operation === 'cut' ? 'fa-cut' : 'fa-copy';
        const operationText = clipboard.operation === 'cut' ? '剪切' : '复制';
        const itemName = clipboard.item.path.split('/').pop();
        const itemIcon = clipboard.item.type === 'file' ? 'fa-file' : 'fa-folder';
        
        indicator.innerHTML = `
            <i class="fas ${operationIcon}"></i>
            <span>${operationText}: </span>
            <i class="fas ${itemIcon}"></i>
            <span>${itemName}</span>
            <button onclick="clearClipboard()" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 0;
                margin-left: 8px;
                font-size: 12px;
            ">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(indicator);
        
        // 3秒后自动淡出
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.style.opacity = '0.7';
            }
        }, 3000);
    }
}

// 清空剪贴板
function clearClipboard() {
    clipboard.item = null;
    clipboard.operation = null;
    
    document.querySelectorAll('.clipboard-cut, .clipboard-copy').forEach(el => {
        el.classList.remove('clipboard-cut', 'clipboard-copy');
    });
    
    // 移除剪贴板指示器
    const indicator = document.querySelector('.clipboard-indicator');
    if (indicator) {
        indicator.style.transform = 'translateX(100%)';
        indicator.style.opacity = '0';
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 300);
    }
    
    showNotification('剪贴板已清空', 'info');
}

// 设置键盘快捷键
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // 检查是否在输入框中
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
            return;
        }
        
        // Ctrl+C: 复制
        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            const selectedItem = getSelectedTreeItem();
            if (selectedItem) {
                copyItem(selectedItem.path, selectedItem.type);
            }
        }
        
        // Ctrl+X: 剪切
        if (e.ctrlKey && e.key === 'x') {
            e.preventDefault();
            const selectedItem = getSelectedTreeItem();
            if (selectedItem) {
                cutItem(selectedItem.path, selectedItem.type);
            }
        }
        
        // Ctrl+V: 粘贴
        if (e.ctrlKey && e.key === 'v') {
            e.preventDefault();
            const selectedItem = getSelectedTreeItem();
            const targetPath = selectedItem && selectedItem.type === 'directory' ? selectedItem.path : '';
            pasteItem(targetPath);
        }
        
        // Delete: 删除
        if (e.key === 'Delete') {
            e.preventDefault();
            const selectedItem = getSelectedTreeItem();
            if (selectedItem) {
                if (selectedItem.type === 'file') {
                    deleteFile(selectedItem.path);
                } else {
                    deleteFolder(selectedItem.path);
                }
            }
        }
        
        // F1: 显示快捷键帮助
        if (e.key === 'F1') {
            e.preventDefault();
            showKeyboardShortcutsHelp();
        }
        
        // Escape: 清空剪贴板或关闭帮助
        if (e.key === 'Escape') {
            const helpDialog = document.querySelector('.shortcuts-help');
            if (helpDialog) {
                helpDialog.remove();
            } else if (clipboard.item) {
                clearClipboard();
            }
        }
    });
}

// 显示键盘快捷键帮助
function showKeyboardShortcutsHelp() {
    // 移除现有的帮助对话框
    const existingHelp = document.querySelector('.shortcuts-help');
    if (existingHelp) {
        existingHelp.remove();
        return;
    }
    
    const helpDialog = document.createElement('div');
    helpDialog.className = 'shortcuts-help';
    helpDialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        animation: fadeIn 0.3s ease;
    `;
    
    helpDialog.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            transform: scale(0.9);
            animation: scaleIn 0.3s ease forwards;
        ">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px;">
                <h3 style="margin: 0; color: #2c3e50; display: flex; align-items: center;">
                    <i class="fas fa-keyboard" style="margin-right: 10px; color: #3498db;"></i>
                    键盘快捷键
                </h3>
                <button onclick="this.closest('.shortcuts-help').remove()" style="
                    background: none;
                    border: none;
                    font-size: 20px;
                    color: #999;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="display: grid; gap: 20px;">
                <div>
                    <h4 style="color: #34495e; margin: 0 0 12px 0; display: flex; align-items: center;">
                        <i class="fas fa-copy" style="margin-right: 8px; color: #27ae60; width: 16px;"></i>
                        剪贴板操作
                    </h4>
                    <div style="display: grid; gap: 8px; margin-left: 24px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span>复制选中项</span>
                            <kbd style="background: #f8f9fa; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Ctrl + C</kbd>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span>剪切选中项</span>
                            <kbd style="background: #f8f9fa; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Ctrl + X</kbd>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span>粘贴到选中目录</span>
                            <kbd style="background: #f8f9fa; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Ctrl + V</kbd>
                        </div>
                    </div>
                </div>
                
                <div>
                    <h4 style="color: #34495e; margin: 0 0 12px 0; display: flex; align-items: center;">
                        <i class="fas fa-trash" style="margin-right: 8px; color: #e74c3c; width: 16px;"></i>
                        删除操作
                    </h4>
                    <div style="margin-left: 24px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span>删除选中项</span>
                            <kbd style="background: #f8f9fa; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Delete</kbd>
                        </div>
                    </div>
                </div>
                
                <div>
                    <h4 style="color: #34495e; margin: 0 0 12px 0; display: flex; align-items: center;">
                        <i class="fas fa-mouse" style="margin-right: 8px; color: #9b59b6; width: 16px;"></i>
                        鼠标操作
                    </h4>
                    <div style="display: grid; gap: 8px; margin-left: 24px;">
                        <div>拖拽文件/文件夹到目标目录</div>
                        <div>右键点击显示上下文菜单</div>
                        <div>右键点击空白区域显示根目录菜单</div>
                    </div>
                </div>
                
                <div>
                    <h4 style="color: #34495e; margin: 0 0 12px 0; display: flex; align-items: center;">
                        <i class="fas fa-tools" style="margin-right: 8px; color: #f39c12; width: 16px;"></i>
                        其他快捷键
                    </h4>
                    <div style="display: grid; gap: 8px; margin-left: 24px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span>显示/隐藏此帮助</span>
                            <kbd style="background: #f8f9fa; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; font-size: 12px;">F1</kbd>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span>清空剪贴板/关闭帮助</span>
                            <kbd style="background: #f8f9fa; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Escape</kbd>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee;">
                <small style="color: #666;">
                    <i class="fas fa-lightbulb" style="margin-right: 5px; color: #f39c12;"></i>
                    提示：选中文件夹后创建的新文件/文件夹会自动放在该文件夹内
                </small>
            </div>
        </div>
    `;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes scaleIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(helpDialog);
    
    // 点击背景关闭
    helpDialog.addEventListener('click', function(e) {
        if (e.target === helpDialog) {
            helpDialog.remove();
        }
    });
}

// 获取当前选中的文件树项目
function getSelectedTreeItem() {
    const selectedElement = document.querySelector('.tree-item.selected');
    if (!selectedElement) return null;
    
    const path = selectedElement.getAttribute('data-path');
    const isDirectory = selectedElement.classList.contains('directory');
    
    return {
        path: path,
        type: isDirectory ? 'directory' : 'file',
        name: path.split('/').pop()
    };
}

// ============ AI对话功能 ============

// 对话相关变量
let currentChatSession = null;
let chatMessages = [];
let chatHistoryList = [];

// 生成对话会话ID
function generateChatSessionId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 打开AI对话面板
function openAIChatPanel() {
    // 保存当前滚动位置
    const currentScrollX = window.scrollX;
    const currentScrollY = window.scrollY;
    
    const chatPanel = document.getElementById('aiChatPanel');
    const aiPanel = document.getElementById('aiPanel');
    
    // 如果AI分析面板打开，先关闭它
    if (aiPanel.classList.contains('open')) {
        aiPanel.classList.remove('open');
    }
    
    // 如果面板当前是打开的，关闭时重置样式
    if (chatPanel.classList.contains('open')) {
        chatPanel.classList.remove('open');
        // 重置面板位置和样式，确保下次打开时位置正确
        chatPanel.style.position = '';
        chatPanel.style.left = '';
        chatPanel.style.top = '';
        chatPanel.style.right = '';
        chatPanel.style.transform = '';
    } else {
        // 打开面板
        chatPanel.classList.add('open');
        
        // 如果是第一次打开或没有当前会话，开始新对话
        if (!currentChatSession) {
            startNewChat();
        }
        
        // 设置拖拽功能
        setupChatPanelDrag();
        setupChatPanelResize();
        setupChatInput();
    }
    
    // 恢复滚动位置（防止页面跳转）
    setTimeout(() => {
        window.scrollTo(currentScrollX, currentScrollY);
    }, 0);
}

// 开始新对话
function startNewChat() {
    // 保存当前对话（如果有消息）
    if (currentChatSession && chatMessages.length > 0) {
        saveChatHistory();
    }
    
    // 重置对话状态
    currentChatSession = generateChatSessionId();
    chatMessages = [];
    
    // 清空对话区域并显示欢迎消息
    const chatMessagesContainer = document.getElementById('chatMessages');
    chatMessagesContainer.innerHTML = `
        <div class="welcome-message">
            <i class="fas fa-robot"></i>
            <p>您好！我是您的AI代码助手，我可以帮助您：</p>
            <ul style="text-align: left; margin: 10px 0; padding-left: 20px;">
                <li>📁 分析当前打开的文件</li>
                <li>🆕 创建新的代码文件</li>
                <li>✏️ 修改现有文件内容</li>
                <li>💡 提供编程建议和解释</li>
            </ul>
            <p style="font-size: 0.9em; color: #666;">试试对我说"帮我创建一个Hello World的C++文件"！</p>
        </div>
    `;
    
    // 聚焦输入框（防止滚动）
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.focus({ preventScroll: true });
    }
}

// 发送聊天消息
async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // 检查认证
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('请先登录');
        return;
    }
    
    // 清空输入框并禁用发送按钮
    chatInput.value = '';
    const sendBtn = document.querySelector('.send-btn');
    sendBtn.disabled = true;
    
    // 重置输入框高度
    chatInput.style.height = '36px';
    chatInput.style.overflowY = 'hidden';
    
    // 重置容器样式
    const container = chatInput.closest('.chat-input-container');
    if (container) {
        container.style.borderColor = '#d0d7de';
        container.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    }
    
    // 添加用户消息到界面
    addChatMessage('user', message);
    
    // 添加加载消息
    const loadingMessage = addChatMessage('ai', '正在思考中...');
    
    try {
        // 收集当前上下文信息
        const contextInfo = {
            currentProject: currentProject ? {
                id: currentProject.id,
                name: currentProject.name,
                path: currentProject.path
            } : null,
            currentFile: currentFile || null,
            currentFileContent: currentFileContent || null
        };
        
        // 发送到后端API
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                message,
                context: contextInfo
            })
        });
        
        const data = await response.json();
        
        console.log('AI聊天响应:', { status: response.status, data });
        
        if (response.ok) {
            // 移除加载消息
            loadingMessage.remove();
            
            // 处理AI响应
            if (data.action) {
                await handleAIAction(data);
            } else {
                addChatMessage('ai', data.message);
            }
            
            // 保存对话历史
            saveChatHistory();
        } else {
            loadingMessage.textContent = data.error || '发送消息时出现错误';
            console.error('AI聊天错误:', data);
        }
    } catch (error) {
        console.error('发送消息失败:', error);
        loadingMessage.textContent = '网络错误，请稍后重试';
    } finally {
        // 重新启用发送按钮
        sendBtn.disabled = false;
    }
}

// 处理AI操作
async function handleAIAction(actionData) {
    console.log('处理AI操作:', actionData);
    
    switch (actionData.action) {
        case 'create_file':
            await handleCreateFileAction(actionData);
            break;
        case 'modify_file':
            await handleModifyFileAction(actionData);
            break;
        case 'analyze_file':
            await handleAnalyzeFileAction(actionData);
            break;
        default:
            addChatMessage('ai', actionData.message || '执行了未知操作');
    }
}

// 处理创建文件操作
async function handleCreateFileAction(actionData) {
    const { filePath, content, message } = actionData;
    
    if (!currentProject) {
        addChatMessage('ai', '❌ 错误：没有选择项目，无法创建文件。请先选择或创建一个项目。');
        return;
    }
    
    console.log('准备创建文件:', { filePath, projectId: currentProject.id });
    
    // 显示文件预览和确认对话框
    showFilePreviewDialog('create', filePath, content, message, async () => {
        try {
            console.log('开始创建文件:', filePath);
            addChatMessage('ai', `🔄 正在创建文件 "${filePath}"...`);
            
            const sessionToken = localStorage.getItem('authToken');
            if (!sessionToken) {
                addChatMessage('ai', '❌ 错误：未登录，请刷新页面重新登录。');
                return;
            }
            
            const response = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(filePath)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({
                    content: content,
                    projectId: currentProject.id
                })
            });
            
            console.log('文件创建API响应:', response.status, response.statusText);
            
            if (response.ok) {
                addChatMessage('ai', `✅ 文件 "${filePath}" 创建成功！`);
                
                // 重新加载项目结构
                console.log('重新加载项目结构...');
                try {
                    await loadProjectStructure(currentProject);
                    console.log('项目结构重新加载完成');
                } catch (loadError) {
                    console.error('重新加载项目结构失败:', loadError);
                    addChatMessage('ai', '⚠️ 文件已创建，但项目结构刷新失败，请手动刷新项目。');
                }
                
                // 自动打开新创建的文件
                console.log('准备打开新创建的文件:', filePath);
                setTimeout(async () => {
                    try {
                        await openFile(filePath);
                        console.log('成功打开新创建的文件:', filePath);
                        addChatMessage('ai', `📄 已自动打开文件 "${filePath}"，您可以开始编辑了！`);
                    } catch (openError) {
                        console.error('打开文件失败:', openError);
                        addChatMessage('ai', `⚠️ 文件已创建，但自动打开失败。请在左侧文件树中手动点击打开文件 "${filePath}"。`);
                    }
                }, 800);
                
            } else {
                const errorData = await response.json();
                console.error('创建文件API错误:', errorData);
                addChatMessage('ai', `❌ 创建文件失败: ${errorData.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('创建文件失败:', error);
            addChatMessage('ai', `❌ 创建文件失败: ${error.message}`);
        }
    });
}

// 处理修改文件操作
async function handleModifyFileAction(actionData) {
    const { filePath, content, message } = actionData;
    
    if (!currentProject) {
        addChatMessage('ai', '错误：没有选择项目，无法修改文件。');
        return;
    }
    
    // 检查是否是直接编辑当前文件
    const isCurrentFile = currentFile && filePath === currentFile;
    
    if (isCurrentFile) {
        // 直接编辑当前文件，显示编辑预览对话框
        showFileEditDialog(filePath, content, message);
    } else {
        // 修改其他文件，使用原有的预览对话框
        showFilePreviewDialog('modify', filePath, content, message, async () => {
            try {
                const sessionToken = localStorage.getItem('authToken');
                const response = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(filePath)}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        content: content,
                        projectId: currentProject.id
                    })
                });
                
                if (response.ok) {
                    addChatMessage('ai', `✅ 文件 "${filePath}" 修改成功！`);
                    
                    // 如果修改的是当前打开的文件，刷新显示
                    if (currentFile === filePath) {
                        await openFile(filePath);
                    }
                } else {
                    const errorData = await response.json();
                    addChatMessage('ai', `❌ 修改文件失败: ${errorData.error}`);
                }
            } catch (error) {
                console.error('修改文件失败:', error);
                addChatMessage('ai', `❌ 修改文件失败: ${error.message}`);
            }
        });
    }
}

// 处理分析文件操作
async function handleAnalyzeFileAction(actionData) {
    const { message } = actionData;
    addChatMessage('ai', message);
}

// 显示文件预览对话框
function showFilePreviewDialog(action, filePath, content, message, onConfirm) {
    // 移除已存在的对话框
    const existingDialog = document.querySelector('.file-preview-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'file-preview-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    const actionText = action === 'create' ? '创建' : '修改';
    const actionIcon = action === 'create' ? 'fa-file-plus' : 'fa-edit';
    
    dialog.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 0;
            max-width: 80vw;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            min-width: 600px;
        ">
            <div style="
                padding: 20px 25px;
                background: linear-gradient(45deg, #4CAF50, #45a049);
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <div style="display: flex; align-items: center;">
                    <i class="fas ${actionIcon}" style="margin-right: 10px; font-size: 20px;"></i>
                    <h3 style="margin: 0;">AI ${actionText}文件预览</h3>
                </div>
                <button onclick="closeFilePreviewDialog()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 50%;
                    transition: background 0.2s ease;
                " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="padding: 20px 25px; flex: 1; overflow-y: auto;">
                <div style="margin-bottom: 15px;">
                    <p style="margin: 0; color: #666; line-height: 1.5;">${message}</p>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">文件路径:</label>
                    <div style="
                        background: #f8f9fa;
                        border: 1px solid #e9ecef;
                        border-radius: 6px;
                        padding: 10px;
                        font-family: 'Courier New', monospace;
                        color: #495057;
                    ">${filePath}</div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">文件内容:</label>
                    <pre style="
                        background: #f8f9fa;
                        border: 1px solid #e9ecef;
                        border-radius: 6px;
                        padding: 15px;
                        font-family: 'Courier New', monospace;
                        font-size: 13px;
                        line-height: 1.4;
                        color: #495057;
                        max-height: 300px;
                        overflow-y: auto;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    ">${content}</pre>
                </div>
            </div>
            
            <div style="
                padding: 20px 25px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            ">
                <button onclick="closeFilePreviewDialog()" style="
                    padding: 10px 20px;
                    border: 1px solid #6c757d;
                    border-radius: 6px;
                    background: white;
                    color: #6c757d;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='#6c757d'; this.style.color='white';" onmouseout="this.style.background='white'; this.style.color='#6c757d';">
                    取消
                </button>
                <button onclick="confirmFileAction()" style="
                    padding: 10px 20px;
                    border: 1px solid #4CAF50;
                    border-radius: 6px;
                    background: #4CAF50;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='#45a049';" onmouseout="this.style.background='#4CAF50';">
                    <i class="fas fa-check" style="margin-right: 5px;"></i>
                    确认${actionText}
                </button>
            </div>
        </div>
    `;
    
    // 存储确认回调
    window.currentFileActionCallback = onConfirm;
    
    document.body.appendChild(dialog);
    
    // 点击背景关闭
    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) {
            closeFilePreviewDialog();
        }
    });
}

// 关闭文件预览对话框
function closeFilePreviewDialog() {
    const dialog = document.querySelector('.file-preview-dialog');
    if (dialog) {
        dialog.remove();
    }
    window.currentFileActionCallback = null;
}

// 确认文件操作
async function confirmFileAction() {
    if (window.currentFileActionCallback) {
        const callback = window.currentFileActionCallback;
        closeFilePreviewDialog();
        await callback();
    }
}

// 显示文件编辑对话框（用于直接编辑当前文件）
function showFileEditDialog(filePath, newContent, message) {
    // 保存原始内容
    const originalContent = currentFileContent;
    
    // 移除已存在的对话框
    const existingDialog = document.querySelector('.file-edit-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'file-edit-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    dialog.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 0;
            max-width: 90vw;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            min-width: 800px;
        ">
            <div style="
                padding: 20px 25px;
                background: linear-gradient(45deg, #2196F3, #1976D2);
                color: white;
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <div style="display: flex; align-items: center;">
                    <i class="fas fa-edit" style="margin-right: 10px; font-size: 20px;"></i>
                    <h3 style="margin: 0;">AI直接编辑文档</h3>
                </div>
                <button onclick="closeFileEditDialog()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 50%;
                    transition: background 0.2s ease;
                " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="padding: 20px 25px; flex: 1; overflow-y: auto;">
                <div style="margin-bottom: 15px;">
                    <p style="margin: 0; color: #666; line-height: 1.5; background: #f0f8ff; padding: 12px; border-radius: 6px; border-left: 4px solid #2196F3;">
                        <i class="fas fa-info-circle" style="color: #2196F3; margin-right: 8px;"></i>
                        ${message}
                    </p>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">文件路径:</label>
                    <div style="
                        background: #f8f9fa;
                        border: 1px solid #e9ecef;
                        border-radius: 6px;
                        padding: 10px;
                        font-family: 'Courier New', monospace;
                        color: #495057;
                        display: flex;
                        align-items: center;
                    ">
                        <i class="fas fa-file-code" style="margin-right: 8px; color: #6c757d;"></i>
                        ${filePath}
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">
                            <i class="fas fa-file-alt" style="margin-right: 5px; color: #dc3545;"></i>
                            原始内容
                        </label>
                        <pre style="
                            background: #fff5f5;
                            border: 1px solid #f5c6cb;
                            border-radius: 6px;
                            padding: 15px;
                            font-family: 'Courier New', monospace;
                            font-size: 12px;
                            line-height: 1.4;
                            color: #495057;
                            height: 400px;
                            overflow-y: auto;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                            margin: 0;
                        ">${originalContent}</pre>
                    </div>
                    
                    <div>
                        <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">
                            <i class="fas fa-file-code" style="margin-right: 5px; color: #28a745;"></i>
                            新内容（AI编辑后）
                        </label>
                        <pre style="
                            background: #f8fff8;
                            border: 1px solid #d4edda;
                            border-radius: 6px;
                            padding: 15px;
                            font-family: 'Courier New', monospace;
                            font-size: 12px;
                            line-height: 1.4;
                            color: #495057;
                            height: 400px;
                            overflow-y: auto;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                            margin: 0;
                        ">${newContent}</pre>
                    </div>
                </div>
            </div>
            
            <div style="
                padding: 20px 25px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: center;
                gap: 15px;
                background: #f8f9fa;
            ">
                <button onclick="rejectFileEdit()" style="
                    padding: 12px 24px;
                    border: 2px solid #dc3545;
                    border-radius: 8px;
                    background: white;
                    color: #dc3545;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                " onmouseover="this.style.background='#dc3545'; this.style.color='white';" onmouseout="this.style.background='white'; this.style.color='#dc3545';">
                    <i class="fas fa-times-circle"></i>
                    撤销修改
                </button>
                <button onclick="acceptFileEdit()" style="
                    padding: 12px 24px;
                    border: 2px solid #28a745;
                    border-radius: 8px;
                    background: #28a745;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                " onmouseover="this.style.background='#218838';" onmouseout="this.style.background='#28a745';">
                    <i class="fas fa-check-circle"></i>
                    保留修改
                </button>
            </div>
        </div>
    `;
    
    // 存储编辑数据
    window.currentFileEditData = {
        filePath: filePath,
        originalContent: originalContent,
        newContent: newContent
    };
    
    // 立即应用新内容到编辑器（预览效果）
    applyContentToEditor(newContent);
    
    document.body.appendChild(dialog);
    
    // 点击背景关闭
    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) {
            rejectFileEdit();
        }
    });
}

// 关闭文件编辑对话框
function closeFileEditDialog() {
    const dialog = document.querySelector('.file-edit-dialog');
    if (dialog) {
        dialog.remove();
    }
    window.currentFileEditData = null;
}

// 接受文件编辑
async function acceptFileEdit() {
    if (!window.currentFileEditData) return;
    
    const { filePath, newContent } = window.currentFileEditData;
    
    try {
        addChatMessage('ai', `🔄 正在保存文件 "${filePath}"...`);
        
        const sessionToken = localStorage.getItem('authToken');
        const response = await fetch(`/api/projects/${currentProject.id}/files/${encodeURIComponent(filePath)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                content: newContent,
                projectId: currentProject.id
            })
        });
        
        if (response.ok) {
            // 更新当前文件内容
            currentFileContent = newContent;
            
            addChatMessage('ai', `✅ 文件修改已保存！文档已成功更新。`);
            
            // 关闭对话框
            closeFileEditDialog();
            
            // 重新加载项目结构
            await loadProjectStructure(currentProject);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '保存文件失败');
        }
    } catch (error) {
        console.error('保存文件失败:', error);
        addChatMessage('ai', `❌ 保存文件失败: ${error.message}`);
    }
}

// 拒绝文件编辑
function rejectFileEdit() {
    if (!window.currentFileEditData) return;
    
    const { originalContent } = window.currentFileEditData;
    
    // 恢复原始内容
    applyContentToEditor(originalContent);
    
    addChatMessage('ai', `↩️ 文件修改已撤销，已恢复到原始内容。`);
    
    // 关闭对话框
    closeFileEditDialog();
}

// 应用内容到编辑器
function applyContentToEditor(content) {
    // 更新预览区域
    const fileContentDiv = document.getElementById('fileContent');
    if (fileContentDiv) {
        // 检测语言并高亮显示
        const language = detectLanguage(currentFile);
        if (window.hljs) {
            try {
                const highlightedCode = hljs.highlight(content, { language }).value;
                fileContentDiv.innerHTML = `<pre><code class="hljs language-${language}">${highlightedCode}</code></pre>`;
            } catch (e) {
                fileContentDiv.innerHTML = `<pre><code>${content}</code></pre>`;
            }
        } else {
            fileContentDiv.innerHTML = `<pre><code>${content}</code></pre>`;
        }
    }
    
    // 如果正在编辑模式，也更新编辑器
    const codeEditor = document.getElementById('codeEditor');
    if (codeEditor && codeEditor.style.display !== 'none') {
        codeEditor.value = content;
    }
    
    // 更新当前文件内容变量
    currentFileContent = content;
}

// 添加聊天消息到界面
function addChatMessage(sender, content) {
    const chatMessagesContainer = document.getElementById('chatMessages');
    
    // 移除欢迎消息（如果存在）
    const welcomeMessage = chatMessagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    // 创建消息元素
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${sender}`;
    messageElement.textContent = content;
    
    chatMessagesContainer.appendChild(messageElement);
    
    // 添加到消息数组
    if (sender === 'user' || (sender === 'ai' && content !== '正在思考中...')) {
        chatMessages.push({
            sender,
            content,
            timestamp: new Date().toISOString()
        });
    }
    
    // 滚动到底部
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    
    return messageElement;
}

// 保存对话历史
async function saveChatHistory() {
    if (!currentChatSession || chatMessages.length === 0) return;
    
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    try {
        await fetch('/api/chat/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                chat_session_id: currentChatSession,
                messages: chatMessages
            })
        });
    } catch (error) {
        console.error('保存对话历史失败:', error);
    }
}

// 显示聊天历史
async function showChatHistory() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('请先登录');
        return;
    }
    
    try {
        // 获取历史记录
        const response = await fetch('/api/chat/history', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            chatHistoryList = data.history;
            displayChatHistory();
        } else {
            alert(data.error || '获取历史记录失败');
        }
    } catch (error) {
        console.error('获取历史记录失败:', error);
        alert('网络错误，请稍后重试');
    }
}

// 显示历史记录模态框
function displayChatHistory() {
    const modal = document.getElementById('chatHistoryModal');
    const historyList = document.getElementById('chatHistoryList');
    
    if (chatHistoryList.length === 0) {
        historyList.innerHTML = '<div class="loading-message">暂无历史记录</div>';
    } else {
        historyList.innerHTML = '';
        
        chatHistoryList.forEach((history, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const date = new Date(history.updated_at).toLocaleString('zh-CN');
            const previewMessages = history.messages.slice(0, 3); // 只显示前3条消息预览
            
            historyItem.innerHTML = `
                <div class="history-header">
                    <div class="history-date">对话时间: ${date}</div>
                    <div class="history-actions">
                        <button class="history-btn load" onclick="loadChatHistory(${index})">
                            <i class="fas fa-comment-dots"></i> 加载
                        </button>
                        <button class="history-btn delete" onclick="deleteChatHistory(${history.id}, ${index})">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>
                </div>
                <div class="history-preview">
                    <div class="history-messages">
                        ${previewMessages.map(msg => `
                            <div class="preview-message ${msg.sender}">
                                <strong>${msg.sender === 'user' ? '我' : 'AI'}:</strong> 
                                ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}
                            </div>
                        `).join('')}
                        ${history.messages.length > 3 ? `<div class="preview-message">...还有 ${history.messages.length - 3} 条消息</div>` : ''}
                    </div>
                </div>
            `;
            
            historyList.appendChild(historyItem);
        });
    }
    
    modal.style.display = 'flex';
}

// 加载历史对话
function loadChatHistory(index) {
    const history = chatHistoryList[index];
    if (!history) return;
    
    // 保存当前对话
    if (currentChatSession && chatMessages.length > 0) {
        saveChatHistory();
    }
    
    // 加载历史对话
    currentChatSession = history.chat_session_id;
    chatMessages = [...history.messages];
    
    // 显示历史消息
    const chatMessagesContainer = document.getElementById('chatMessages');
    chatMessagesContainer.innerHTML = '';
    
    history.messages.forEach(msg => {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${msg.sender}`;
        messageElement.textContent = msg.content;
        chatMessagesContainer.appendChild(messageElement);
    });
    
    // 滚动到底部
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    
    // 关闭历史记录模态框
    closeChatHistoryModal();
    
    // 确保对话面板打开
    const chatPanel = document.getElementById('aiChatPanel');
    if (!chatPanel.classList.contains('open')) {
        chatPanel.classList.add('open');
    }
}

// 删除历史对话
async function deleteChatHistory(historyId, index) {
    if (!confirm('确定要删除这条对话记录吗？')) return;
    
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    try {
        const response = await fetch(`/api/chat/history/${historyId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            // 从列表中移除
            chatHistoryList.splice(index, 1);
            displayChatHistory();
        } else {
            const data = await response.json();
            alert(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除历史记录失败:', error);
        alert('网络错误，请稍后重试');
    }
}

// 清空所有历史记录
async function clearAllChatHistory() {
    if (!confirm('确定要清空所有对话记录吗？此操作不可恢复！')) return;
    
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    try {
        const response = await fetch('/api/chat/history', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            chatHistoryList = [];
            displayChatHistory();
        } else {
            const data = await response.json();
            alert(data.error || '清空失败');
        }
    } catch (error) {
        console.error('清空历史记录失败:', error);
        alert('网络错误，请稍后重试');
    }
}

// 关闭历史记录模态框
function closeChatHistoryModal() {
    const modal = document.getElementById('chatHistoryModal');
    modal.style.display = 'none';
}

// 设置聊天输入框功能
function setupChatInput() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.querySelector('.send-btn');
    
    if (!chatInput || !sendBtn) return;
    
    // 设置初始高度
    const initialHeight = 36; // 最小高度
    const maxHeight = 120; // 最大高度
    const lineHeight = 20; // 行高
    
    // 自动调整高度的函数
    function adjustHeight() {
        // 重置高度以获取准确的scrollHeight
        chatInput.style.height = initialHeight + 'px';
        
        // 计算内容高度
        const scrollHeight = chatInput.scrollHeight;
        const newHeight = Math.max(initialHeight, Math.min(scrollHeight, maxHeight));
        
        // 设置新高度
        chatInput.style.height = newHeight + 'px';
        
        // 如果内容超过最大高度，显示滚动条
        if (scrollHeight > maxHeight) {
            chatInput.style.overflowY = 'auto';
        } else {
            chatInput.style.overflowY = 'hidden';
        }
    }
    
    // 监听输入变化
    chatInput.addEventListener('input', function() {
        const hasContent = this.value.trim().length > 0;
        sendBtn.disabled = !hasContent;
        
        // 自动调整高度
        adjustHeight();
        
        // 添加打字效果的视觉反馈
        const container = this.closest('.chat-input-container');
        if (hasContent) {
            container.style.borderColor = '#4CAF50';
        } else {
            container.style.borderColor = '#d0d7de';
        }
    });
    
    // 监听粘贴事件
    chatInput.addEventListener('paste', function() {
        // 延迟调整高度，等待粘贴内容插入
        setTimeout(() => {
            adjustHeight();
        }, 10);
    });
    
    // 监听按键
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) {
                sendChatMessage();
            }
        }
        
        // 支持Tab键缩进（类似代码编辑器）
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            
            // 插入4个空格
            this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 4;
            
            // 触发input事件以调整高度
            this.dispatchEvent(new Event('input'));
        }
    });
    
    // 监听焦点事件
    chatInput.addEventListener('focus', function() {
        const container = this.closest('.chat-input-container');
        container.style.borderColor = '#4CAF50';
        container.style.boxShadow = '0 0 0 2px rgba(76, 175, 80, 0.1)';
    });
    
    chatInput.addEventListener('blur', function() {
        if (!this.value.trim()) {
            const container = this.closest('.chat-input-container');
            container.style.borderColor = '#d0d7de';
            container.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        }
    });
    
    // 初始状态
    sendBtn.disabled = true;
    adjustHeight();
}

// 设置对话面板拖拽功能
function setupChatPanelDrag() {
    const chatPanel = document.getElementById('aiChatPanel');
    const header = document.getElementById('aiChatPanelHeader');
    
    if (!chatPanel || !header) return;
    
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = chatPanel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        
        chatPanel.style.position = 'fixed';
        chatPanel.style.left = startLeft + 'px';
        chatPanel.style.top = startTop + 'px';
        chatPanel.style.right = 'auto';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        chatPanel.style.left = (startLeft + deltaX) + 'px';
        chatPanel.style.top = (startTop + deltaY) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

// 设置对话面板大小调整功能
function setupChatPanelResize() {
    const chatPanel = document.getElementById('aiChatPanel');
    const handle = chatPanel.querySelector('.resize-handle');
    
    if (!handle) return;
    
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = chatPanel.offsetWidth;
        startHeight = chatPanel.offsetHeight;
        chatPanel.style.transition = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        // 右下角resize-handle：向右拖拽增加宽度，向下拖拽增加高度
        const width = startWidth + (e.clientX - startX);
        const height = startHeight + (e.clientY - startY);
        
        chatPanel.style.width = Math.max(300, Math.min(800, width)) + 'px';
        chatPanel.style.height = Math.max(400, Math.min(window.innerHeight - 100, height)) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            chatPanel.style.transition = '';
            isResizing = false;
        }
    });
}

// ============ 代码选择和AI对话集成功能 ============

// 设置代码选择右键菜单
function setupCodeSelectionMenu() {
    console.log('🔧 初始化代码选择右键菜单');
    
    // 监听文档的右键点击事件
    document.addEventListener('contextmenu', function(e) {
        console.log('🖱️ 右键点击事件触发，目标元素:', e.target);
        
        // 检查是否在代码显示区域
        const codeContent = document.getElementById('codeContent');
        const readOnlyView = document.getElementById('readOnlyView');
        const editModeView = document.getElementById('editModeView');
        const codeEditor = document.getElementById('codeEditor');
        
        console.log('📋 DOM元素检查:', {
            codeContent: !!codeContent,
            readOnlyView: !!readOnlyView,
            editModeView: !!editModeView,
            codeEditor: !!codeEditor
        });
        
        let isInCodeArea = false;
        let selectedText = '';
        
        // 首先检查是否有选中的文本
        const globalSelection = window.getSelection().toString().trim();
        console.log('🔍 全局选中文本:', globalSelection);
        
        // 检查是否在代码内容区域
        if (codeContent && codeContent.contains(e.target)) {
            console.log('✅ 点击位置在代码内容区域内');
            
            // 检查是否在只读视图（代码显示区域）
            if (readOnlyView && readOnlyView.contains(e.target)) {
                console.log('✅ 在只读视图中');
                isInCodeArea = true;
                selectedText = globalSelection;
            }
            // 检查是否在编辑模式
            else if (editModeView && editModeView.contains(e.target) && codeEditor) {
                console.log('✅ 在编辑模式中');
                isInCodeArea = true;
                // 获取编辑器中选中的文本
                if (codeEditor === document.activeElement) {
                    const start = codeEditor.selectionStart;
                    const end = codeEditor.selectionEnd;
                    selectedText = codeEditor.value.substring(start, end).trim();
                    console.log('📝 从编辑器获取选中文本:', selectedText);
                } else {
                    // 如果编辑器不是焦点，也尝试获取选中文本
                    selectedText = globalSelection;
                }
            }
        }
        
        console.log('🎯 最终检查结果:', {
            isInCodeArea,
            selectedText,
            selectedTextLength: selectedText.length
        });
        
        // 修改条件：如果在代码区域，无论是否有选中文本都显示菜单
        if (isInCodeArea) {
            e.preventDefault();
            console.log('🎉 显示代码选择菜单');
            showCodeSelectionContextMenu(e.clientX, e.clientY, selectedText);
        } else {
            console.log('❌ 不在代码区域，不显示自定义菜单');
        }
    });
    
    console.log('✅ 代码选择右键菜单初始化完成');
}

// 显示代码选择上下文菜单
function showCodeSelectionContextMenu(x, y, selectedText) {
    console.log('🎨 创建代码选择上下文菜单:', { x, y, selectedText });
    
    // 移除已存在的菜单
    const existingMenu = document.querySelector('.code-selection-menu');
    if (existingMenu) {
        existingMenu.remove();
        console.log('🗑️ 移除已存在的菜单');
    }
    
    // 将选中的文本存储到全局变量，避免在HTML属性中传递
    window.selectedCodeText = selectedText;
    
    const menu = document.createElement('div');
    menu.className = 'code-selection-menu context-menu';
    menu.style.cssText = `
        position: fixed !important;
        left: ${x}px !important;
        top: ${y}px !important;
        background: white !important;
        border: 1px solid #e1e8ed !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        z-index: 99999 !important;
        min-width: 200px !important;
        padding: 8px 0 !important;
        font-size: 14px !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    `;
    
    let menuContent = '';
    
    if (selectedText && selectedText.length > 0) {
        // 有选中文本时的菜单
        const previewText = selectedText.length > 50 ? 
            selectedText.substring(0, 50) + '...' : selectedText;
        
        menuContent = `
            <div class="context-menu-item" onclick="addCodeToAIChat()" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; border-bottom: none;">
                <i class="fas fa-robot" style="color: #4CAF50; margin-right: 8px;"></i>
                添加选中代码到AI对话
            </div>
            <div class="context-menu-item" onclick="addCodeToAIChatWithContext()" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; border-bottom: none;">
                <i class="fas fa-comments" style="color: #2196F3; margin-right: 8px;"></i>
                添加选中代码到AI对话（带上下文）
            </div>
            <hr style="margin: 4px 0; border: none; border-top: 1px solid #eee;">
            <div class="context-menu-item disabled" style="font-size: 12px; color: #666; padding: 4px 12px;">
                选中内容: ${escapeForHTML(previewText)}
            </div>
        `;
    } else {
        // 没有选中文本时的菜单
        menuContent = `
            <div class="context-menu-item" onclick="addCurrentFileToAIChat()" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; border-bottom: none;">
                <i class="fas fa-file-code" style="color: #FF9800; margin-right: 8px;"></i>
                添加当前文件到AI对话
            </div>
            <div class="context-menu-item" onclick="analyzeCurrentCode()" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; border-bottom: none;">
                <i class="fas fa-search" style="color: #9C27B0; margin-right: 8px;"></i>
                分析当前代码
            </div>
            <hr style="margin: 4px 0; border: none; border-top: 1px solid #eee;">
            <div class="context-menu-item disabled" style="font-size: 12px; color: #666; padding: 4px 12px;">
                <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
                未选中任何代码
            </div>
        `;
    }
    
    menu.innerHTML = menuContent;
    
    // 添加菜单项悬停效果
    const menuItems = menu.querySelectorAll('.context-menu-item:not(.disabled)');
    menuItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f5f5f5';
        });
        item.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'transparent';
        });
    });
    
    document.body.appendChild(menu);
    console.log('✅ 菜单已添加到页面，元素:', menu);
    console.log('📍 菜单位置和样式:', {
        position: menu.style.position,
        left: menu.style.left,
        top: menu.style.top,
        zIndex: menu.style.zIndex,
        display: menu.style.display,
        visibility: menu.style.visibility
    });
    
    // 强制重绘
    menu.offsetHeight;
    
    // 调整菜单位置，确保不超出屏幕
    setTimeout(() => {
        const rect = menu.getBoundingClientRect();
        console.log('📏 菜单尺寸:', rect);
        
        let newX = x;
        let newY = y;
        
        if (rect.right > window.innerWidth) {
            newX = x - rect.width;
            console.log('🔄 调整X位置:', newX);
        }
        if (rect.bottom > window.innerHeight) {
            newY = y - rect.height;
            console.log('🔄 调整Y位置:', newY);
        }
        
        if (newX !== x || newY !== y) {
            menu.style.left = newX + 'px';
            menu.style.top = newY + 'px';
        }
    }, 0);
    
    // 点击其他地方关闭菜单
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                console.log('🗑️ 关闭代码选择菜单');
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// 添加代码到AI对话
function addCodeToAIChat() {
    const codeText = window.selectedCodeText;
    if (!codeText) return;
    
    // 清理菜单
    const menu = document.querySelector('.code-selection-menu');
    if (menu) menu.remove();
    
    // 确保AI聊天面板打开
    const chatPanel = document.getElementById('aiChatPanel');
    if (!chatPanel.classList.contains('open')) {
        openAIChatPanel();
    }
    
    // 构造消息
    const message = `请帮我分析这段代码：\n\n\`\`\`\n${codeText}\n\`\`\``;
    
    // 填充到输入框
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = message;
        chatInput.focus();
        
        // 启用发送按钮
        const sendBtn = document.querySelector('.send-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
    
    showNotification('代码已添加到AI对话框', 'success');
}

// 添加代码到AI对话（带文件上下文）
function addCodeToAIChatWithContext() {
    const codeText = window.selectedCodeText;
    if (!codeText) return;
    
    // 清理菜单
    const menu = document.querySelector('.code-selection-menu');
    if (menu) menu.remove();
    
    // 确保AI聊天面板打开
    const chatPanel = document.getElementById('aiChatPanel');
    if (!chatPanel.classList.contains('open')) {
        openAIChatPanel();
    }
    
    // 构造带上下文的消息
    let message = `请帮我分析这段代码`;
    
    if (currentFile) {
        message += `（来自文件：${currentFile}）`;
    }
    
    message += `：\n\n\`\`\`\n${codeText}\n\`\`\`\n\n`;
    message += `请结合当前文件的整体结构和功能来分析这段代码的作用和可能的改进建议。`;
    
    // 填充到输入框
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = message;
        chatInput.focus();
        
        // 启用发送按钮
        const sendBtn = document.querySelector('.send-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
    
    showNotification('代码和上下文已添加到AI对话框', 'success');
}

// HTML转义函数
function escapeForHTML(text) {
    return text.replace(/'/g, '&#39;')
               .replace(/"/g, '&quot;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/&/g, '&amp;');
}

// 添加当前文件到AI对话
function addCurrentFileToAIChat() {
    // 清理菜单
    const menu = document.querySelector('.code-selection-menu');
    if (menu) menu.remove();
    
    if (!currentFile) {
        showNotification('没有打开的文件', 'warning');
        return;
    }
    
    // 确保AI聊天面板打开
    const chatPanel = document.getElementById('aiChatPanel');
    if (!chatPanel.classList.contains('open')) {
        openAIChatPanel();
    }
    
    // 构造消息
    const message = `请帮我分析当前文件 "${currentFile}"，包括它的功能、结构和可能的改进建议。`;
    
    // 填充到输入框
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = message;
        chatInput.focus();
        
        // 启用发送按钮
        const sendBtn = document.querySelector('.send-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
    
    showNotification('当前文件已添加到AI对话框', 'success');
}

// 分析当前代码
function analyzeCurrentCode() {
    // 清理菜单
    const menu = document.querySelector('.code-selection-menu');
    if (menu) menu.remove();
    
    if (!currentFile || !currentFileContent) {
        showNotification('没有可分析的代码内容', 'warning');
        return;
    }
    
    // 确保AI聊天面板打开
    const chatPanel = document.getElementById('aiChatPanel');
    if (!chatPanel.classList.contains('open')) {
        openAIChatPanel();
    }
    
    // 构造消息
    const message = `请帮我详细分析当前文件 "${currentFile}" 的代码，包括：
1. 代码的主要功能和目的
2. 代码结构和设计模式
3. 潜在的问题或改进建议
4. 性能优化建议`;
    
    // 填充到输入框
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = message;
        chatInput.focus();
        
        // 启用发送按钮
        const sendBtn = document.querySelector('.send-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
    
    showNotification('代码分析请求已添加到AI对话框', 'success');
}

// 添加文件到AI对话
function addFileToAIChat(filePath) {
    if (!currentProject) {
        showNotification('没有选择项目', 'error');
        return;
    }
    
    // 确保AI聊天面板打开
    const chatPanel = document.getElementById('aiChatPanel');
    if (!chatPanel.classList.contains('open')) {
        openAIChatPanel();
    }
    
    // 构造消息
    const message = `请帮我分析文件 "${filePath}"，包括它的功能、结构和可能的改进建议。`;
    
    // 填充到输入框
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = message;
        chatInput.focus();
        
        // 启用发送按钮
        const sendBtn = document.querySelector('.send-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
        }
    }
    
    showNotification(`文件 "${filePath}" 已添加到AI对话框`, 'success');
}
