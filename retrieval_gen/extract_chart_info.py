import os
import json
import base64
from PIL import Image
import io
import argparse
from openai import OpenAI
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

client_key = 'sk-149DmKTCIvVQbbgk9099Bf51Ef2d4009A1B09c22246823F9'
base_url = 'https://aihubmix.com/v1'

# 配置OpenAI客户端
model_name = "gpt-4o"

client = OpenAI(
    api_key=client_key,
    base_url=base_url
)

def encode_image(image_path):
    """将图像编码为base64字符串"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def get_image_dimensions(image_path):
    """获取图像尺寸"""
    with Image.open(image_path) as img:
        return img.width, img.height

def query_llm_for_metadata(image_path):
    """使用LLM获取图表的元数据（描述和主题）"""
    base64_image = encode_image(image_path)
    
    prompt = """
    Please analyze this chart and provide the following information:
    1. A detailed description of the chart (including chart type, main content, data representation method, etc.)
    2. The topic or domain of the chart (e.g., economics, health, education, etc.)
    3. The color theme of the chart (light or dark)
    
    Please return in JSON format as follows:
    {
        "description": "detailed description...",
        "topic": "topic or domain",
        "color_theme": "color theme"
    }
    """
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ],
                }
            ]
        )
        
        # 解析JSON响应
        content = response.choices[0].message.content
        # 提取JSON部分
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = content[json_start:json_end]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                print(f"无法解析JSON: {json_str}")
                return {"description": "解析错误", "topic": "未知"}
        else:
            print(f"未找到JSON格式的响应: {content}")
            return {"description": "格式错误", "topic": "未知"}
            
    except Exception as e:
        print(f"查询LLM时出错: {e}")
        return {"description": "API错误", "topic": "未知"}

def query_llm_for_element_description(crop_path, category_id):
    """使用LLM获取裁剪后的图表元素的描述"""
    base64_image = encode_image(crop_path)
    
    element_type = "visual element" if category_id == 1 else "data chart" if category_id == 2 else "title"
    
    prompt = f"""
    Please analyze this {element_type} and provide a detailed description including:
    1. What it is (chart type, image content, etc.)
    2. Its role or the information it conveys in the overall chart
    
    Please provide a concise description, no more than 100 words.
    """
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ],
                }
            ]
        )
        
        # 获取响应文本
        description = response.choices[0].message.content.strip()
        return description
            
    except Exception as e:
        print(f"查询LLM时出错: {e}")
        return "描述获取失败"

def crop_image_by_bbox(image_path, bbox, output_path):
    """根据边界框裁剪图像"""
    try:
        with Image.open(image_path) as img:
            x, y, w, h = bbox
            cropped_img = img.crop((x, y, x+w, y+h))
            cropped_img.save(output_path)
            return True
    except Exception as e:
        print(f"裁剪图像时出错: {e}")
        return False

def extract_chart_info(annotations_file, image_dir, output_dir):
    """提取图表信息并保存为JSON文件"""
    # 创建输出目录
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"创建输出目录: {output_dir}")
    
    # 创建裁剪图像的目录
    crops_dir = os.path.join(output_dir, "crops")
    if not os.path.exists(crops_dir):
        os.makedirs(crops_dir)
    
    # 加载标注文件
    with open(annotations_file, 'r') as f:
        data = json.load(f)
    
    # 创建图片ID到图片信息的映射
    image_map = {img['id']: img for img in data['images']}
    
    # 创建图片ID到标注的映射
    annotation_map = {}
    for ann in data['annotations']:
        image_id = ann['image_id']
        if image_id not in annotation_map:
            annotation_map[image_id] = []
        annotation_map[image_id].append(ann)
    
    # 获取有标注的图片ID列表
    image_ids_with_annotations = list(annotation_map.keys())
    
    # 为每张图片处理信息
    results = []

    image_ids_with_annotations = [882]
    
    for image_id in image_ids_with_annotations:
        print(f"处理图片ID: {image_id}")
        
        # 获取图片信息
        image_info = image_map[image_id]
        image_path = os.path.join(image_dir, image_info['file_name'])
        
        # 检查图片是否存在
        if not os.path.exists(image_path):
            print(f"警告: 图片不存在 {image_path}")
            continue
        
        # 获取图片尺寸
        img_width, img_height = get_image_dimensions(image_path)
        
        # 获取图表元数据
        metadata = query_llm_for_metadata(image_path)
        
        # 获取图片的标注
        annotations = annotation_map[image_id]
        
        # 处理每个标注
        layout = []
        for i, ann in enumerate(annotations):
            bbox = ann['bbox']  # [x, y, width, height]
            category_id = ann['category_id']
            
            # 裁剪图像
            crop_filename = f"crop_{image_id}_{i}_{category_id}.jpg"
            crop_path = os.path.join(crops_dir, crop_filename)
            crop_success = crop_image_by_bbox(image_path, bbox, crop_path)
            
            if not crop_success:
                print(f"裁剪失败，跳过元素 {i}")
                continue
            
            # 获取元素描述 - 使用裁剪后的图像
            description = query_llm_for_element_description(crop_path, category_id)
            
            # 添加到布局
            layout.append({
                "bbox": bbox,
                "category_id": category_id,
                "description": description,
                "crop_path": os.path.join("crops", crop_filename)
            })
        
        # 创建结果对象
        result = {
            "image_id": image_id,
            "file_name": image_info['file_name'],
            "width": img_width,
            "height": img_height,
            "metadata": metadata,
            "layout": layout
        }
        
        results.append(result)
        
        # 保存单个图片的结果
        output_file = os.path.join(output_dir, f"chart_info_{image_id}.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"已保存图表信息: {output_file}")
    
    # 保存所有结果
    all_results_file = os.path.join(output_dir, "all_charts_info.json")
    with open(all_results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"已保存所有图表信息: {all_results_file}")
    
    return results

def visualize_with_descriptions(chart_info, output_dir):
    """可视化图表及其描述"""
    image_id = chart_info["image_id"]
    file_name = chart_info["file_name"]
    image_path = os.path.join("./data/realworld_test", file_name)
    
    # 检查图片是否存在
    if not os.path.exists(image_path):
        print(f"警告: 图片不存在 {image_path}")
        return
    
    # 加载图片
    try:
        img = Image.open(image_path)
        img_array = np.array(img)
    except Exception as e:
        print(f"无法加载图片 {image_path}: {e}")
        return
    
    # 为不同类别定义不同的颜色
    category_colors = {
        1: 'blue',  # 视觉元素
        2: 'green',  # 数据图表
    }
    
    # 创建图形
    fig, ax = plt.subplots(1, figsize=(16, 16))
    ax.imshow(img_array)
    
    # 添加元数据到标题
    title = f"ID: {image_id} - {chart_info['metadata']['topic']}\n{chart_info['metadata']['description'][:100]}..."
    ax.set_title(title, fontsize=12, wrap=True)
    
    # 为每个布局元素绘制边界框和描述
    for i, element in enumerate(chart_info["layout"]):
        bbox = element["bbox"]  # [x, y, width, height]
        category_id = element["category_id"]
        description = element["description"]
        
        # 获取类别对应的颜色
        color = category_colors.get(category_id, 'red')
        
        # 创建矩形
        rect = patches.Rectangle(
            (bbox[0], bbox[1]), bbox[2], bbox[3],
            linewidth=3, edgecolor=color, facecolor='none'
        )
        
        # 添加矩形到图形
        ax.add_patch(rect)
        
        # 添加元素编号
        ax.text(
            bbox[0] + 5, bbox[1] + 20,
            f"#{i+1}",
            color='white', fontsize=14, weight='bold',
            bbox=dict(facecolor=color, alpha=0.7)
        )
    
    # 关闭坐标轴
    ax.axis('off')
    
    # 保存图形
    output_path = os.path.join(output_dir, f"annotated_with_desc_{image_id}.jpg")
    plt.tight_layout()
    plt.savefig(output_path, bbox_inches='tight')
    plt.close()
    
    # 创建描述图
    fig, ax = plt.subplots(1, figsize=(12, len(chart_info["layout"]) * 1.5 + 2))
    ax.axis('off')
    
    # 添加元数据
    ax.text(0.5, 0.98, "图表元数据", fontsize=16, weight='bold', ha='center', transform=ax.transAxes)
    ax.text(0.5, 0.95, f"主题: {chart_info['metadata']['topic']}", fontsize=14, ha='center', transform=ax.transAxes)
    ax.text(0.5, 0.92, f"描述: {chart_info['metadata']['description']}", fontsize=12, ha='center', wrap=True, transform=ax.transAxes)
    
    # 添加元素描述
    ax.text(0.5, 0.87, "布局元素描述", fontsize=16, weight='bold', ha='center', transform=ax.transAxes)
    
    for i, element in enumerate(chart_info["layout"]):
        category_id = element["category_id"]
        description = element["description"]
        color = category_colors.get(category_id, 'red')
        
        element_type = "视觉元素" if category_id == 1 else "数据图表"
        y_pos = 0.85 - (i * 0.08)
        
        ax.text(
            0.1, y_pos,
            f"#{i+1} ({element_type}):",
            fontsize=14, weight='bold', color=color
        )
        ax.text(
            0.25, y_pos,
            description,
            fontsize=12, wrap=True
        )
    
    # 保存描述图
    desc_output_path = os.path.join(output_dir, f"descriptions_{image_id}.jpg")
    plt.tight_layout()
    plt.savefig(desc_output_path, bbox_inches='tight')
    plt.close()
    
    print(f"已保存可视化结果: {output_path} 和 {desc_output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='提取图表信息并保存为JSON')
    parser.add_argument('--annotations', default='./data/title_annotations.json', help='标注文件路径')
    parser.add_argument('--image_dir', default='./data/', help='图片目录')
    parser.add_argument('--output_dir', default='./output_info', help='输出目录')
    parser.add_argument('--visualize', action='store_true', help='是否生成可视化结果')
    
    args = parser.parse_args()
    
    # 提取图表信息
    results = extract_chart_info(args.annotations, args.image_dir, args.output_dir)
    
    # 可视化结果
    # if args.visualize:
    #     for chart_info in results:
    #         visualize_with_descriptions(chart_info, args.output_dir)
    
    print("完成!") 