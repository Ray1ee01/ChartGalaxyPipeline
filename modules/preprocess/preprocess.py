#!/usr/bin/env python3
import json
import logging
from typing import Dict, Any
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("DataFormatUpdater")

# Standard attributes to add to all files
STANDARD_ADDITIONS = {
    "secondary_data": [],
    "variables": {
      "width": 600,
      "height": 600,
      "has_rounded_corners": False,
      "has_shadow": False,
      "has_spacing": False,
      "has_gradient": False,
      "has_stroke": False
    },
    "typography": {
      "title": {
        "font_family": "Arial",
        "font_size": "28px",
        "font_weight": 700
      },
      "description": {
        "font_family": "Arial",
        "font_size": "16px",
        "font_weight": 500
      },
      "label": {
        "font_family": "Arial",
        "font_size": "16px",
        "font_weight": 500
      },
      "annotation": {
        "font_family": "Arial",
        "font_size": "12px",
        "font_weight": 400
      }
    }
}
from typing import Dict, List, Tuple
import re
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def process_temporal_data(data: Dict) -> None:
    """处理时间类型的数据"""
    for column in data["data"]["columns"]:
        if column["data_type"] == "temporal":
            has_valid_temporal = False
            for row in data["data"]["data"]:
                value = str(row.get(column["name"], ""))
                
                try:
                    if value.isdigit():
                        if len(value) == 4:
                            has_valid_temporal = True
                            continue
                        else:
                            has_valid_temporal = False
                            break
                    
                    if "." in value:
                        parts = value.split(".")
                        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                            year, month = parts
                            month = month.zfill(2)
                            row[column["name"]] = f"{year}-{month}"
                            has_valid_temporal = True
                        elif len(parts) == 3 and all(part.isdigit() for part in parts):
                            year, month, day = parts
                            month = month.zfill(2)
                            day = day.zfill(2)
                            row[column["name"]] = f"{year}-{month}-{day}"
                            has_valid_temporal = True
                        else:
                            continue
                        continue
                    
                    if " " in value:
                        try:
                            # 尝试解析完整的月份名称
                            date_obj = datetime.strptime(value, "%B %Y")
                        except ValueError:
                            try:
                                # 尝试解析缩写的月份名称
                                date_obj = datetime.strptime(value, "%b %Y")
                            except ValueError:
                                # 尝试其他常见格式
                                try:
                                    # 处理 "YYYY-MM" 或 "YYYY/MM" 格式
                                    if "-" in value or "/" in value:
                                        separator = "-" if "-" in value else "/"
                                        parts = value.split(separator)
                                        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                                            year = parts[0]
                                            month = parts[1].zfill(2)
                                            row[column["name"]] = f"{year}-{month}"
                                            has_valid_temporal = True
                                            continue
                                except Exception:
                                    continue
                                continue
                        
                        # 转换为 "YYYY-MM" 格式
                        row[column["name"]] = date_obj.strftime("%Y-%m")
                        has_valid_temporal = True
                        continue
                        
                except Exception as e:
                    logger.warning(f"Failed to parse temporal value '{value}': {str(e)}")
                    continue
            
            # 如果没有找到任何有效的时间数据，将类型改为categorical
            if not has_valid_temporal:
                column["data_type"] = "categorical"
                data["data"]["type_combination"] = " + ".join([col["data_type"] for col in data["data"]["columns"]])
                logger.info(f"Changed column '{column['name']}' from temporal to categorical due to invalid temporal data")

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
def remove_unnecessary_fields(data: Any) -> Any:
    """
    Recursively remove unnecessary fields from any level of the data structure
    """
    unnecessary_fields = {
        "discarded_data_points",
        "missing_percentage",
        "zero_percentage",
        "transformed_columns"
    }
    
    if isinstance(data, dict):
        return {
            k: remove_unnecessary_fields(v)
            for k, v in data.items()
            if k not in unnecessary_fields
        }
    elif isinstance(data, list):
        return [remove_unnecessary_fields(item) for item in data]
    else:
        return data

def update_data_format(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update the data format to match the new requirements
    """
    # First, remove unnecessary fields at all levels
    updated_data = remove_unnecessary_fields(data.copy())
    
    # Extract columns and data from the nested structure
    if "data" in updated_data and "data" in updated_data["data"] and "columns" in updated_data["data"]:
        pass
    else:
        columns = updated_data["columns"]
        data = updated_data["data"]
        updated_data["data"] = {
            "data": data,
            "columns": columns
        }
        del updated_data["columns"]

    try:
        if "title" in updated_data and "description" in updated_data and "main_insight" in updated_data:
            title = updated_data["title"]
            description = updated_data["description"]
            main_insight = updated_data["main_insight"]
            updated_data["metadata"] = {
                "title": title,
                "description": description,
                "main_insight": main_insight
            }
        elif "description" in updated_data and "titles" in updated_data and "main_title" in updated_data["titles"]:
            description = updated_data["description"]
            main_title = updated_data["titles"]["main_title"]
            main_insight = updated_data["metadata"]["main_insight"]
            datafact = updated_data["metadata"]["datafact"]
            updated_data["metadata"] = {
                "title": main_title,
                "description": description,
                "main_insight": main_insight,
                "datafact": datafact
            }
    except Exception as e:
        pass
    
    if "data" in updated_data and "type_combinations" in updated_data["data"]:
        updated_data["data"]["type_combination"] = updated_data["data"]["type_combinations"]
        del updated_data["data"]["type_combinations"]
    # Add standard attributes
    for key, value in STANDARD_ADDITIONS.items():
        if key not in updated_data:
            updated_data[key] = value
    
    return updated_data

def process(input: str, output: str = None) -> None:
    """
    Pipeline入口函数，处理单个文件的数据预处理
    
    Args:
        input (str): 输入JSON文件路径
        output (str): 输出JSON文件路径，如果为None则原地修改输入文件
    """
    try:
        # 如果没有指定输出路径，则原地修改
        if output is None:
            output = input
            
        logger.info(f"处理文件: {input}")
        
        # 检查是否需要处理
        if Path(output).exists():
            with open(output) as f:
                data = json.load(f)
                #if "metadata" in data and "data" in data and "variables" in data and "processed" in data:
                #    logger.info(f"跳过处理: {output} 已包含必要字段")
                #    return
        
        # 读取输入数据
        with open(input, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 更新数据格式
        updated_data = update_data_format(data)
        
        # 处理时间类型数据
        process_temporal_data(updated_data)
        
        # 处理数值类型数据
        process_numerical_data(updated_data)
        
        # 去重temporal和categorical属性的组合
        deduplicate_combinations(updated_data)
        updated_data["processed"] = True
        
        # 保存更新后的数据
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(updated_data, f, indent=2, ensure_ascii=False)
            
        logger.info(f"处理完成: {output}")
            
    except Exception as e:
        logger.error(f"处理失败: {str(e)}")
        raise 