"""
MQTT协议实现 - 消息处理器

负责MQTT消息的编解码、路由和分发
"""

import struct
import logging
from enum import IntEnum
from typing import Dict, List, Optional, Callable

logger = logging.getLogger(__name__)

class MQTTMessageType(IntEnum):
    """MQTT消息类型"""
    CONNECT = 1
    CONNACK = 2
    PUBLISH = 3
    PUBACK = 4
    PUBREC = 5
    PUBREL = 6
    PUBCOMP = 7
    SUBSCRIBE = 8
    SUBACK = 9
    UNSUBSCRIBE = 10
    UNSUBACK = 11
    PINGREQ = 12
    PINGRESP = 13
    DISCONNECT = 14

class QoSLevel(IntEnum):
    """MQTT QoS级别"""
    AT_MOST_ONCE = 0    # 最多一次
    AT_LEAST_ONCE = 1   # 至少一次  
    EXACTLY_ONCE = 2    # 恰好一次

class MQTTMessage:
    """MQTT消息对象"""
    
    def __init__(self, message_type: MQTTMessageType, payload: bytes = b''):
        self.message_type = message_type
        self.payload = payload
        self.qos = QoSLevel.AT_MOST_ONCE
        self.retain = False
        self.dup = False
        self.packet_id = None
        
    def __repr__(self):
        return f"MQTTMessage(type={self.message_type.name}, qos={self.qos}, len={len(self.payload)})"

class MQTTPacketCodec:
    """MQTT数据包编解码器"""
    
    @staticmethod
    def encode_message(message: MQTTMessage) -> bytes:
        """将MQTT消息编码为字节流"""
        # 固定头部
        fixed_header = bytearray()
        
        # 消息类型和标志位
        type_flags = (message.message_type.value << 4)
        if message.dup:
            type_flags |= 0x08
        type_flags |= (message.qos.value << 1)
        if message.retain:
            type_flags |= 0x01
            
        fixed_header.append(type_flags)
        
        # 剩余长度编码
        remaining_length = len(message.payload)
        if message.packet_id is not None:
            remaining_length += 2
            
        length_bytes = MQTTPacketCodec._encode_remaining_length(remaining_length)
        fixed_header.extend(length_bytes)
        
        # 可变头部
        variable_header = bytearray()
        if message.packet_id is not None:
            variable_header.extend(struct.pack('>H', message.packet_id))
            
        # 组装完整数据包
        packet = bytes(fixed_header) + bytes(variable_header) + message.payload
        return packet
    
    @staticmethod
    def decode_message(data: bytes) -> Optional[MQTTMessage]:
        """从字节流解码MQTT消息"""
        if len(data) < 2:
            return None
            
        # 解析固定头部
        type_flags = data[0]
        message_type = MQTTMessageType((type_flags >> 4) & 0x0F)
        
        # 解析剩余长度
        remaining_length, length_bytes = MQTTPacketCodec._decode_remaining_length(data[1:])
        if remaining_length is None:
            return None
            
        header_length = 1 + length_bytes
        total_length = header_length + remaining_length
        
        if len(data) < total_length:
            return None
            
        # 创建消息对象
        message = MQTTMessage(message_type)
        message.dup = bool(type_flags & 0x08)
        message.qos = QoSLevel((type_flags >> 1) & 0x03)
        message.retain = bool(type_flags & 0x01)
        
        # 解析可变头部和负载
        variable_header_start = header_length
        payload_start = variable_header_start
        
        # 某些消息类型包含包标识符
        if message_type in [MQTTMessageType.PUBACK, MQTTMessageType.PUBREC, 
                           MQTTMessageType.PUBREL, MQTTMessageType.PUBCOMP]:
            if remaining_length >= 2:
                message.packet_id = struct.unpack('>H', data[variable_header_start:variable_header_start+2])[0]
                payload_start += 2
                
        # 提取负载
        message.payload = data[payload_start:total_length]
        
        return message
    
    @staticmethod
    def _encode_remaining_length(length: int) -> bytes:
        """编码MQTT剩余长度字段"""
        result = bytearray()
        while True:
            byte = length % 128
            length //= 128
            if length > 0:
                byte |= 0x80
            result.append(byte)
            if length == 0:
                break
        return bytes(result)
    
    @staticmethod
    def _decode_remaining_length(data: bytes) -> tuple:
        """解码MQTT剩余长度字段"""
        multiplier = 1
        length = 0
        index = 0
        
        while index < len(data):
            byte = data[index]
            length += (byte & 0x7F) * multiplier
            
            if (byte & 0x80) == 0:
                return length, index + 1
                
            multiplier *= 128
            if multiplier > 128 * 128 * 128:
                return None, 0
            index += 1
            
        return None, 0

class MQTTBroker:
    """MQTT消息代理"""
    
    def __init__(self):
        self.clients: Dict[str, 'MQTTClient'] = {}
        self.subscriptions: Dict[str, List['MQTTClient']] = {}
        self.retained_messages: Dict[str, MQTTMessage] = {}
        
    def add_client(self, client_id: str, client: 'MQTTClient'):
        """添加客户端"""
        self.clients[client_id] = client
        logger.info(f"客户端 {client_id} 已连接")
        
    def remove_client(self, client_id: str):
        """移除客户端"""
        if client_id in self.clients:
            del self.clients[client_id]
            # 清理订阅
            for topic, subscribers in self.subscriptions.items():
                subscribers[:] = [c for c in subscribers if c.client_id != client_id]
            logger.info(f"客户端 {client_id} 已断开")
            
    def subscribe(self, client: 'MQTTClient', topic: str, qos: QoSLevel):
        """客户端订阅主题"""
        if topic not in self.subscriptions:
            self.subscriptions[topic] = []
        
        # 避免重复订阅
        if client not in self.subscriptions[topic]:
            self.subscriptions[topic].append(client)
            
        logger.info(f"客户端 {client.client_id} 订阅主题: {topic} (QoS {qos})")
        
        # 发送保留消息
        if topic in self.retained_messages:
            client.send_message(self.retained_messages[topic])
            
    def publish(self, topic: str, message: MQTTMessage):
        """发布消息到主题"""
        logger.info(f"发布消息到主题: {topic}")
        
        # 保存保留消息
        if message.retain:
            self.retained_messages[topic] = message
            
        # 分发给订阅者
        if topic in self.subscriptions:
            for client in self.subscriptions[topic]:
                try:
                    client.send_message(message)
                except Exception as e:
                    logger.error(f"向客户端 {client.client_id} 发送消息失败: {e}")
                    
    def get_statistics(self) -> Dict:
        """获取代理统计信息"""
        return {
            'clients': len(self.clients),
            'subscriptions': sum(len(subs) for subs in self.subscriptions.values()),
            'topics': len(self.subscriptions),
            'retained_messages': len(self.retained_messages)
        }
