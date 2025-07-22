let currentFile = null;
let currentFileContent = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadProjectStructure();
});

// 加载项目结构
async function loadProjectStructure() {
    try {
        const response = await fetch('/api/structure');
        const structure = await response.json();
        
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

// 更新概览卡片
function updateOverviewCards(structure) {
    let moduleCount = 0;
    let fileCount = 0;
    let protocolCount = 0;
    
    // 统计协议实现模块
    const protocolModules = ['amqp', 'mqtt', 'kafka', 'nats', 'sqs'];
    
    function countItems(items) {
        items.forEach(item => {
            if (item.type === 'category') {
                countItems(item.children || []);
            } else if (item.type === 'directory') {
                moduleCount++;
                if (protocolModules.includes(item.name)) {
                    protocolCount++;
                }
                countItems(item.children || []);
            } else if (item.type === 'file') {
                fileCount++;
            }
        });
    }
    
    countItems(structure);
    
    // 更新显示
    document.getElementById('moduleCount').textContent = moduleCount;
    document.getElementById('fileCount').textContent = fileCount;
    document.getElementById('protocolCount').textContent = protocolCount;
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

        const response = await fetch(`/api/file/${filePath}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        currentFileContent = data.content;

        // 更新文件路径显示
        document.getElementById('filePath').textContent = filePath;

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
    if (!currentFile || !currentFileContent) {
        alert('请先选择一个文件');
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
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        const htmlContent = marked.parse(data.analysis);
        aiContent.innerHTML = htmlContent;

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
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
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

// 初始化highlight.js
hljs.highlightAll();
