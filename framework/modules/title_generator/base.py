from typing import Dict
from utils.svg_to_mask import svg_to_mask
import json
import time
from PIL import Image as PILImage, ImageDraw
import pytesseract
import os
import cairosvg
def merge_bounding_boxes(bounding_boxes):
    """合并所有有实际文字内容的boundingbox"""
    min_x = min(box['x'] for box in bounding_boxes)
    min_y = min(box['y'] for box in bounding_boxes)
    max_x = max(box['x'] + box['width'] for box in bounding_boxes)
    max_y = max(box['y'] + box['height'] for box in bounding_boxes)
    ascent = max(box['ascent'] for box in bounding_boxes)
    descent = min(box['descent'] for box in bounding_boxes)
    return {
        'x': min_x,
        'y': min_y,
        'width': max_x - min_x,
        'height': max_y - min_y,
        'ascent': ascent,
        'descent': descent
    }

def OCR_boundingbox(text_svg: str):
    # 创建SVG内容
    svg_left = f"""
    <svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
    """
    svg_right = f"""
    </svg>
    """
    shift_y = 100
    group_left = f"""
    <g transform="translate(0, {shift_y})">
    """
    group_right = f"""
    </g>
    """
    text_anchor = 'start'
    
    svg_content = svg_left + group_left + text_svg + group_right + svg_right
    
    time_stamp = time.time()
    svg_path = f'text_{time_stamp}.svg'
    with open(svg_path, 'w') as f:
        f.write(svg_content)
    # 转换为PNG
    png_path = svg_path.replace('.svg', '.png')
    cairosvg.svg2png(url=svg_path, write_to=png_path)

    # OCR识别
    img = PILImage.open(png_path)
    result = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    # print("result: ", result)
    # 删除临时文件
    os.remove(svg_path)
    os.remove(png_path)

    # print(f"result: {result}")
    # 把所有有实际文字内容的boundingbox合并
    bounding_boxes = []
    for i in range(len(result['text'])):
        if result['text'][i]:
            bounding_boxes.append({
                'x': result['left'][i],
                'y': result['top'][i],
                'width': result['width'][i],
                'height': result['height'][i],
                'ascent': result['height'][i],
                'descent': result['height'][i]
            })
    # 合并boundingbox
    merged_bounding_box = merge_bounding_boxes(bounding_boxes)
    width = merged_bounding_box['width']
    height = merged_bounding_box['height']
    ascent = merged_bounding_box['ascent']
    descent = merged_bounding_box['descent']
    print(merged_bounding_box)
    
    x = 0
    y = shift_y
    
    if text_anchor == 'middle':
        x -= width / 2
    elif text_anchor == 'end':
        x -= width

    # y -= ascent
    y -= descent

    min_x = x
    min_y = y
    max_x = x + width
    max_y = y + height
    
    # 在image中画出boundingbox
    draw = ImageDraw.Draw(img)
    print(min_x, min_y, max_x, max_y)
    draw.rectangle([(min_x, min_y), (max_x, max_y)], outline='red', width=1)
    img.save('debug_image.png')
    
    # 减去shift_y
    min_y -= shift_y
    max_y -= shift_y
    
    return {
        'width': width,
        'height': height,
        'min_x': min_x,
        'min_y': min_y,
        'max_x': max_x,
        'max_y': max_y
    }

def measure_text_bounding_box(text_svg: str):
    # 使用svg_to_mask测量文本的边界框
    svg_left = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">'
    svg_right = '</svg>'
    text_svg = svg_left + text_svg + svg_right
    debug_image, mask_image, mask_grid, grid_info = svg_to_mask(text_svg, scale=10)
    # 把debug_image保存到本地
    debug_image.save('debug_image.png')
    # 把mask_image保存到本地
    mask_image.save('mask_image.png')
    print(mask_grid)
    print(grid_info)

class TitleGenerator:
    def __init__(self, json_data: Dict):
        self.json_data = json_data

    def generate(self):
        self.main_title_svg, self.main_title_bounding_box = self.generate_main_title()
        self.description_svg, self.description_bounding_box = self.generate_description()
        primary_color = self.json_data['colors']['other']['primary']
        self.embellishment_svg, self.embellishment_bounding_box = self.generate_embellishment(primary_color)
        return self.composite()

    def composite(self):
        # 首先以main_title_svg为基准，通过调整description_svg的位置，使他们两个boundingbox的min_x相同，同时description_svg的min_y比main_title_svg的max_y大10
        description_shift_x = self.main_title_bounding_box['min_x'] - self.description_bounding_box['min_x']
        description_shift_y = self.main_title_bounding_box['max_y'] + 5 - self.description_bounding_box['min_y']
        # 通过添加transform属性，调整description_svg的位置
        description_transform = f'translate({description_shift_x}, {description_shift_y})'
        self.description_svg = self.description_svg.replace('transform="', f'transform="{description_transform} ')
        self.description_bounding_box['min_x'] += description_shift_x
        self.description_bounding_box['min_y'] += description_shift_y
        self.description_bounding_box['max_x'] += description_shift_x
        self.description_bounding_box['max_y'] += description_shift_y
        
        
        new_height = self.description_bounding_box['max_y'] - self.main_title_bounding_box['min_y']
        old_height = self.embellishment_bounding_box['height']
        old_width = self.embellishment_bounding_box['width']
        scale = new_height / old_height
        new_width = old_width * scale
        
        # 通过调整embellishment_svg的大小和位置，使embellishment_svg的min_y与main_title的min_y相同，同时embellishment_svg的max_y与description_svg的max_y相同
        embellishment_shift_x = self.main_title_bounding_box['min_x'] - self.embellishment_bounding_box['min_x'] - new_width - 15
        embellishment_shift_y = self.main_title_bounding_box['min_y'] - self.embellishment_bounding_box['min_y']
        
        # 通过添加transform属性，调整embellishment_svg的位置
        embellishment_transform = f'translate({embellishment_shift_x}, {embellishment_shift_y})'
        self.embellishment_svg = self.embellishment_svg.replace('transform="', f'transform="{embellishment_transform} ')
       
        old_width_text = self.embellishment_svg.split('width="')[1].split('"')[0]
        old_height_text = self.embellishment_svg.split('height="')[1].split('"')[0]
        new_width_text = str(int(float(old_width_text) * scale))
        new_height_text = str(int(float(old_height_text) * scale))
       
        # # 通过修改width和height，调整embellishment_svg的大小
        self.embellishment_svg = self.embellishment_svg.replace(old_width_text, new_width_text)
        self.embellishment_svg = self.embellishment_svg.replace(old_height_text, new_height_text)
        
        group_left = '<g class="title">'
        group_right = '</g>'
        svg_left = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">'
        svg_right = '</svg>'
        svg_content = svg_left + group_left + self.embellishment_svg + self.main_title_svg + self.description_svg + group_right + svg_right 
        
        save_group_left = '<g class="title" transform="translate(50, 100)">'
        save_group_right = '</g>'
        save_svg_content = svg_left + save_group_left + self.embellishment_svg + self.main_title_svg + self.description_svg + save_group_right + svg_right 
        with open('result.svg', 'w') as f:
            f.write(save_svg_content)
        
        min_x = min(self.embellishment_bounding_box['min_x'], self.main_title_bounding_box['min_x'], self.description_bounding_box['min_x'])
        min_y = min(self.embellishment_bounding_box['min_y'], self.main_title_bounding_box['min_y'], self.description_bounding_box['min_y'])
        max_x = max(self.embellishment_bounding_box['max_x'], self.main_title_bounding_box['max_x'], self.description_bounding_box['max_x'])
        max_y = max(self.embellishment_bounding_box['max_y'], self.main_title_bounding_box['max_y'], self.description_bounding_box['max_y'])
        return svg_content, {
            'width': max_x - min_x,
            'height': max_y - min_y,
            'min_x': min_x,
            'min_y': min_y,
            'max_x': max_x,
            'max_y': max_y
        }

    def generate_main_title(self):
        main_title_text = self.json_data['metadata']['title']
        typography = self.json_data['typography']['title']
        text_svg = self.generate_one_line_text(typography, main_title_text)
        bounding_box = OCR_boundingbox(text_svg)
        return text_svg, bounding_box

    def generate_description(self):
        description_text = self.json_data['metadata']['description']
        typography = self.json_data['typography']['description']
        text_svg = self.generate_one_line_text(typography, description_text)
        bounding_box = OCR_boundingbox(text_svg)
        return text_svg, bounding_box


    def generate_embellishment(self, color = '#000000'):
        rect = f'<rect x="0" y="0" width="15" height="150" fill="{color}" transform="translate(0, 0)"></rect>'
        bounding_box = {
            'width': 15,
            'height': 150,
            'min_x': 0,
            'min_y': 0,
            'max_x': 15,
            'max_y': 150
        }
        return rect, bounding_box

    def generate_one_line_text(self, typography: Dict, text: str):
        font_family = typography.get('font_family', 'Arial')
        font_size = typography.get('font_size', '16px')
        font_weight = typography.get('font_weight', 'normal')
        text_left = f'<text style="font-family: {font_family}; font-size: {font_size}; font-weight: {font_weight};" transform="translate(0, 0)">'
        text_right = '</text>'
        return text_left + text + text_right
    
    
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate title for a chart')
    parser.add_argument('--input', '-i', type=str, required=True, help='Input JSON file path')
    parser.add_argument('--output', '-o', type=str, help='Output SVG file path')
    args = parser.parse_args()
    
    with open(args.input, 'r') as f:
        json_data = json.load(f)
    
    title_generator = TitleGenerator(json_data)
    result = title_generator.generate()
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(result[0])
