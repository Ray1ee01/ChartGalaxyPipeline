import os
import json
import argparse
import numpy as np
from shapely.geometry import Polygon, box as shapely_box

def calculate_overlap(box1, box2):
    """
    计算两个框的重叠程度
    
    参数:
    box1, box2: 两个框的坐标 [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
    
    返回:
    重叠面积占较小框面积的比例
    """
    # 转换为Shapely多边形
    poly1 = Polygon(box1)
    poly2 = Polygon(box2)
    
    if not poly1.intersects(poly2):
        return 0
    
    # 计算重叠面积
    intersection_area = poly1.intersection(poly2).area
    
    # 计算较小框的面积
    area1 = poly1.area
    area2 = poly2.area
    smaller_area = min(area1, area2)
    
    if smaller_area == 0:
        return 0
    
    # 返回重叠比例
    return intersection_area / smaller_area

def is_same_line(box1, box2, tolerance=0.1):
    """
    判断两个框是否在同一行
    
    参数:
    box1, box2: 两个框的坐标
    tolerance: 高度差异容忍度（相对于平均高度）
    
    返回:
    是否在同一行
    """
    # 计算两个框的中心点y坐标
    y1_coords = [p[1] for p in box1]
    y2_coords = [p[1] for p in box2]
    
    box1_center_y = sum(y1_coords) / len(y1_coords)
    box2_center_y = sum(y2_coords) / len(y2_coords)
    
    # 计算两个框的高度
    box1_height = max(y1_coords) - min(y1_coords)
    box2_height = max(y2_coords) - min(y2_coords)
    
    # 计算平均高度
    avg_height = (box1_height + box2_height) / 2
    
    # 计算水平距离
    x1_coords = [p[0] for p in box1]
    x2_coords = [p[0] for p in box2]
    box1_max_x = max(x1_coords)
    box1_min_x = min(x1_coords)
    box2_max_x = max(x2_coords)
    box2_min_x = min(x2_coords)
    
    # 计算两种情况下的水平距离
    distance1 = abs(box2_min_x - box1_max_x)  # box1在左,box2在右
    distance2 = abs(box1_min_x - box2_max_x)  # box2在左,box1在右
    
    # 判断中心点y坐标差异是否小于容忍度且任一水平距离小于10
    return (abs(box1_center_y - box2_center_y) < avg_height * tolerance and 
            (distance1 < 50 or distance2 < 50))

def is_same_column(box1, box2, tolerance=0.7):
    """
    判断两个框是否在同一列
    
    参数:
    box1, box2: 两个框的坐标
    tolerance: x范围交集的阈值(默认0.7,即70%)
    
    返回:
    是否在同一列
    """
    # 获取两个框的x范围
    x1_min = min(p[0] for p in box1)
    x1_max = max(p[0] for p in box1)
    x2_min = min(p[0] for p in box2)
    x2_max = max(p[0] for p in box2)
    
    # 计算x范围的交集
    intersection = max(0, min(x1_max, x2_max) - max(x1_min, x2_min))
    
    # 计算两个框x范围的长度
    width1 = x1_max - x1_min
    width2 = x2_max - x2_min
    
    # 计算交集占较小宽度的比例
    if min(width1, width2) == 0:
        return False
        
    overlap_ratio = intersection / min(width1, width2)
    
    # 计算垂直距离
    y1_coords = [p[1] for p in box1]
    y2_coords = [p[1] for p in box2]
    box1_max_y = max(y1_coords)
    box1_min_y = min(y1_coords)
    box2_max_y = max(y2_coords)
    box2_min_y = min(y2_coords)
    
    vertical_distance = min(abs(box2_min_y - box1_max_y), abs(box1_min_y - box2_max_y))
    
    return overlap_ratio > tolerance and vertical_distance < 50

def is_height_similar(box1, box2, tolerance=0.1):
    """
    判断两个框的高度是否相似
    
    参数:
    box1, box2: 两个框的坐标
    tolerance: 高度差异容忍度
    
    返回:
    高度是否相似
    """
    # 计算两个框的高度
    y1_coords = [p[1] for p in box1]
    y2_coords = [p[1] for p in box2]
    
    box1_height = max(y1_coords) - min(y1_coords)
    box2_height = max(y2_coords) - min(y2_coords)
    
    # 计算高度差异比例
    if max(box1_height, box2_height) == 0:
        return False
    
    height_diff_ratio = abs(box1_height - box2_height) / max(box1_height, box2_height)
    
    return height_diff_ratio <= tolerance

def should_merge(box1, box2, text1, text2):
    """
    判断两个文本框是否应该合并
    
    参数:
    box1, box2: 两个框的坐标
    text1, text2: 两个框的文本内容
    
    返回:
    是否应该合并
    """
    # 规则1: 如果两个框重叠，直接合并
    overlap_ratio = calculate_overlap(box1, box2)
    if overlap_ratio > 0:  # 重叠面积超过1%
        return True
    
    # 规则2: 如果高度相差不超过10%，并且在同一行或同一列，则合并
    if is_height_similar(box1, box2, 0.3) and (is_same_line(box1, box2) or is_same_column(box1, box2)):
        return True
    
    return False

def merge_boxes(box1, box2):
    """
    合并两个框
    
    参数:
    box1, box2: 两个框的坐标
    
    返回:
    合并后的框坐标
    """
    # 合并所有点，找出最小外接矩形
    all_points = box1 + box2
    x_coords = [p[0] for p in all_points]
    y_coords = [p[1] for p in all_points]
    
    min_x, max_x = min(x_coords), max(x_coords)
    min_y, max_y = min(y_coords), max(y_coords)
    
    # 返回新的矩形框
    return [[min_x, min_y], [max_x, min_y], [max_x, max_y], [min_x, max_y]]

def merge_text_regions(text_regions):
    """
    合并文本区域
    
    参数:
    text_regions: 文本区域列表，每个元素包含'box'和'text'
    
    返回:
    合并后的文本区域列表
    """
    if not text_regions:
        return []
    
    # 复制一份，避免修改原始数据
    regions = text_regions.copy()
    
    # 合并过程
    merged = True
    while merged:
        merged = False
        i = 0
        while i < len(regions):
            j = i + 1
            while j < len(regions):
                if should_merge(regions[i]['box'], regions[j]['box'], 
                               regions[i]['text'], regions[j]['text']):
                    # 合并框
                    merged_box = merge_boxes(regions[i]['box'], regions[j]['box'])
                    
                    # 合并文本
                    merged_text = regions[i]['text'] + " " + regions[j]['text']
                    
                    # 计算新面积
                    x_coords = [p[0] for p in merged_box]
                    y_coords = [p[1] for p in merged_box]
                    area = (max(x_coords) - min(x_coords)) * (max(y_coords) - min(y_coords))
                    
                    # 更新区域i
                    regions[i] = {
                        'box': merged_box,
                        'text': merged_text,
                        'area': area,
                        'confidence': max(regions[i].get('confidence', 0), regions[j].get('confidence', 0))
                    }
                    
                    # 删除区域j
                    regions.pop(j)
                    
                    merged = True
                else:
                    j += 1
            i += 1
    
    return regions

def find_title_region(text_regions):
    """
    从合并后的文本区域中找出最可能的标题
    
    参数:
    text_regions: 合并后的文本区域列表
    min_area: 最小面积阈值，过滤掉太小的区域
    
    返回:
    最可能的标题区域
    """
    if not text_regions:
        return None
    
    # 按面积排序，找出最大的区域
    largest_region = max(text_regions, key=lambda r: r['area'])
    
    return largest_region

def process_annotations(annotations_file, new_output_file):
    """
    处理标注文件，合并文本框并提取标题
    
    参数:
    annotations_file: 输入标注文件路径
    new_output_file: 输出标注文件路径
    """
    print(f"开始处理标注文件...")
    print(f"输入文件: {annotations_file}")
    print(f"输出文件: {new_output_file}")
    
    # 加载标注文件
    with open(annotations_file, 'r') as f:
        data = json.load(f)
    
    # 获取文本类别ID
    text_category_id = 3
    
    # 获取最大的annotation id
    max_ann_id = max([ann['id'] for ann in data['annotations']]) if data['annotations'] else 0
    
    # 按图片ID分组标注
    annotations_by_image = {}
    for ann in data['annotations']:
        if ann['category_id'] == text_category_id:
            image_id = ann['image_id']
            if image_id not in annotations_by_image:
                annotations_by_image[image_id] = []
            annotations_by_image[image_id].append(ann)
    
    # 处理每张图片的文本标注
    new_annotations = []
    processed_count = 0
    title_found_count = 0
    
    for image_id, annotations in annotations_by_image.items():
        # 提取文本区域
        text_regions = []
        for ann in annotations:
            # 从分割坐标中提取框
            segmentation = ann['segmentation'][0]
            box = []
            for i in range(0, len(segmentation), 2):
                box.append([segmentation[i], segmentation[i+1]])
            
            text_regions.append({
                'box': box,
                'text': ann.get('text', ''),
                'area': ann['area'],
                'confidence': ann.get('confidence', 0),
                'original_ann': ann
            })
        
        # 按高度对文本区域进行排序
        for region in text_regions:
            box = region['box']
            y_coords = [p[1] for p in box]
            height = max(y_coords) - min(y_coords)
            region['height'] = height
            
        # 按高度降序排序并只保留前10个
        text_regions.sort(key=lambda x: x['height'], reverse=True)
        text_regions = text_regions[:10]
        
        # 合并文本区域
        merged_regions = merge_text_regions(text_regions)
        
        # 找出最可能的标题
        title_region = find_title_region(merged_regions)
        
        if title_region:
            # 删除该图片的所有原始text标注
            data['annotations'] = [ann for ann in data['annotations'] 
                                 if not (ann['image_id'] == image_id and ann['category_id'] == text_category_id)]
            
            # 创建新的标题标注
            max_ann_id += 1
            
            # 提取边界框坐标
            box = title_region['box']
            x_coords = [p[0] for p in box]
            y_coords = [p[1] for p in box]
            x = min(x_coords)
            y = min(y_coords)
            width = max(x_coords) - x
            height = max(y_coords) - y
            
            # 创建新的标注
            title_annotation = {
                "id": max_ann_id,
                "image_id": image_id,
                "category_id": text_category_id,  # 使用text类别ID而不是title类别ID
                "segmentation": [[coord for point in box for coord in point]],
                "area": title_region['area'],
                "bbox": [x, y, width, height],
                "iscrowd": 0,
                "text": title_region['text'],
                "confidence": title_region.get('confidence', 0)
            }
            
            new_annotations.append(title_annotation)
            title_found_count += 1
        
        processed_count += 1
        if processed_count % 10 == 0:
            print(f"已处理 {processed_count}/{len(annotations_by_image)} 张图片")
    
    # 添加新的标注
    data['annotations'].extend(new_annotations)
    
    # 保存更新后的数据
    with open(new_output_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    # 打印统计信息
    print("\n处理完成!")
    print(f"处理的图片总数: {processed_count}")
    print(f"找到标题的图片数: {title_found_count}")
    print(f"添加的标题标注总数: {len(new_annotations)}")
    print(f"更新后的标注已保存到: {new_output_file}")

def main():
    # 设置命令行参数
    parser = argparse.ArgumentParser(description='合并OCR文本框并提取标题')
    parser.add_argument('--annotations', type=str, default="./data/text_annotations.json",
                        help='输入标注文件路径')
    parser.add_argument('--new_output', type=str, default="./data/title_annotations.json",
                        help='输出标注文件路径')
    
    args = parser.parse_args()
    
    # 执行处理
    process_annotations(args.annotations, args.new_output)

if __name__ == "__main__":
    main() 