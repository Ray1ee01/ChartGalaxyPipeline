import os
import json
import argparse
from PIL import Image

def filter_annotations(annotations_file, image_dir, output_file):
    """
    过滤标注数据
    
    参数:
    annotations_file: 原始标注文件的路径
    image_dir: 图片所在的目录
    output_file: 输出结果的文件路径
    """
    print(f"开始过滤标注数据...")
    print(f"原始标注文件: {annotations_file}")
    print(f"图片目录: {image_dir}")
    print(f"输出文件: {output_file}")
    
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
    
    # 过滤图片和标注
    filtered_images = []
    filtered_annotations = []
    removed_image_count = 0
    removed_annotation_count = 0
    only_chart_count = 0
    
    # 遍历所有图片
    for image_id, annotations in annotation_map.items():
        # 获取图片信息
        image_info = image_map[image_id]
        image_path = os.path.join(image_dir, image_info['file_name'])
        
        # 检查图片是否存在
        if not os.path.exists(image_path):
            print(f"警告: 图片不存在 {image_path}，跳过")
            removed_image_count += 1
            continue
        
        # 计算类别2（chart）的标注数量
        chart_count = sum(1 for ann in annotations if ann['category_id'] == 2)
        
        # 如果chart标注不为1，跳过这张图片 
        if chart_count != 1:
            print(f"图片 {image_id} 包含 {chart_count} 个chart标注，已移除")
            removed_image_count += 1
            continue
        
        # 获取图片尺寸
        try:
            with Image.open(image_path) as img:
                img_width, img_height = img.size
                img_area = img_width * img_height
        except Exception as e:
            print(f"无法打开图片 {image_path}: {e}，跳过")
            removed_image_count += 1
            continue
        
        # 过滤小于图片面积1/64的类型1标注
        valid_annotations = []
        for ann in annotations:
            # 如果是类型1（visual element）
            if ann['category_id'] == 1:
                bbox = ann['bbox']  # [x, y, width, height]
                bbox_area = bbox[2] * bbox[3]
                
                # 如果标注面积小于图片面积的1/64，跳过
                if bbox_area < (img_area / 64):
                    print(f"图片 {image_id} 中的标注 {ann['id']} 面积过小，已移除")
                    removed_annotation_count += 1
                    continue
            
            valid_annotations.append(ann)
        
        # 如果图片没有任何有效标注，跳过
        if not valid_annotations:
            print(f"图片 {image_id} 没有有效标注，已移除")
            removed_image_count += 1
            continue
            
        # 如果图片只有一个chart标注，则计数+1
        if len(valid_annotations) == 1 and valid_annotations[0]['category_id'] == 2:
            only_chart_count += 1
            removed_image_count += 1
            continue
        
        # 添加有效图片和标注
        filtered_images.append(image_info)
        filtered_annotations.extend(valid_annotations)
    
    # 创建过滤后的数据
    filtered_data = {
        "images": filtered_images,
        "annotations": filtered_annotations,
        "categories": data['categories']  # 保持类别不变
    }
    
    # 保存过滤后的数据
    with open(output_file, 'w') as f:
        json.dump(filtered_data, f, indent=2)
    
    # 打印统计信息
    print("\n过滤完成!")
    print(f"原始图片数量: {len(data['images'])}")
    print(f"过滤后图片数量: {len(filtered_images)}")
    print(f"移除的图片数量: {removed_image_count}")
    print(f"原始标注数量: {len(data['annotations'])}")
    print(f"过滤后标注数量: {len(filtered_annotations)}")
    print(f"移除的标注数量: {removed_annotation_count}")
    print(f"只有一个chart标注的图片数量: {only_chart_count}")
    print(f"过滤后的标注已保存到: {output_file}")
    
if __name__ == "__main__":
    # 设置命令行参数
    parser = argparse.ArgumentParser(description='过滤COCO格式的标注数据')
    parser.add_argument('--annotations', type=str, default="./data/annotations.json",
                        help='输入标注文件路径')
    parser.add_argument('--image_dir', type=str, default="./data",
                        help='图片目录路径')
    parser.add_argument('--output', type=str, default="./data/filtered_annotations.json",
                        help='输出标注文件路径')
    
    args = parser.parse_args()
    
    # 执行过滤
    filter_annotations(args.annotations, args.image_dir, args.output)