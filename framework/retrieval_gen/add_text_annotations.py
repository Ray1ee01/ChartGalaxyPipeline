import os
import json
import argparse
import cv2
import numpy as np
from PIL import Image
import pytesseract
from shapely.geometry import Polygon
from paddleocr import PaddleOCR

def calculate_area(box):
    """
    计算四边形的面积
    
    参数:
    box: 四个点的坐标 [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
    
    返回:
    面积大小
    """
    # 使用Shapely库计算多边形面积
    polygon = Polygon(box)
    return polygon.area

def extract_text_with_paddle(image_path, paddle_ocr=None):
    """
    使用PaddleOCR从图片中提取文本区域
    
    参数:
    image_path: 图片路径
    paddle_ocr: PaddleOCR实例（可选）
    
    返回:
    文本区域列表
    """
    if paddle_ocr is None:
        # 初始化PaddleOCR
        paddle_ocr = PaddleOCR(use_angle_cls=True, lang="ch", use_gpu=False)
    
    # 读取图片
    image = cv2.imread(image_path)
    if image is None:
        print(f"无法读取图片: {image_path}")
        return []
    
    # 使用PaddleOCR进行识别
    result = paddle_ocr.ocr(image_path, cls=True)
    
    # 处理结果
    text_regions = []
    
    # 检查结果是否为None或空列表
    if result is None or len(result) == 0:
        print(f"图片没有识别到文本: {image_path}")
        return []
    
    # 处理PaddleOCR的结果格式
    for line in result:
        # 检查line是否为None或空列表
        if line is None or len(line) == 0:
            continue
            
        for item in line:
            # 检查每个项目的格式
            if len(item) != 2:
                continue
                
            try:
                # 尝试解析坐标和文本
                coords, (text, prob) = item
                
                # 确保坐标是有效的
                if len(coords) != 4:
                    continue
                    
                (x1, y1), (x2, y2), (x3, y3), (x4, y4) = coords
                
                if prob > 0.5:  # 只考虑置信度大于0.5的文本
                    # 创建四边形坐标
                    box = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
                    
                    # 计算面积
                    area = calculate_area(box)
                    
                    text_regions.append({
                        'box': box,
                        'area': area,
                        'text': text,
                        'confidence': prob
                    })
            except (ValueError, TypeError) as e:
                print(f"处理OCR结果时出错: {e}, 项目: {item}")
                continue
    
    return text_regions

def extract_text_with_tesseract(image_path):
    """
    使用Tesseract OCR从图片中提取文本区域
    """
    # 读取图片
    image = cv2.imread(image_path)
    if image is None:
        print(f"无法读取图片: {image_path}")
        return []
    
    # 转换为PIL图像用于pytesseract
    pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    
    # 使用pytesseract进行OCR，获取详细数据
    ocr_data = pytesseract.image_to_data(pil_image, lang='chi_sim+eng', output_type=pytesseract.Output.DICT)
    
    # 找出所有有文本的区域
    text_regions = []
    for i in range(len(ocr_data['text'])):
        if ocr_data['text'][i].strip() and ocr_data['conf'][i] > 30:  # 只考虑置信度大于30的文本
            x = ocr_data['left'][i]
            y = ocr_data['top'][i]
            w = ocr_data['width'][i]
            h = ocr_data['height'][i]
            
            # 创建四边形坐标
            box = [[x, y], [x+w, y], [x+w, y+h], [x, y+h]]
            area = w * h
            text = ocr_data['text'][i]
            
            text_regions.append({
                'box': box,
                'area': area,
                'text': text,
                'confidence': ocr_data['conf'][i]
            })
    
    return text_regions

def extract_text_from_image(image_path, ocr_method='paddle', paddle_ocr=None):
    """
    使用OCR从图片中提取所有文本区域
    
    参数:
    image_path: 图片路径
    ocr_method: 使用的OCR方法，'tesseract'或'paddle'
    paddle_ocr: PaddleOCR实例（可选）
    
    返回:
    所有文本区域的列表，每个元素包含坐标和文本内容
    """
    if ocr_method == 'tesseract':
        return extract_text_with_tesseract(image_path)
    elif ocr_method == 'paddle':
        return extract_text_with_paddle(image_path, paddle_ocr)
    else:
        print(f"不支持的OCR方法: {ocr_method}")
        return []

def add_text_annotations(annotations_file, images_dir, new_output_file, ocr_method='paddle'):
    """
    为每个图片添加文本标注
    
    参数:
    annotations_file: 原始标注文件的路径
    images_dir: 图片目录
    new_output_file: 新的输出标注文件路径
    ocr_method: 使用的OCR方法，'tesseract'或'paddle'
    """
    print(f"开始为图片添加文本标注...")
    print(f"原始标注文件: {annotations_file}")
    print(f"图片目录: {images_dir}")
    print(f"新输出文件: {new_output_file}")
    print(f"OCR方法: {ocr_method}")
    
    # 加载标注文件
    with open(annotations_file, 'r') as f:
        data = json.load(f)
    
    # 添加文本类别
    text_category = {
        "id": len(data['categories']) + 1,
        "name": "text",
        "supercategory": "text"
    }
    data['categories'].append(text_category)
    
    # 获取最大的annotation id
    max_ann_id = max([ann['id'] for ann in data['annotations']]) if data['annotations'] else 0
    
    # 初始化PaddleOCR（如果使用PaddleOCR）
    paddle_ocr = None
    if ocr_method == 'paddle':
        print("初始化PaddleOCR...")
        paddle_ocr = PaddleOCR(use_angle_cls=True, lang="ch", use_gpu=False)
    
    # 为每个图片添加文本标注
    new_annotations = []
    processed_count = 0
    text_found_count = 0
    total_text_regions = 0
    
    for image in data['images']:
        image_id = image['id']
        image_path = os.path.join(images_dir, image['file_name'])
        
        # 检查文件是否存在
        if not os.path.exists(image_path):
            print(f"警告: 图片不存在 {image_path}")
            continue
        
        # 提取所有文本区域
        text_regions = extract_text_from_image(image_path, ocr_method, paddle_ocr)
        
        # 为每个文本区域创建标注
        image_has_text = False
        for region in text_regions:
            text_box = region['box']
            text_content = region['text']
            
            # 创建新的标注
            max_ann_id += 1
            
            # 将box转换为COCO格式的分割坐标
            segmentation = [[coord for point in text_box for coord in point]]
            
            # 计算边界框
            x_coords = [point[0] for point in text_box]
            y_coords = [point[1] for point in text_box]
            x = min(x_coords)
            y = min(y_coords)
            width = max(x_coords) - x
            height = max(y_coords) - y
            
            new_annotation = {
                "id": max_ann_id,
                "image_id": image_id,
                "category_id": text_category['id'],
                "segmentation": segmentation,
                "area": region['area'],
                "bbox": [x, y, width, height],
                "iscrowd": 0,
                "text": text_content,
                "confidence": region.get('confidence', 0)
            }
            
            new_annotations.append(new_annotation)
            image_has_text = True
            total_text_regions += 1
        
        if image_has_text:
            text_found_count += 1
        
        processed_count += 1
        if processed_count % 10 == 0:
            print(f"已处理 {processed_count}/{len(data['images'])} 张图片")
    
    # 添加新的标注
    data['annotations'].extend(new_annotations)
    
    # 保存更新后的数据
    with open(new_output_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    # 打印统计信息
    print("\n处理完成!")
    print(f"处理的图片总数: {processed_count}")
    print(f"找到文本的图片数: {text_found_count}")
    print(f"添加的文本标注总数: {total_text_regions}")
    print(f"更新后的标注已保存到: {new_output_file}")

def main():
    # 设置命令行参数
    parser = argparse.ArgumentParser(description='为图片添加文本标注')
    parser.add_argument('--annotations', type=str, default="./data/filtered2_annotations.json",
                        help='输入标注文件路径')
    parser.add_argument('--images_dir', type=str, default="./data",
                        help='图片目录')
    parser.add_argument('--new_output', type=str, default="./data/text_annotations.json",
                        help='新的输出标注文件路径')
    parser.add_argument('--ocr_method', type=str, default="paddle", choices=['tesseract', 'paddle'],
                        help='OCR方法: tesseract或paddle')
    
    args = parser.parse_args()
    
    # 执行添加文本标注
    add_text_annotations(args.annotations, args.images_dir, args.new_output, args.ocr_method)

if __name__ == "__main__":
    main() 