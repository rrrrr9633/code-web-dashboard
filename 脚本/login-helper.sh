#!/bin/bash

# 代码可视化仪表板 - 登录测试工具
# 帮助用户快速完成首次登录设置

echo "🔐 代码可视化仪表板 - 登录助手"
echo "=================================="

# 检查应用是否在运行
check_app() {
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ 应用正在运行"
        return 0
    else
        echo "❌ 应用未运行"
        return 1
    fi
}

# 创建测试用户
create_test_user() {
    echo "🔧 正在创建测试用户..."
    
    local response=$(curl -s -X POST http://localhost:3000/api/register \
        -H "Content-Type: application/json" \
        -d '{
            "username": "testuser",
            "password": "123456"
        }')
    
    if echo "$response" | grep -q "注册成功\|用户名已存在"; then
        echo "✅ 测试用户创建成功"
        echo "   用户名: testuser"
        echo "   密码: 123456"
        return 0
    else
        echo "⚠️ 用户可能已存在: $response"
        return 0
    fi
}

# 测试登录
test_login() {
    echo "🔑 测试登录..."
    
    local response=$(curl -s -X POST http://localhost:3000/api/login \
        -H "Content-Type: application/json" \
        -d '{
            "username": "testuser",
            "password": "123456",
            "aiConfig": {
                "apiUrl": "https://api.deepseek.com/v1/chat/completions",
                "apiKey": "sk-test-key-for-demo"
            }
        }')
    
    if echo "$response" | grep -q "token"; then
        echo "✅ 登录测试成功"
        local token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        echo "   会话令牌: ${token:0:20}..."
        return 0
    else
        echo "❌ 登录测试失败: $response"
        return 1
    fi
}

# 主流程
main() {
    echo "正在检查应用状态..."
    
    if ! check_app; then
        echo ""
        echo "💡 请先启动应用："
        echo "   ./build.sh          # 选择 5) 开发模式"
        echo "   或"
        echo "   npm run electron-dev # 直接启动"
        echo "   或"
        echo "   ./dist/代码可视化仪表板-1.0.0.AppImage  # 运行打包版本"
        exit 1
    fi
    
    echo ""
    create_test_user
    
    echo ""
    test_login
    
    echo ""
    echo "🎉 登录助手完成！"
    echo ""
    echo "📝 登录信息："
    echo "   🌐 访问地址: http://localhost:3000"
    echo "   👤 用户名: testuser"
    echo "   🔑 密码: 123456"
    echo ""
    echo "🤖 AI 配置说明："
    echo "   - 首次登录需要配置 AI API"
    echo "   - 可以使用任意 API URL 和 Key 进行测试"
    echo "   - 如需真实 AI 功能，请使用有效的 DeepSeek/OpenAI 密钥"
    echo ""
    echo "🚀 使用步骤："
    echo "   1. 打开浏览器访问 http://localhost:3000"
    echo "   2. 点击登录，输入上述用户名密码"
    echo "   3. 配置 AI 服务（可暂时跳过）"
    echo "   4. 开始使用代码可视化功能"
}

main "$@"
