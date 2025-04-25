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

Old Layout Description: {old_layout_str}
New Data Column Info: {column_info_str}
New Table Data:
{formatted_table}

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
        "description": "New Description",
        }},
        {{
        "bbox": [
            161.4,
            158.75,
            756.5,
            1149.55
        ],
        "category_id": 1,
        "description": "A image for chart decoration. This image is ...",
        }},
        {{
        "bbox": [
            105.0,
            45.0,
            874.0,
            104.0
        ],
        "category_id": 3,
        "description": New Title",
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
            return result
        except json.JSONDecodeError:
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

def generate_new_images_in_layout(new_layout):
    """Generate new images using LLM"""
    # Create output directory
    output_dir = "generated_images"
    os.makedirs(output_dir, exist_ok=True)
    
    for element in new_layout:
        if element['category_id'] == 1:
            description = element['description']
            # Generate new image using LLM
            prompt = description
            try:
                # 调用API生成图片
                response = client.chat.completions.create(
                    model="gemini-2.0-flash-exp",
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    modalities=["text", "image"]
                )
                
                # 从响应中提取图片数据
                image_data = None
                if (hasattr(response.choices[0].message, "multi_mod_content") and 
                    response.choices[0].message.multi_mod_content is not None):
                    for part in response.choices[0].message.multi_mod_content:
                        if "inline_data" in part and part["inline_data"] is not None:
                            image_data = part["inline_data"]["data"]
                            break
                
                if image_data is None:
                    raise Exception("未能从响应中获取图片数据")
                    
                # 解码base64并保存为PNG
                image_bytes = base64.b64decode(image_data)
                image_path = os.path.join(output_dir, f"visual_element_{uuid.uuid4()}.png")
                
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                    
                # Add image path to element
                element["image_path"] = image_path
                
            except Exception as e:
                print(f"Error generating image: {e}")
                element["image_path"] = None
            
    return new_layout

def create_new_layout(raw_data, annotations, old_layout, image_info, text_category_id, output_dir):
    """为指定的图片创建新的布局描述"""
    image_id = image_info['id']
    file_name = image_info['file_name']
    
    # 获取图片的所有标注
    image_annotations = get_image_annotation(annotations, image_id)
    
    # 提取表格数据和列信息
    table_data = extract_table_data(raw_data)
    column_info = extract_column_info(raw_data)
    
    # 使用LLM生成新内容
    new_content = generate_new_content_with_llm(image_annotations, table_data, column_info, old_layout)
    new_layout = new_content.get("new_layout", [])
    new_layout = generate_new_images_in_layout(new_layout)
    
    # 创建新的布局描述
    new_layout = {
        "image_id": image_id,
        "file_name": file_name,
        "new_layout": new_layout,
        "raw_data": {
            "table_data": table_data,
            "columns": column_info
        }
    }
    
    # 保存新布局
    output_path = os.path.join(output_dir, f"layout_{image_id}.json")
    save_json_file(new_layout, output_path)
    
    return output_path

def process_data_files(table_data_file, annotations_file, old_layout_folder, output_dir, limit=None):
    """处理数据文件，为每个图片生成新的布局"""
    # 加载表格数据文件路径列表
    table_data_paths = load_json_file(table_data_file)
    
    # 加载标注文件
    annotations_data = load_json_file(annotations_file)
    annotations = annotations_data.get('annotations', [])
    images = annotations_data.get('images', [])
    
    # 获取文本类别ID
    text_category_id = 3  # 假设文本类别ID为3
    
    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    
    # 处理每个表格数据文件
    results = []
    processed_count = 0
    
    # 如果有限制，随机选择图片
    if limit and limit < len(images):
        selected_images = random.sample(images, limit)
    else:
        selected_images = images

    # test, select image with id 12
    selected_images = [image for image in selected_images if image['id'] == 12]
    
    for image_info in tqdm(selected_images, desc="处理图片"):
        # 随机选择一个表格数据文件
        raw_data_path = random.choice(table_data_paths)
        
        # test, select first table data
        raw_data_path = table_data_paths[0]
        
        try:
            # 加载原始数据
            raw_data = load_json_file(raw_data_path)
            old_layout = load_json_file(os.path.join(old_layout_folder, f"chart_info_{image_info['id']}.json"))
            
            # 创建新布局
            output_path = create_new_layout(raw_data, annotations, old_layout, image_info, text_category_id, output_dir)
            
            processed_count += 1
            
            # 添加短暂延迟，避免API限制
            time.sleep(0.5)
            
        except Exception as e:
            print(f"处理图片 {image_info['id']} 时出错: {e}")
    

def main():
    parser = argparse.ArgumentParser(description='生成新的图表布局描述')
    parser.add_argument('--table_data', type=str, default='data/table_data.json',
                        help='表格数据文件路径列表')
    parser.add_argument('--annotations', type=str, default='data/title_annotations.json',
                        help='标注文件路径')
    parser.add_argument('--old_layout', type=str, default='./output_info/',
                        help='旧布局文件路径')
    parser.add_argument('--output_dir', type=str, default='./output_generated',
                        help='输出目录')
    parser.add_argument('--limit', type=int, default=None,
                        help='处理的图片数量限制')
    
    args = parser.parse_args()
    
    # 处理数据文件
    process_data_files(args.table_data, args.annotations, args.old_layout, args.output_dir, args.limit)

if __name__ == "__main__":
    main() 