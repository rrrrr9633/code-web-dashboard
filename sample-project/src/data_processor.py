#!/usr/bin/env python3
"""
数据处理工具模块

提供常用的数据处理和分析功能
"""

import json
import csv
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataProcessor:
    """数据处理器类"""
    
    def __init__(self, config: Optional[Dict] = None):
        """
        初始化数据处理器
        
        Args:
            config: 配置字典
        """
        self.config = config or {}
        self.data_cache = {}
        logger.info("数据处理器初始化完成")
    
    def load_json(self, file_path: str) -> Dict[str, Any]:
        """
        加载JSON文件
        
        Args:
            file_path: JSON文件路径
            
        Returns:
            解析后的数据字典
            
        Raises:
            FileNotFoundError: 文件不存在
            json.JSONDecodeError: JSON格式错误
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            logger.info(f"成功加载JSON文件: {file_path}")
            return data
            
        except FileNotFoundError:
            logger.error(f"文件不存在: {file_path}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"JSON格式错误: {e}")
            raise
    
    def save_json(self, data: Dict[str, Any], file_path: str) -> None:
        """
        保存数据为JSON文件
        
        Args:
            data: 要保存的数据
            file_path: 保存路径
        """
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"数据已保存到: {file_path}")
            
        except Exception as e:
            logger.error(f"保存JSON文件失败: {e}")
            raise
    
    def load_csv(self, file_path: str) -> List[Dict[str, str]]:
        """
        加载CSV文件
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            数据列表，每行为一个字典
        """
        try:
            data = []
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                data = list(reader)
            
            logger.info(f"成功加载CSV文件: {file_path}, 共{len(data)}行")
            return data
            
        except Exception as e:
            logger.error(f"加载CSV文件失败: {e}")
            raise
    
    def filter_data(self, data: List[Dict], filters: Dict[str, Any]) -> List[Dict]:
        """
        过滤数据
        
        Args:
            data: 原始数据列表
            filters: 过滤条件字典
            
        Returns:
            过滤后的数据
        """
        filtered_data = []
        
        for item in data:
            match = True
            for key, value in filters.items():
                if key not in item or item[key] != value:
                    match = False
                    break
            
            if match:
                filtered_data.append(item)
        
        logger.info(f"数据过滤完成: {len(data)} -> {len(filtered_data)}")
        return filtered_data
    
    def aggregate_data(self, data: List[Dict], group_by: str, 
                      agg_field: str, agg_func: str = 'sum') -> Dict[str, float]:
        """
        数据聚合
        
        Args:
            data: 数据列表
            group_by: 分组字段
            agg_field: 聚合字段
            agg_func: 聚合函数 ('sum', 'avg', 'count')
            
        Returns:
            聚合结果字典
        """
        groups = {}
        
        # 分组
        for item in data:
            group_key = item.get(group_by)
            if group_key not in groups:
                groups[group_key] = []
            groups[group_key].append(item)
        
        # 聚合
        result = {}
        for group_key, group_data in groups.items():
            if agg_func == 'count':
                result[group_key] = len(group_data)
            elif agg_func == 'sum':
                values = [float(item.get(agg_field, 0)) for item in group_data]
                result[group_key] = sum(values)
            elif agg_func == 'avg':
                values = [float(item.get(agg_field, 0)) for item in group_data]
                result[group_key] = sum(values) / len(values) if values else 0
        
        logger.info(f"数据聚合完成: {len(groups)}个分组")
        return result
    
    def validate_data(self, data: List[Dict], schema: Dict[str, type]) -> List[str]:
        """
        数据验证
        
        Args:
            data: 待验证的数据
            schema: 数据模式定义
            
        Returns:
            验证错误列表
        """
        errors = []
        
        for i, item in enumerate(data):
            for field, expected_type in schema.items():
                if field not in item:
                    errors.append(f"第{i+1}行缺少字段: {field}")
                    continue
                
                try:
                    if expected_type == int:
                        int(item[field])
                    elif expected_type == float:
                        float(item[field])
                    elif expected_type == str:
                        str(item[field])
                except (ValueError, TypeError):
                    errors.append(f"第{i+1}行字段{field}类型错误，期望{expected_type.__name__}")
        
        logger.info(f"数据验证完成: {len(errors)}个错误")
        return errors

def main():
    """主函数示例"""
    processor = DataProcessor()
    
    # 示例：处理一些示例数据
    sample_data = [
        {"name": "Alice", "age": "25", "city": "北京", "salary": "8000"},
        {"name": "Bob", "age": "30", "city": "上海", "salary": "12000"},
        {"name": "Charlie", "age": "28", "city": "北京", "salary": "10000"},
    ]
    
    # 数据验证
    schema = {"name": str, "age": int, "city": str, "salary": float}
    errors = processor.validate_data(sample_data, schema)
    if errors:
        print("数据验证错误:")
        for error in errors:
            print(f"  - {error}")
    
    # 数据过滤
    beijing_data = processor.filter_data(sample_data, {"city": "北京"})
    print(f"北京员工数量: {len(beijing_data)}")
    
    # 数据聚合
    city_counts = processor.aggregate_data(sample_data, "city", "", "count")
    print(f"各城市人数: {city_counts}")
    
    avg_salary = processor.aggregate_data(sample_data, "city", "salary", "avg")
    print(f"各城市平均薪资: {avg_salary}")

if __name__ == "__main__":
    main()
