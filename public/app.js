let currentFile = null;
let currentFileContent = null;
let currentProject = null;
let currentRenameProjectId = null;
let projects = [];
let aiConfigured = false;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    checkAIConfiguration();
    loadProjects();
    setupAddProjectForm();
    setupRenameProjectForm();
    setupAIConfigForm();
});

// 检查AI配置状态
async function checkAIConfiguration() {
    try {
        const sessionToken = localStorage.getItem('ai_session_token');
        if (!sessionToken) {
            // 没有会话令牌，跳转到登录页面
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch('/api/ai-config/status', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            aiConfigured = data.configured;
            if (data.configured) {
                updateCurrentConfigDisplay(data.config);
            }
        } else {
            // 会话无效，跳转到登录页面
            localStorage.removeItem('ai_session_token');
            localStorage.removeItem('ai_config');
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('检查AI配置失败:', error);
        window.location.href = '/login.html';
    }
}

// 加载项目列表
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        if (response.ok) {
            projects = await response.json();
        } else {
            // 如果后端还没有项目管理API，初始化默认项目
            projects = [{
                id: 'default',
                name: '默认项目',
                path: './默认项目',
                description: '默认代码项目示例'
            }];
        }
        renderProjectList();
        
        // 加载第一个项目（如果有的话）
        if (projects.length > 0) {
            selectProject(projects[0].id);
        }
    } catch (error) {
        console.error('加载项目列表失败:', error);
        // 降级处理，加载默认项目结构
        loadProjectStructure();
    }
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
        return;
    }
    
    projectList.innerHTML = projects.map(project => `
        <div class="project-item ${currentProject && currentProject.id === project.id ? 'active' : ''}" onclick="selectProject('${project.id}')">
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
}

// 选择项目
async function selectProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    currentProject = project; // 存储整个项目对象
    renderProjectList(); // 重新渲染以更新active状态
    await loadProjectStructure(project);
}

// 加载项目结构
async function loadProjectStructure(project = null) {
    try {
        const url = project ? `/api/structure?project=${project.id}` : '/api/structure';
        const response = await fetch(url);
        const structure = await response.json();
        
        // 检查是否有重组配置
        if (project && project.id !== 'default') {
            await checkRestructureStatus(project.id);
        }
        
        // 更新概览卡片
        updateOverviewCards(structure);
        
        // 渲染文件树
        renderFileTree(structure);
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
    // 只统计非默认项目
    let projectCount = projects.filter(p => p.id !== 'default').length;
    let moduleCount = 0;
    let fileCount = 0;
    
    // 如果当前项目是默认项目，不计算其文件和模块数量
    if (currentProject && currentProject.id !== 'default') {
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
        labelDiv.innerHTML = `
            <i class="fas fa-layer-group" style="color: #e74c3c;"></i>
            <span style="font-weight: bold; color: #2c3e50;">${item.name}</span>
        `;
        
        labelDiv.onclick = function() {
            toggleDirectory(itemDiv, item);
        };

        // 添加分类描述
        if (item.description) {
            labelDiv.title = `${item.description}: ${item.details}`;
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
        }
    } else if (item.type === 'directory') {
        const categoryColor = getCategoryColor(item.category);
        labelDiv.innerHTML = `
            <i class="fas fa-folder folder-icon" style="color: ${categoryColor};"></i>
            <span>${item.name}</span>
            <small style="margin-left: 8px; color: #7f8c8d; font-size: 0.8em;">[${item.category}]</small>
        `;
        
        labelDiv.onclick = function() {
            toggleDirectory(itemDiv, item);
        };

        // 添加描述信息
        if (item.description) {
            labelDiv.title = `${item.description}: ${item.details}`;
        }

        itemDiv.appendChild(labelDiv);

        // 创建子项容器
        if (item.children && item.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'children';
            renderFileTree(item.children, childrenDiv);
            itemDiv.appendChild(childrenDiv);
        }
    } else {
        const fileIcon = getFileIcon(item.extension);
        labelDiv.innerHTML = `
            <i class="${fileIcon} file-icon"></i>
            <span>${item.name}</span>
        `;
        
        labelDiv.onclick = function() {
            openFile(item.path);
        };

        itemDiv.appendChild(labelDiv);
    }

    return itemDiv;
}

// 获取分类颜色
function getCategoryColor(category) {
    const colorMap = {
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

// 加载文件内容 (重命名为openFile以保持一致性)
async function openFile(filePath) {
    try {
        // 设置当前文件
        currentFile = filePath;
        
        // UI状态管理 - 搜索功能保持可用，左侧目录始终可见
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

        const projectParam = currentProject ? `?project=${currentProject.id}` : '';
        const response = await fetch(`/api/file/${filePath}${projectParam}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        currentFileContent = data.content;

        // 更新文件路径显示
        const displayPath = currentProject ? `${currentProject.name}/${filePath}` : filePath;
        document.getElementById('filePath').textContent = displayPath;

        // 启用AI按钮
        const aiButtons = document.querySelectorAll('.ai-btn');
        aiButtons.forEach(btn => btn.disabled = false);

        // 渲染文件内容
        renderFileContent(data);

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
    if (!aiConfigured) {
        showNotification('请先配置AI服务', 'warning');
        openAIConfigModal();
        return;
    }

    if (!currentFile || !currentFileContent) {
        showNotification('请先选择一个文件', 'warning');
        return;
    }

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
        const sessionToken = localStorage.getItem('ai_session_token');
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
        const projectParam = currentProject ? `&project=${currentProject.id}` : '';
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}${projectParam}`);
        const results = await response.json();
        
        displaySearchResults(results, query);
    } catch (error) {
        console.error('搜索失败:', error);
        displaySearchResults([], query);
    }
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
        html += `
            <div class="search-result-item" onclick="openFileFromSearch('${result.path}')">
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
function openFileFromSearch(filePath) {
    openFile(filePath);
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 项目管理相关函数

// 显示添加项目对话框
function showAddProjectDialog() {
    document.getElementById('addProjectModal').style.display = 'block';
    document.getElementById('projectName').focus();
}

// 关闭添加项目对话框
function closeAddProjectDialog() {
    document.getElementById('addProjectModal').style.display = 'none';
    document.getElementById('addProjectForm').reset();
}

// 设置添加项目表单
function setupAddProjectForm() {
    document.getElementById('addProjectForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const projectData = {
            name: formData.get('projectName'),
            path: formData.get('projectPath')
        };
        
        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });
            
            if (response.ok) {
                const newProject = await response.json();
                projects.push(newProject);
                renderProjectList();
                closeAddProjectDialog();
                
                // 自动选择新添加的项目
                selectProject(newProject.id);
                
                // 显示成功消息
                showNotification('项目添加成功！', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.message || '添加项目失败');
            }
        } catch (error) {
            console.error('添加项目失败:', error);
            showNotification('添加项目失败: ' + error.message, 'error');
        }
    });
    
    // 点击模态框外部关闭
    document.getElementById('addProjectModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAddProjectDialog();
        }
    });
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
    if (projectId === 'default') {
        showNotification('默认项目不能重命名', 'warning');
        return;
    }
    
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
            const response = await fetch(`/api/projects/${currentRenameProjectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
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
    if (!confirm('确定要移除这个项目吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            projects = projects.filter(p => p.id !== projectId);
            renderProjectList();
            
            // 如果移除的是当前项目，清空内容
            if (currentProject?.id === projectId) {
                currentProject = null;
                document.getElementById('fileTree').innerHTML = `
                    <div class="welcome" style="text-align: center; padding: 20px;">
                        <i class="fas fa-folder-open" style="font-size: 2em; color: #ccc; margin-bottom: 10px;"></i>
                        <p style="color: #666;">请选择一个项目开始分析</p>
                    </div>
                `;
                
                // 重置概览卡片
                document.getElementById('projectCount').textContent = projects.length;
                document.getElementById('fileCount').textContent = '-';
                document.getElementById('moduleCount').textContent = '-';
            }
            
            // 如果还有其他项目，选择第一个
            if (projects.length > 0 && (!currentProject || currentProject.id === projectId)) {
                selectProject(projects[0].id);
            }
            
            showNotification('项目已移除', 'success');
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
        if (newWidth > 400 && newHeight > 300) {
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
        const sessionToken = localStorage.getItem('ai_session_token');
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
        const sessionToken = localStorage.getItem('ai_session_token');
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
    if (!aiConfigured) {
        showNotification('请先配置AI服务', 'warning');
        openAIConfigModal();
        return;
    }

    if (!currentProject) {
        showNotification('请先选择一个项目', 'warning');
        return;
    }

    // 检查是否是默认项目
    if (currentProject.id === 'default') {
        showNotification('默认项目不支持AI分析，请添加其他项目进行分析', 'warning');
        return;
    }

    try {
        // 首先检查是否已有分析结果
        const existingConfigResponse = await fetch(`/api/projects/${currentProject.id}/restructure`);
        const existingConfig = await existingConfigResponse.json();
        
        if (existingConfig.hasConfig) {
            // 已有分析结果，询问用户是否重新分析
            const shouldReanalyze = await showAnalysisOptionsDialog(existingConfig.config);
            if (!shouldReanalyze) {
                // 用户选择使用现有配置，显示现有的分析结果
                showExistingAnalysisResult(existingConfig.config);
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
function showExistingAnalysisResult(config) {
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
                <button class="restructure-btn reset-btn" onclick="resetProjectRestructure('${currentProject.id}')">
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
    
    const sessionToken = localStorage.getItem('ai_session_token');
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
        const saveResponse = await fetch(`/api/projects/${projectId}/restructure`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ structureMapping })
        });
        
        if (!saveResponse.ok) {
            throw new Error('保存重组配置失败');
        }
        
        // 重新加载项目结构（现在会应用保存的重组配置）
        await loadProjectStructure(project);
        
        // 更新状态显示
        updateProjectRestructureStatus(projectId, true);
        
        showNotification('目录重组已保存并应用', 'success');
        
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
        const response = await fetch(`/api/projects/${projectId}/restructure`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('删除重组配置失败');
        }
        
        // 重新加载项目结构
        const project = projects.find(p => p.id === projectId);
        if (project) {
            await loadProjectStructure(project);
        }
        
        // 更新状态显示
        updateProjectRestructureStatus(projectId, false);
        
        showNotification('目录结构已重置为原始状态', 'success');
        
    } catch (error) {
        console.error('重置目录结构失败:', error);
        showNotification('重置目录结构失败: ' + error.message, 'error');
    }
}

// 根据AI分析对项目结构进行分类
function categorizeProjectStructure(structure, mapping) {
    if (!mapping || !mapping.categories) {
        return structure;
    }
    
    const categories = mapping.categories;
    const categorizedStructure = [];
    const uncategorized = [];
    
    // 为每个分类创建容器
    Object.keys(categories).forEach(categoryName => {
        const category = categories[categoryName];
        const categoryContainer = {
            name: categoryName,
            type: 'category',
            path: '',
            description: category.description,
            color: category.color,
            children: []
        };
        
        // 查找属于这个分类的目录
        structure.forEach(item => {
            if (item.type === 'directory') {
                const itemPath = item.name + '/';
                if (category.directories.some(dir => 
                    dir === itemPath || 
                    itemPath.toLowerCase().includes(dir.toLowerCase().replace('/', '')) ||
                    dir.toLowerCase().replace('/', '').includes(item.name.toLowerCase())
                )) {
                    categoryContainer.children.push(item);
                }
            }
        });
        
        // 只有非空分类才添加
        if (categoryContainer.children.length > 0) {
            categorizedStructure.push(categoryContainer);
        }
    });
    
    // 添加未分类的项目
    structure.forEach(item => {
        let isCategorized = false;
        
        if (item.type === 'directory') {
            const itemPath = item.name + '/';
            Object.values(categories).forEach(category => {
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
            uncategorized.push(item);
        }
    });
    
    // 如果有未分类的项目，添加到"其他"分类
    if (uncategorized.length > 0) {
        categorizedStructure.push({
            name: '其他模块',
            type: 'category',
            path: '',
            description: '未分类的模块和文件',
            color: '#7f8c8d',
            children: uncategorized
        });
    }
    
    return categorizedStructure;
}
