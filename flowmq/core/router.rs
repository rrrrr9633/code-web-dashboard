// FlowMQ 核心路由引擎
// 负责不同协议间的消息路由和转换

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::mpsc;
use serde::{Serialize, Deserialize};

/// 消息协议类型
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Protocol {
    AMQP,
    MQTT,
    Kafka,
    NATS,
    HTTP,
}

/// 通用消息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub protocol: Protocol,
    pub topic: String,
    pub payload: Vec<u8>,
    pub headers: HashMap<String, String>,
    pub timestamp: u64,
    pub qos: u8,
    pub retain: bool,
}

/// 路由规则
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteRule {
    pub id: String,
    pub source_protocol: Protocol,
    pub target_protocols: Vec<Protocol>,
    pub topic_pattern: String,
    pub transformation: Option<String>,
    pub enabled: bool,
}

/// 消息路由器
pub struct MessageRouter {
    rules: Arc<RwLock<Vec<RouteRule>>>,
    protocol_handlers: HashMap<Protocol, mpsc::UnboundedSender<Message>>,
    metrics: Arc<RwLock<RouterMetrics>>,
}

/// 路由器指标
#[derive(Debug, Default)]
pub struct RouterMetrics {
    pub messages_routed: u64,
    pub messages_dropped: u64,
    pub protocol_stats: HashMap<Protocol, ProtocolStats>,
}

#[derive(Debug, Default)]
pub struct ProtocolStats {
    pub messages_in: u64,
    pub messages_out: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub errors: u64,
}

impl MessageRouter {
    /// 创建新的消息路由器
    pub fn new() -> Self {
        Self {
            rules: Arc::new(RwLock::new(Vec::new())),
            protocol_handlers: HashMap::new(),
            metrics: Arc::new(RwLock::new(RouterMetrics::default())),
        }
    }

    /// 注册协议处理器
    pub fn register_protocol_handler(
        &mut self,
        protocol: Protocol,
        sender: mpsc::UnboundedSender<Message>,
    ) {
        self.protocol_handlers.insert(protocol, sender);
        
        // 初始化协议统计
        let mut metrics = self.metrics.write().unwrap();
        metrics.protocol_stats.insert(protocol, ProtocolStats::default());
    }

    /// 添加路由规则
    pub fn add_route_rule(&self, rule: RouteRule) -> Result<(), RouterError> {
        let mut rules = self.rules.write()
            .map_err(|_| RouterError::LockError("Failed to acquire write lock".into()))?;
        
        // 检查规则ID是否已存在
        if rules.iter().any(|r| r.id == rule.id) {
            return Err(RouterError::DuplicateRule(rule.id));
        }
        
        rules.push(rule);
        Ok(())
    }

    /// 移除路由规则
    pub fn remove_route_rule(&self, rule_id: &str) -> Result<(), RouterError> {
        let mut rules = self.rules.write()
            .map_err(|_| RouterError::LockError("Failed to acquire write lock".into()))?;
        
        let initial_len = rules.len();
        rules.retain(|r| r.id != rule_id);
        
        if rules.len() == initial_len {
            return Err(RouterError::RuleNotFound(rule_id.into()));
        }
        
        Ok(())
    }

    /// 路由消息
    pub async fn route_message(&self, message: Message) -> Result<(), RouterError> {
        // 更新输入统计
        self.update_input_stats(&message);
        
        let rules = self.rules.read()
            .map_err(|_| RouterError::LockError("Failed to acquire read lock".into()))?;
        
        let mut routed = false;
        
        // 应用匹配的路由规则
        for rule in rules.iter() {
            if !rule.enabled {
                continue;
            }
            
            if rule.source_protocol == message.protocol 
                && self.topic_matches(&message.topic, &rule.topic_pattern) {
                
                // 路由到目标协议
                for target_protocol in &rule.target_protocols {
                    if let Some(handler) = self.protocol_handlers.get(target_protocol) {
                        let mut routed_message = message.clone();
                        
                        // 应用转换（如果有）
                        if let Some(transformation) = &rule.transformation {
                            routed_message = self.apply_transformation(routed_message, transformation)?;
                        }
                        
                        // 发送到目标协议处理器
                        if let Err(e) = handler.send(routed_message) {
                            eprintln!("Failed to route message to {}: {:?}", 
                                target_protocol, e);
                            self.update_error_stats(target_protocol);
                        } else {
                            self.update_output_stats(target_protocol, &message);
                            routed = true;
                        }
                    }
                }
            }
        }
        
        // 更新路由统计
        let mut metrics = self.metrics.write()
            .map_err(|_| RouterError::LockError("Failed to acquire metrics lock".into()))?;
        
        if routed {
            metrics.messages_routed += 1;
        } else {
            metrics.messages_dropped += 1;
        }
        
        Ok(())
    }

    /// 检查主题是否匹配模式
    fn topic_matches(&self, topic: &str, pattern: &str) -> bool {
        // 简单的通配符匹配实现
        if pattern == "*" {
            return true;
        }
        
        if pattern.contains('*') {
            // 实现更复杂的通配符匹配
            let pattern_parts: Vec<&str> = pattern.split('*').collect();
            if pattern_parts.len() == 2 {
                let prefix = pattern_parts[0];
                let suffix = pattern_parts[1];
                return topic.starts_with(prefix) && topic.ends_with(suffix);
            }
        }
        
        topic == pattern
    }

    /// 应用消息转换
    fn apply_transformation(&self, mut message: Message, transformation: &str) -> Result<Message, RouterError> {
        match transformation {
            "to_json" => {
                // 将二进制负载转换为JSON
                let json_payload = format!("{{\"data\": \"{}\"}}", 
                    base64::encode(&message.payload));
                message.payload = json_payload.into_bytes();
                message.headers.insert("content-type".into(), "application/json".into());
            },
            "add_timestamp" => {
                // 添加时间戳头部
                message.headers.insert("processed_at".into(), 
                    chrono::Utc::now().timestamp().to_string());
            },
            "compress" => {
                // 压缩负载（简化示例）
                message.payload = compress_data(&message.payload)?;
                message.headers.insert("content-encoding".into(), "gzip".into());
            },
            _ => {
                return Err(RouterError::InvalidTransformation(transformation.into()));
            }
        }
        
        Ok(message)
    }

    /// 更新输入统计
    fn update_input_stats(&self, message: &Message) {
        if let Ok(mut metrics) = self.metrics.write() {
            if let Some(stats) = metrics.protocol_stats.get_mut(&message.protocol) {
                stats.messages_in += 1;
                stats.bytes_in += message.payload.len() as u64;
            }
        }
    }

    /// 更新输出统计
    fn update_output_stats(&self, protocol: &Protocol, message: &Message) {
        if let Ok(mut metrics) = self.metrics.write() {
            if let Some(stats) = metrics.protocol_stats.get_mut(protocol) {
                stats.messages_out += 1;
                stats.bytes_out += message.payload.len() as u64;
            }
        }
    }

    /// 更新错误统计
    fn update_error_stats(&self, protocol: &Protocol) {
        if let Ok(mut metrics) = self.metrics.write() {
            if let Some(stats) = metrics.protocol_stats.get_mut(protocol) {
                stats.errors += 1;
            }
        }
    }

    /// 获取路由器指标
    pub fn get_metrics(&self) -> Result<RouterMetrics, RouterError> {
        self.metrics.read()
            .map_err(|_| RouterError::LockError("Failed to acquire metrics read lock".into()))
            .map(|metrics| metrics.clone())
    }
}

/// 路由器错误类型
#[derive(Debug, thiserror::Error)]
pub enum RouterError {
    #[error("Lock error: {0}")]
    LockError(String),
    
    #[error("Duplicate rule ID: {0}")]
    DuplicateRule(String),
    
    #[error("Rule not found: {0}")]
    RuleNotFound(String),
    
    #[error("Invalid transformation: {0}")]
    InvalidTransformation(String),
    
    #[error("Compression error: {0}")]
    CompressionError(String),
}

/// 压缩数据（简化实现）
fn compress_data(data: &[u8]) -> Result<Vec<u8>, RouterError> {
    // 这里应该使用实际的压缩算法，如gzip
    // 为了简化，我们只是返回原始数据
    Ok(data.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_message_routing() {
        let mut router = MessageRouter::new();
        
        // 创建测试通道
        let (tx, mut rx) = mpsc::unbounded_channel();
        router.register_protocol_handler(Protocol::MQTT, tx);
        
        // 添加路由规则
        let rule = RouteRule {
            id: "test_rule".into(),
            source_protocol: Protocol::AMQP,
            target_protocols: vec![Protocol::MQTT],
            topic_pattern: "test/*".into(),
            transformation: None,
            enabled: true,
        };
        
        router.add_route_rule(rule).unwrap();
        
        // 创建测试消息
        let message = Message {
            id: "test_msg".into(),
            protocol: Protocol::AMQP,
            topic: "test/topic".into(),
            payload: b"Hello, World!".to_vec(),
            headers: HashMap::new(),
            timestamp: 0,
            qos: 0,
            retain: false,
        };
        
        // 路由消息
        router.route_message(message).await.unwrap();
        
        // 验证消息被路由
        let routed_message = rx.recv().await.unwrap();
        assert_eq!(routed_message.topic, "test/topic");
        assert_eq!(routed_message.payload, b"Hello, World!");
    }
}
