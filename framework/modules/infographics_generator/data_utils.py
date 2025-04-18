from typing import Dict, List, Tuple
import re
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def process_temporal_data(data: Dict) -> None:
    """处理时间类型的数据"""
    for column in data["data"]["columns"]:
        if column["data_type"] == "temporal":
            for row in data["data"]["data"]:
                value = str(row.get(column["name"], ""))
                
                try:
                    # 处理简单年份格式 (如 "05" 表示 2005)
                    if value.isdigit():
                        if len(value) == 2:
                            row[column["name"]] = f"2000-{value}"  # 使用年份-月份格式
                        else:
                            row[column["name"]] = value  # 保持原样的年份
                        continue
                    
                    # 处理带小数点的年份格式 (如 "2025.1" → "2025-01")
                    if "." in value:
                        year, month = value.split(".")
                        if year.isdigit() and month.isdigit():
                            # 确保月份是两位数
                            month = month.zfill(2)
                            row[column["name"]] = f"{year}-{month}"
                        continue
                    
                    # 处理月份年份组合 (如 "Jul 2025")
                    if " " in value:
                        try:
                            # 尝试解析完整的月份名称
                            date_obj = datetime.strptime(value, "%B %Y")
                        except ValueError:
                            try:
                                # 尝试解析缩写的月份名称
                                date_obj = datetime.strptime(value, "%b %Y")
                            except ValueError:
                                continue
                        
                        # 转换为 "YYYY-MM" 格式
                        row[column["name"]] = date_obj.strftime("%Y-%m")
                        continue
                        
                except Exception as e:
                    logger.warning(f"Failed to parse temporal value '{value}': {str(e)}")
                    continue

def process_numerical_data(data: Dict) -> None:
    """处理数值类型的数据"""
    for column in data["data"]["columns"]:
        if column["data_type"] == "numerical":
            for row in data["data"]["data"]:
                value = row.get(column["name"])
                
                # 处理 null 或 None
                if value is None or value == "null" or value == "":
                    row[column["name"]] = 0
                    continue
                
                # 转换为字符串以进行处理
                value_str = str(value)
                
                # 提取数字（包括负号和小数点）
                numeric_chars = re.findall(r'-?\d*\.?\d+', value_str)
                if numeric_chars:
                    # 使用第一个匹配的数字
                    try:
                        row[column["name"]] = float(numeric_chars[0])
                    except ValueError:
                        row[column["name"]] = 0
                else:
                    row[column["name"]] = 0 

def deduplicate_combinations(data: Dict) -> None:
    """检查并去重temporal和categorical属性的组合
    
    Args:
        data: 包含数据的字典，格式为 {"data": {"columns": [...], "data": [...]}}
    """
    # 找出所有temporal和categorical列
    temporal_categorical_cols = [
        col["name"] for col in data["data"]["columns"]
        if col["data_type"] in ["temporal", "categorical"]
    ]
    
    if not temporal_categorical_cols:
        return
    
    # 用于存储已见过的组合
    seen_combinations = set()
    # 用于存储要保留的行索引
    rows_to_keep = []
    
    # 检查每一行
    for idx, row in enumerate(data["data"]["data"]):
        # 获取当前行的temporal和categorical值组合
        combination = tuple(str(row.get(col, "")) for col in temporal_categorical_cols)
        
        # 如果这个组合还没见过，就保留这行
        if combination not in seen_combinations:
            seen_combinations.add(combination)
            rows_to_keep.append(idx)
    
    # 只保留不重复的行
    data["data"]["data"] = [data["data"]["data"][i] for i in rows_to_keep]
    
    # 记录去重信息
    removed_count = len(data["data"]["data"]) - len(rows_to_keep)
    #if removed_count > 0:
    #    logger.info(f"Removed {removed_count} duplicate combinations of temporal/categorical attributes") 