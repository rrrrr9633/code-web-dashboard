let currentFile = null;
let currentFileContent = null;
let currentProject = null;
let currentRenameProjectId = null;
let projects = [];
let aiConfigured = false;

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
    } else if (item.type === 'file') {
        const fileIcon = getFileIcon(item.extension);
        labelDiv.innerHTML = `
            <i class="${fileIcon} file-icon"></i>
            <span>${item.name}</span>
        `;
        
        labelDiv.onclick = function() {
            openFile(item.path, item.handle);
        };

        itemDiv.appendChild(labelDiv);
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
    
    if (childrenDiv) {
        if (childrenDiv.classList.contains('open')) {
            childrenDiv.classList.remove('open');
            icon.classList.remove('fa-folder-open');
            icon.classList.add('fa-folder');
        } else {
            childrenDiv.classList.add('open');
            icon.classList.remove('fa-folder');
            icon.classList.add('fa-folder-open');
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
    
    // 文件信息
    const fileInfo = `
        <div class="file-info">
            <h3><i class="fas fa-file"></i> ${fileData.path.split('/').pop()}</h3>
            <p><strong>路径:</strong> ${fileData.path}</p>
            <p><strong>大小:</strong> ${formatFileSize(fileData.size)}</p>
            <p><strong>修改时间:</strong> ${new Date(fileData.modified).toLocaleString('zh-CN')}</p>
        </div>
    `;

    // 代码内容
    const language = getLanguageFromExtension(fileData.extension);
    const highlightedCode = hljs.highlightAuto(fileData.content, [language]).value;
    
    const codeContent = `
        <div class="code-container">
            ${fileInfo}
            <pre><code class="language-${language}">${highlightedCode}</code></pre>
        </div>
    `;

    codeContainer.innerHTML = codeContent;
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
