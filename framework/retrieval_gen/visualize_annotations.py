import os
import json
import random
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image
import numpy as np

def visualize_annotations(annotations_file, image_dir, output_dir):
    """
    可视化标注框并保存结果
    
    参数:
    annotations_file: 标注文件的路径
    image_dir: 图片所在的目录
    output_dir: 输出结果的目录
    num_samples: 要可视化的随机样本数量
    """
    # 创建输出目录（如果不存在）
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"创建输出目录: {output_dir}")
    
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
    image_ids_with_annotations = image_ids_with_annotations[30:]
    
    # 为不同类别定义不同的颜色
    category_colors = {
        1: 'blue',
        2: 'green',
        3: 'red',
        # 可以为更多类别添加颜色
    }
    
    # 可视化每张选定的图片及其标注
    for i, image_id in enumerate(image_ids_with_annotations):
        # 获取图片信息
        image_info = image_map[image_id]
        image_path = os.path.join(image_dir, image_info['file_name'])
        
        # 检查图片是否存在
        if not os.path.exists(image_path):
            print(f"警告: 图片不存在 {image_path}")
            continue
        
        # 加载图片
        try:
            img = Image.open(image_path)
            img_array = np.array(img)
        except Exception as e:
            print(f"无法加载图片 {image_path}: {e}")
            continue
        
        # 创建图形
        fig, ax = plt.subplots(1, figsize=(12, 12))
        ax.imshow(img_array)
        
        # 获取图片的标注
        annotations = annotation_map[image_id]
        
        # 为每个标注绘制边界框
        for ann in annotations:
            bbox = ann['bbox']  # [x, y, width, height]
            category_id = ann['category_id']
            
            # 获取类别对应的颜色，如果没有定义则使用红色
            color = category_colors.get(category_id, 'red')
            
            # 创建矩形
            rect = patches.Rectangle(
                (bbox[0], bbox[1]), bbox[2], bbox[3],
                linewidth=3, edgecolor=color, facecolor='none'
            )
            
            # 添加矩形到图形
            ax.add_patch(rect)
            
            # 不再添加类别标签文本
        
        # 设置图形标题
        ax.set_title(f"Image ID: {image_id}, File: {os.path.basename(image_info['file_name'])}")
        
        # 关闭坐标轴
        ax.axis('off')
        
        # 保存图形
        output_path = os.path.join(output_dir, f"annotated_{image_id}.png")
        plt.tight_layout()
        plt.savefig(output_path, bbox_inches='tight')
        plt.close()
        
        print(f"已保存标注图片: {output_path}")

if __name__ == "__main__":
    # 设置路径
    image_dir = "./data"  # 图片在realworld_test文件夹下
    annotations_file = "./data/title_annotations.json"
    output_dir = "./output_title_annotations"
    # annotations_file = "./data/text_annotations.json"
    # output_dir = "./output_text_annotations"
    
    # 可视化标注
    visualize_annotations(annotations_file, image_dir, output_dir)
    print("完成!") 