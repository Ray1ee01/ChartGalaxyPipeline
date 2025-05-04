import os
import json
import argparse
import re

def filter_annotations_by_output_files(annotations_file, output_dir, new_output_file):
    """
    根据输出目录中的文件列表过滤标注数据
    
    参数:
    annotations_file: 原始标注文件的路径
    output_dir: 包含已处理图片的目录（形如 annotated_{id}.png）
    new_output_file: 新的输出标注文件路径
    """
    print(f"开始根据输出文件过滤标注数据...")
    print(f"原始标注文件: {annotations_file}")
    print(f"输出目录: {output_dir}")
    print(f"新输出文件: {new_output_file}")
    
    # 加载标注文件
    with open(annotations_file, 'r') as f:
        data = json.load(f)
    
    # 获取输出目录中的文件列表
    output_files = os.listdir(output_dir)
    
    # 提取文件名中的图片ID
    image_ids = set()
    pattern = re.compile(r'annotated_(\d+)\.png')
    
    for filename in output_files:
        match = pattern.match(filename)
        if match:
            image_id = int(match.group(1))
            image_ids.add(image_id)
    
    print(f"在输出目录中找到 {len(image_ids)} 个图片ID")
    
    # 创建图片ID到图片信息的映射
    image_map = {img['id']: img for img in data['images']}
    
    # 过滤图片和标注
    filtered_images = []
    filtered_annotations = []
    
    # 过滤图片
    for image_id in image_ids:
        if image_id in image_map:
            filtered_images.append(image_map[image_id])
    
    # 过滤标注
    for ann in data['annotations']:
        if ann['image_id'] in image_ids:
            filtered_annotations.append(ann)
    
    # 创建过滤后的数据
    filtered_data = {
        "images": filtered_images,
        "annotations": filtered_annotations,
        "categories": data['categories']  # 保持类别不变
    }
    
    # 保存过滤后的数据
    with open(new_output_file, 'w') as f:
        json.dump(filtered_data, f, indent=2)
    
    # 打印统计信息
    print("\n过滤完成!")
    print(f"原始图片数量: {len(data['images'])}")
    print(f"过滤后图片数量: {len(filtered_images)}")
    print(f"原始标注数量: {len(data['annotations'])}")
    print(f"过滤后标注数量: {len(filtered_annotations)}")
    print(f"过滤后的标注已保存到: {new_output_file}")

def main():
    # 设置命令行参数
    parser = argparse.ArgumentParser(description='根据输出文件过滤COCO格式的标注数据')
    parser.add_argument('--annotations', type=str, default="./data/filtered_annotations.json",
                        help='输入标注文件路径')
    parser.add_argument('--output_dir', type=str, default="./output_filtered2",
                        help='包含已处理图片的目录')
    parser.add_argument('--new_output', type=str, default="./data/filtered2_annotations.json",
                        help='新的输出标注文件路径')
    
    args = parser.parse_args()
    
    # 执行过滤
    filter_annotations_by_output_files(args.annotations, args.output_dir, args.new_output)

if __name__ == "__main__":
    main()