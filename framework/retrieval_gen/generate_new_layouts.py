import os
import json
import argparse
import random
import time
from pathlib import Path
import numpy as np
from tqdm import tqdm
from openai import OpenAI
import base64
import uuid

client_key = 'sk-149DmKTCIvVQbbgk9099Bf51Ef2d4009A1B09c22246823F9'
base_url = 'https://aihubmix.com/v1'

# 配置OpenAI客户端
model_name = "gpt-4o"

client = OpenAI(
    api_key=client_key,
    base_url=base_url
)

def load_json_file(file_path):
    """加载JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json_file(data, file_path):
    """保存JSON文件"""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_image_annotation(annotations, image_id):
    """获取指定图片的标注信息"""
    return [ann for ann in annotations if ann['image_id'] == image_id]

def get_text_annotation(annotations, image_id, text_category_id):
    """获取指定图片的文本标注"""
    for ann in annotations:
        if ann['image_id'] == image_id and ann['category_id'] == text_category_id:
            return ann
    return None

def extract_table_data(raw_data):
    """从原始数据中提取表格数据"""
    return raw_data['data']['data']

def extract_column_info(raw_data):
    """从原始数据中提取列信息"""
    return raw_data['data']['columns']

def format_table_for_prompt(table_data, column_info):
    """将表格数据格式化为适合提示的文本"""
    if not table_data or not column_info:
        return "无可用的表格数据"
    
    # 格式化表头
    header = " | ".join(col['name'] for col in column_info)
    separator = "-" * len(header)
    
    # 格式化表格行
    rows = []
    for row in table_data:
        # 如果行是字典格式，按列名提取值
        row_values = [str(row.get(col['name'], "")) for col in column_info]
        rows.append(" | ".join(row_values))
    
    # 组合成表格文本
    table_text = f"{header}\n{separator}\n" + "\n".join(rows)
    return table_text

def generate_new_content_with_llm(original_annotations, table_data, column_info, old_layout):
    """使用LLM生成新的内容"""
    # 格式化表格数据
    formatted_table = format_table_for_prompt(table_data, column_info)
    column_info_str = json.dumps(column_info)
    old_layout_str = json.dumps(old_layout)

    # 构建提示
    prompt = f"""
You are a data visualization expert. You are given a table data and an old layout description.
Please generate new chart titles and descriptions based on the following table data.
Do not change the original bbox and category_id.
category_id=1 is for image, category_id=2 is for chart, category_id=3 is for title.
New title should be concise and informative, and should not be longer than 5 words.
The new chart description should describe the chart type. The chart type should be the same as the old layout and do not describe the data and color.

Old Layout Description: {old_layout_str}
New Data Column Info: {column_info_str}
New Table Data: {formatted_table}

Please return in JSON format with the following fields: new_layout, start with {{ and end with }}, do not start with ```json
Example:
{{
    "new_layout": [
        {{
        "bbox": [
            15.2,
            161.87,
            903.21,
            1139.77
        ],
        "category_id": 2,
        "chart_description": "New Chart Description"
        }},
        {{
        "bbox": [
            161.4,
            158.75,
            756.5,
            1149.55
        ],
        "category_id": 1,
        "image_description": "A image for chart decoration. This image is ..."
        }},
        {{
        "bbox": [
            105.0,
            45.0,
            874.0,
            104.0
        ],
        "category_id": 3,
        "title": "New Title"
        }}
    ]
}}
"""

    try:
        print(prompt)

        # 调用OpenAI API
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a data visualization expert. You are given a table data and an old layout description. Please generate new chart titles and descriptions based on the following table data."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        # 解析响应
        content = response.choices[0].message.content.strip()
        print("#########################")
        print(content)
        # 尝试解析JSON
        try:
            result = json.loads(content)
            print(f"result: {result}")
            return result
        except json.JSONDecodeError:
            print(f"json.JSONDecodeError: {content}")
            result = {
                "new_layout": []
            }
            return result
            
    except Exception as e:
        print(f"调用LLM时出错: {e}")
        # 返回默认值
        return {
            "new_layout": []
        }

def create_new_layout(raw_data, annotations, old_layout, output_path):
    """为指定的图片创建新的布局描述"""
    image_id = old_layout['image_id']
    file_name = old_layout['file_name']
    
    # 获取图片的所有标注
    image_annotations = get_image_annotation(annotations, image_id)
    
    # 提取表格数据和列信息
    table_data = extract_table_data(raw_data)
    column_info = extract_column_info(raw_data)
    
    # 使用LLM生成新内容
    new_content = generate_new_content_with_llm(image_annotations, table_data, column_info, old_layout)
    print(f"new_content: {new_content}")
    new_layout = new_content.get("new_layout", [])
    
    # 创建新的布局描述
    new_layout = {
        "image_id": image_id,
        "file_name": file_name,
        "new_layout": new_layout,
        "width": old_layout['width'],
        "height": old_layout['height'],
        "raw_data": {
            "table_data": table_data,
            "columns": column_info
        }
    }
    
    save_json_file(new_layout, output_path)

def process_data_file(raw_data_path, old_layout_path, annotations_file, output_path):
    """处理数据文件，为图片生成新的布局"""
    # 加载标注文件
    annotations_data = load_json_file(annotations_file)
    annotations = annotations_data.get('annotations', [])

    # 加载原始数据
    raw_data = load_json_file(raw_data_path)
    old_layout = load_json_file(old_layout_path)
    create_new_layout(raw_data, annotations, old_layout, output_path)