const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

// 项目根目录
const PROJECT_ROOT = path.join(__dirname, '..');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DeepSeek API配置
const DEEPSEEK_API_KEY = 'sk-f26b5f11db6048ae8b6bbfbb30cee1fd';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 项目结构分析配置
const PROJECT_STRUCTURE = {
  // 协议实现层
  'amqp/': {
    category: '协议实现',
    description: 'AMQP协议实现',
    details: '高级消息队列协议(AMQP)的完整实现，包括连接、通道、交换机、队列等核心组件，支持消息路由和持久化'
  },
  'mqtt/': {
    category: '协议实现',
    description: 'MQTT协议实现',
    details: 'MQTT消息传输协议的实现，专为物联网设备设计，支持轻量级消息传输和发布订阅模式'
  },
  'kafka/': {
    category: '协议实现',
    description: 'Kafka协议实现',
    details: 'Apache Kafka协议兼容层，支持高吞吐量的分布式流处理和消息队列功能'
  },
  'nats/': {
    category: '协议实现',
    description: 'NATS协议实现',
    details: 'NATS消息系统协议实现，提供轻量级、高性能的消息传递服务'
  },
  'sqs/': {
    category: '协议实现',
    description: 'SQS协议实现',
    details: 'Amazon SQS兼容的消息队列服务实现，提供云原生的消息队列功能'
  },
  
  // 核心服务层
  'broker/': {
    category: '核心服务',
    description: '消息代理核心',
    details: '消息路由和分发的核心逻辑，负责处理不同协议间的消息转换和路由策略'
  },
  'api/': {
    category: '核心服务',
    description: 'HTTP API服务',
    details: '提供RESTful API接口，用于管理和监控FlowMQ服务，包括配置管理、状态查询等功能'
  },
  'http/': {
    category: '核心服务',
    description: 'HTTP服务模块',
    details: 'HTTP协议处理模块，提供Web接口和HTTP API服务'
  },

  // 存储层
  'storage/': {
    category: '存储层',
    description: '存储层',
    details: '消息持久化存储系统，支持多种存储后端，确保消息的可靠性和持久化'
  },
  'meta/': {
    category: '存储层',
    description: '元数据管理',
    details: '集群元数据和配置管理，维护系统配置、用户信息、权限等元数据'
  },

  // 安全认证层
  'authn/': {
    category: '安全认证',
    description: '认证模块',
    details: '用户认证和授权系统，支持多种认证方式，包括用户名密码、证书、JWT等'
  },
  'security/': {
    category: '安全认证',
    description: '安全模块',
    details: 'TLS/SSL和其他安全相关功能，包括加密传输、证书管理、安全策略等'
  },
  'banned/': {
    category: '安全认证',
    description: '封禁管理',
    details: '用户和IP封禁管理系统，支持动态封禁规则和黑名单管理'
  },

  // 集群管理层
  'cluster/': {
    category: '集群管理',
    description: '集群管理',
    details: '分布式集群协调和管理，包括节点发现、负载均衡、故障转移等功能'
  },
  'mgmt/': {
    category: '集群管理',
    description: '管理服务',
    details: '集群管理和运维服务，提供集群监控、配置管理、运维工具等功能'
  },

  // 基础设施层
  'base/': {
    category: '基础设施',
    description: '基础组件',
    details: '基础工具和组件库，包括日志记录、指标收集、工具函数等通用功能'
  },
  'core/': {
    category: '基础设施',
    description: '核心框架',
    details: '核心框架和基础设施代码，提供系统运行的基础支撑'
  },
  'bus/': {
    category: '基础设施',
    description: '消息总线',
    details: '内部消息总线系统，用于组件间的消息传递和事件处理'
  },
  'resource/': {
    category: '基础设施',
    description: '资源管理',
    details: '系统资源管理模块，包括内存、CPU、网络等资源的分配和监控'
  },

  // 工具和扩展
  'apispec/': {
    category: '工具扩展',
    description: 'API规范工具',
    details: 'API规范定义和编译工具，用于生成API文档和客户端代码'
  },
  'pubsub/': {
    category: '工具扩展',
    description: '发布订阅',
    details: '发布订阅模式的实现，提供事件驱动的消息传递机制'
  },
  'contrib/': {
    category: '工具扩展',
    description: '扩展贡献',
    details: '社区贡献的扩展模块和插件'
  },

  // 测试和文档
  'tests/': {
    category: '测试文档',
    description: '测试代码',
    details: '单元测试、集成测试和性能测试代码'
  },
  'docs/': {
    category: '测试文档',
    description: '文档',
    details: '项目文档、API文档和使用说明'
  },
  'tlaplus/': {
    category: '测试文档',
    description: 'TLA+规范',
    details: 'TLA+形式化验证规范，用于验证系统的正确性和一致性'
  },

  // 部署配置
  'docker/': {
    category: '部署配置',
    description: 'Docker配置',
    details: 'Docker容器化配置文件和部署脚本'
  },
  'script/': {
    category: '部署配置',
    description: '脚本工具',
    details: '构建、部署和运维脚本'
  },
  'cmake/': {
    category: '部署配置',
    description: 'CMake构建',
    details: 'CMake构建系统配置文件'
  },
  'certs/': {
    category: '部署配置',
    description: '证书文件',
    details: 'SSL/TLS证书和密钥文件'
  }
};

// 获取项目结构
app.get('/api/structure', (req, res) => {
  try {
    const structure = getDirectoryStructure(PROJECT_ROOT);
    res.json(structure);
  } catch (error) {
    console.error('获取项目结构失败:', error);
    res.status(500).json({ error: '获取项目结构失败' });
  }
});

// 搜索文件和内容
app.get('/api/search', (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }
    
    const results = searchFiles(PROJECT_ROOT, query);
    res.json(results);
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 获取文件内容
app.get('/api/file/*', (req, res) => {
  try {
    const filePath = path.join(PROJECT_ROOT, req.params[0]);
    
    // 安全检查：确保文件在项目目录内
    if (!filePath.startsWith(PROJECT_ROOT)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: '这是一个目录，不是文件' });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath);
    
    res.json({
      content,
      path: filePath,
      extension: ext,
      size: stats.size,
      modified: stats.mtime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI代码分析接口
app.post('/api/analyze', async (req, res) => {
  try {
    const { code, filename, action = 'explain' } = req.body;
    
    let prompt = '';
    switch (action) {
      case 'explain':
        prompt = `请详细分析以下代码文件的功能和结构：

文件名: ${filename}
代码内容：
\`\`\`
${code}
\`\`\`

请提供：
1. 文件的主要功能和作用
2. 核心类/函数的说明
3. 与其他模块的关系
4. 代码架构特点
5. 潜在的改进建议

请用中文回答，格式清晰易读。`;
        break;
      case 'review':
        prompt = `请对以下代码进行代码审查：

文件名: ${filename}
代码内容：
\`\`\`
${code}
\`\`\`

请从以下方面进行审查：
1. 代码质量和规范性
2. 潜在的bug和问题
3. 性能优化建议
4. 安全性考虑
5. 可维护性评估

请用中文回答。`;
        break;
      case 'document':
        prompt = `请为以下代码生成详细的技术文档：

文件名: ${filename}
代码内容：
\`\`\`
${code}
\`\`\`

请生成包含以下内容的文档：
1. 模块概述
2. API接口说明
3. 使用示例
4. 依赖关系
5. 配置说明

请用中文回答，使用Markdown格式。`;
        break;
    }
    
    const response = await axios.post(DEEPSEEK_API_URL, {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({
      analysis: response.data.choices[0].message.content
    });
  } catch (error) {
    console.error('AI分析错误:', error.response?.data || error.message);
    res.status(500).json({ 
      error: '分析失败',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// 搜索文件和内容
function searchFiles(dirPath, query, maxResults = 50) {
  const results = [];
  const queryLower = query.toLowerCase();
  
  function searchInDirectory(currentPath, relativePath = '') {
    if (results.length >= maxResults) return;
    
    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        if (results.length >= maxResults) break;
        
        // 跳过隐藏文件、构建目录和node_modules
        if (item.startsWith('.') || item === 'build' || item === 'node_modules' || 
            item === 'web-dashboard' || item.endsWith('.o') || item.endsWith('.so')) {
          continue;
        }
        
        const fullPath = path.join(currentPath, item);
        const relativeItemPath = path.join(relativePath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // 递归搜索子目录
          searchInDirectory(fullPath, relativeItemPath);
        } else if (stat.isFile()) {
          // 检查文件名是否匹配
          const nameMatch = item.toLowerCase().includes(queryLower);
          
          // 检查文件内容是否匹配（只对代码文件）
          let contentMatch = false;
          let preview = '';
          
          if (isCodeFile(item)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n');
              
              // 搜索内容
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(queryLower)) {
                  contentMatch = true;
                  
                  // 创建预览文本（匹配行前后各1行）
                  const startLine = Math.max(0, i - 1);
                  const endLine = Math.min(lines.length - 1, i + 1);
                  const previewLines = lines.slice(startLine, endLine + 1);
                  preview = previewLines.join('\n').slice(0, 200) + '...';
                  break;
                }
              }
            } catch (err) {
              // 忽略读取错误
            }
          }
          
          // 如果文件名或内容匹配，添加到结果
          if (nameMatch || contentMatch) {
            results.push({
              name: item,
              path: relativeItemPath,
              fullPath: fullPath,
              type: nameMatch ? 'filename' : 'content',
              preview: preview || (nameMatch ? '文件名匹配' : '')
            });
          }
        }
      }
    } catch (error) {
      console.error(`搜索目录失败: ${currentPath}`, error);
    }
  }
  
  searchInDirectory(dirPath);
  
  // 按匹配类型排序：文件名匹配优先
  return results.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'filename' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// 判断是否为代码文件
function isCodeFile(filename) {
  const codeExtensions = [
    '.cpp', '.c', '.h', '.hpp', '.cc', '.cxx',
    '.js', '.ts', '.jsx', '.tsx',
    '.py', '.java', '.go', '.rs', '.php',
    '.rb', '.cs', '.swift', '.kt',
    '.html', '.css', '.scss', '.less',
    '.json', '.xml', '.yaml', '.yml',
    '.md', '.txt', '.cmake', '.sh',
    '.sql', '.proto', '.thrift',
    '.actor', '.spec'
  ];
  
  const ext = path.extname(filename).toLowerCase();
  return codeExtensions.includes(ext) || filename === 'Makefile' || filename === 'CMakeLists.txt';
}

// 获取目录结构的递归函数
function getDirectoryStructure(dirPath, relativePath = '') {
  const items = [];
  const categories = {};
  
  try {
    const entries = fs.readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const relPath = path.join(relativePath, entry);
      const stats = fs.statSync(fullPath);
      
      // 跳过一些不需要显示的目录
      if (['.git', 'node_modules', 'build', '.vscode'].includes(entry)) {
        continue;
      }
      
      if (stats.isDirectory()) {
        const dirInfo = PROJECT_STRUCTURE[entry + '/'] || { 
          category: '其他模块',
          description: '模块目录', 
          details: '包含相关功能的源代码文件' 
        };
        
        const dirItem = {
          name: entry,
          type: 'directory',
          path: relPath,
          category: dirInfo.category,
          description: dirInfo.description,
          details: dirInfo.details,
          children: getDirectoryStructure(fullPath, relPath)
        };

        // 按分类组织
        if (!categories[dirInfo.category]) {
          categories[dirInfo.category] = [];
        }
        categories[dirInfo.category].push(dirItem);
      } else {
        items.push({
          name: entry,
          type: 'file',
          path: relPath,
          size: stats.size,
          modified: stats.mtime,
          extension: path.extname(entry)
        });
      }
    }

    // 如果是根目录，按分类组织返回
    if (relativePath === '') {
      const categoryOrder = [
        '协议实现',
        '核心服务', 
        '存储层',
        '安全认证',
        '集群管理',
        '基础设施',
        '工具扩展',
        '测试文档',
        '部署配置',
        '其他模块'
      ];

      const result = [];
      
      categoryOrder.forEach(categoryName => {
        if (categories[categoryName] && categories[categoryName].length > 0) {
          result.push({
            name: categoryName,
            type: 'category',
            path: '',
            description: `${categoryName}相关模块`,
            details: `包含FlowMQ系统中所有${categoryName}相关的组件和功能模块`,
            children: categories[categoryName].sort((a, b) => a.name.localeCompare(b.name))
          });
        }
      });

      // 添加根目录下的文件
      if (items.length > 0) {
        result.push({
          name: '项目文件',
          type: 'category',
          path: '',
          description: '项目根目录文件',
          details: '项目配置文件、构建文件和说明文档',
          children: items.sort((a, b) => a.name.localeCompare(b.name))
        });
      }

      return result;
    } else {
      // 子目录直接返回所有项目
      const allItems = [...Object.values(categories).flat(), ...items];
      return allItems.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    }
  } catch (error) {
    console.error(`读取目录失败: ${dirPath}`, error);
    return [];
  }
}

app.listen(PORT, () => {
  console.log(`FlowMQ代码查看器运行在 http://localhost:${PORT}`);
});
