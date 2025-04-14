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
                if "metadata" in data and "data" in data and "variables" in data:
                    logger.info(f"跳过处理: {output} 已包含必要字段")
                    return
        
        # 读取输入数据
        with open(input, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 更新数据格式
        updated_data = update_data_format(data)
        
        # 保存更新后的数据
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(updated_data, f, indent=2, ensure_ascii=False)
            
        logger.info(f"处理完成: {output}")
            
    except Exception as e:
        logger.error(f"处理失败: {str(e)}")
        raise 