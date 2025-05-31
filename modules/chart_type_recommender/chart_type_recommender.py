#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
图表类型推荐模块 (chart_type_recommender)
基于输入数据特征，自动推荐最合适的图表类型
"""

import json
import logging
import argparse
from typing import Dict, List, Any, Tuple

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 支持的图表类型
CHART_TYPES = [
    "vertical_bar_chart",
    "horizontal_bar_chart",
    "vertical_stacked_bar_chart",
    "horizontal_stacked_bar_chart",
    "grouped_bar_chart",
    "line_chart",
    "area_chart",
    "pie_chart",
    "donut_chart",
    "scatter_plot",
    "bubble_chart",
    "heatmap"
]

def analyze_data_structure(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    分析数据结构，提取关键特征
    
    Args:
        data: 输入数据对象
        
    Returns:
        包含数据特征的字典
    """
    features = {}
    
    # 提取列信息
    columns = data.get("data", {}).get("columns", [])
    features["column_count"] = len(columns)
    
    # 分析列类型
    time_columns = []
    number_columns = []
    categorical_columns = []
    
    for col in columns:
        data_type = col.get("data_type", "")
        if data_type == "time":
            time_columns.append(col["name"])
        elif data_type == "number":
            number_columns.append(col["name"])
        elif data_type == "categorical":
            categorical_columns.append(col["name"])
    
    features["time_columns"] = time_columns
    features["number_columns"] = number_columns
    features["categorical_columns"] = categorical_columns
    
    # 分析数据行数
    rows = data.get("data", {}).get("data", [])
    features["row_count"] = len(rows)
    
    return features

def recommend_chart_types(data_features: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    基于数据特征推荐合适的图表类型
    
    Args:
        data_features: 数据特征字典
        
    Returns:
        推荐的图表类型列表，按置信度排序
    """
    recommendations = []
    
    # 检查基本条件
    has_time = len(data_features["time_columns"]) > 0
    has_number = len(data_features["number_columns"]) > 0
    has_category = len(data_features["categorical_columns"]) > 0
    
    # 时间序列分析
    if has_time and has_number:
        if has_category:
            # 具有分类的时间序列，推荐堆叠图和分组柱状图
            recommendations.append({
                "type": "vertical_stacked_bar_chart",
                "confidence": 0.92,
                "reasoning": "适合比较不同时间段内多个类别的分布情况，同时展示总量变化趋势"
            })
            
            recommendations.append({
                "type": "grouped_bar_chart",
                "confidence": 0.75,
                "reasoning": "适合清晰对比不同时期内各类别的具体数值"
            })
            
            recommendations.append({
                "type": "area_chart",
                "confidence": 0.68,
                "reasoning": "适合展示不同类别随时间的变化趋势和累积效应"
            })
        else:
            # 简单时间序列，推荐折线图和柱状图
            recommendations.append({
                "type": "line_chart",
                "confidence": 0.88,
                "reasoning": "适合展示连续时间序列的趋势变化"
            })
            
            recommendations.append({
                "type": "vertical_bar_chart",
                "confidence": 0.75,
                "reasoning": "适合比较不同时间点的数值大小"
            })
    
    # 分类比较
    elif has_category and has_number and not has_time:
        recommendations.append({
            "type": "horizontal_bar_chart",
            "confidence": 0.85,
            "reasoning": "适合比较不同类别的数值大小"
        })
        
        if len(data_features["categorical_columns"]) > 1:
            recommendations.append({
                "type": "heatmap",
                "confidence": 0.72,
                "reasoning": "适合展示两个分类变量之间的关系和数值分布"
            })
        else:
            recommendations.append({
                "type": "Pie Chart",
                "confidence": 0.65,
                "reasoning": "适合展示不同类别的占比情况"
            })
    
    # 如果没有匹配的推荐，提供默认选项
    if not recommendations:
        recommendations.append({
            "type": "vertical_bar_chart",
            "confidence": 0.60,
            "reasoning": "通用图表类型，适合大多数数据展示需求"
        })
    
    return recommendations

def process(input: str, output: str) -> bool:
    """
    处理输入数据并生成图表类型推荐
    
    Args:
        input: 输入JSON文件路径
        output: 输出JSON文件路径
        
    Returns:
        处理成功返回True，否则返回False
    """
    try:
        # 读取输入数据
        logger.info(f"读取输入文件: {input}")
        with open(input, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 分析数据特征
        logger.info("分析数据结构和特征")
        data_features = analyze_data_structure(data)
        
        # 生成图表类型推荐
        logger.info("生成图表类型推荐")
        chart_type_recommendations = recommend_chart_types(data_features)
        
        # 添加推荐结果到原始数据
        data["chart_type"] = chart_type_recommendations
        
        # 写入输出文件
        logger.info(f"写入输出文件: {output}")
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info("图表类型推荐完成")
        return True
        
    except Exception as e:
        logger.error(f"处理失败: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ChartPipeline - 图表类型推荐模块")
    parser.add_argument("--input", required=True, help="输入JSON文件路径")
    parser.add_argument("--output", required=True, help="输出JSON文件路径")
    
    args = parser.parse_args()
    
    process(input=args.input, output=args.output) 