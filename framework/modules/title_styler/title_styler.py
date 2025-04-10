from typing import Dict, Union
from modules.title_styler.utils.svg_to_mask import svg_to_mask
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
    <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000">
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
    svg_path = f'/tmp/text_{time_stamp}.svg'
    with open(svg_path, 'w') as f:
        f.write(svg_content)
    # 转换为PNG
    png_path = f'/tmp/text_{time_stamp}.png'
    cairosvg.svg2png(url=svg_path, write_to=png_path)

    # OCR识别
    img = PILImage.open(png_path)
    result = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    # print("result: ", result)
    # # 删除临时文件
    os.remove(svg_path)
    os.remove(png_path)

    # print(f"result: {result}")
    # 把所有有实际文字内容的boundingbox合并
    bounding_boxes = []
    for i in range(len(result['text'])):
        if result['text'][i]:
            # print("result['left'][i]: ", result['left'][i])
            # print("result['top'][i]: ", result['top'][i])
            # print("result['width'][i]: ", result['width'][i])
            # print("result['height'][i]: ", result['height'][i])
            # print("result['text'][i]: ", result['text'][i])
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
    # print("merged_bounding_box: ", merged_bounding_box)
    
    x = 0
    y = merged_bounding_box['y']
    
    if text_anchor == 'middle':
        x -= width / 2
    elif text_anchor == 'end':
        x -= width

    # # y -= ascent
    # y -= descent

    min_x = x
    min_y = y
    max_x = x + width
    max_y = y + height
    
    # 在image中画出boundingbox
    draw = ImageDraw.Draw(img)
    # print(min_x, min_y, max_x, max_y)
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
    svg_left = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">'
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
    def __init__(self, json_data: Dict, max_width = 0):
        self.json_data = json_data
        self.max_width = max_width

    def generate(self):
        self.main_title_svg, self.main_title_bounding_box = self.generate_main_title()
        self.description_svg, self.description_bounding_box = self.generate_description()
        primary_color = self.json_data['colors']['other']['primary']
        self.embellishment_svg, self.embellishment_bounding_box = self.generate_embellishment(primary_color)
        return self.composite()

    def composite(self):
        # 首先以main_title_svg为基准，通过调整description_svg的位置，使他们两个boundingbox的min_x相同，同时description_svg的min_y比main_title_svg的max_y大10
        description_shift_x = self.main_title_bounding_box['min_x'] - self.description_bounding_box['min_x']
        description_shift_y = self.main_title_bounding_box['max_y'] + 10 - self.description_bounding_box['min_y']
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
        self.embellishment_bounding_box['min_x'] += embellishment_shift_x
        self.embellishment_bounding_box['min_y'] += embellishment_shift_y
        self.embellishment_bounding_box['max_x'] += embellishment_shift_x
        self.embellishment_bounding_box['max_y'] += embellishment_shift_y
        
       
        old_width_text = self.embellishment_svg.split('width="')[1].split('"')[0]
        old_height_text = self.embellishment_svg.split('height="')[1].split('"')[0]
        new_width_text = str(int(float(old_width_text) * scale))
        new_height_text = str(int(float(old_height_text) * scale))
       
        # # 通过修改width和height，调整embellishment_svg的大小
        self.embellishment_svg = self.embellishment_svg.replace(old_width_text, new_width_text)
        self.embellishment_svg = self.embellishment_svg.replace(old_height_text, new_height_text)
        

        
        min_x = min(self.embellishment_bounding_box['min_x'], self.main_title_bounding_box['min_x'], self.description_bounding_box['min_x'])
        min_y = min(self.embellishment_bounding_box['min_y'], self.main_title_bounding_box['min_y'], self.description_bounding_box['min_y'])
        max_x = max(self.embellishment_bounding_box['max_x'], self.main_title_bounding_box['max_x'], self.description_bounding_box['max_x'])
        max_y = max(self.embellishment_bounding_box['max_y'], self.main_title_bounding_box['max_y'], self.description_bounding_box['max_y'])
        
        
        group_left = f'<g class="title" transform="translate({-min_x}, {-min_y})">'
        group_right = '</g>'
        svg_left = f'<svg xmlns="http://www.w3.org/2000/svg" width="{max_x - min_x}" height="{max_y - min_y}" viewBox="0 0 {max_x - min_x} {max_y - min_y}">'
        svg_right = '</svg>'
        svg_content = svg_left + group_left + self.embellishment_svg + self.main_title_svg + self.description_svg + group_right + svg_right 
        
        save_group_left = f'<g class="title" transform="translate({50-min_x}, {100-min_y})">'
        save_group_right = '</g>'
        save_svg_content = svg_left + save_group_left + self.embellishment_svg + self.main_title_svg + self.description_svg + save_group_right + svg_right 
        with open('result.svg', 'w') as f:
            f.write(save_svg_content)
        return svg_content, {
            'width': max_x - min_x,
            'height': max_y - min_y,
            'min_x': 0,
            'min_y': 0,
            'max_x': max_x - min_x,
            'max_y': max_y - min_y
        }

    def generate_main_title(self):
        main_title_text = self.json_data['metadata']['title']
        typography = self.json_data['typography']['title']
        text_svg = self.generate_one_line_text(typography, main_title_text)
        bounding_box = OCR_boundingbox(text_svg)
        
        # 检查是否超出最大宽度
        if self.max_width > 0 and bounding_box['width'] > self.max_width:
            text_svg, bounding_box = self.generate_multi_line_text(typography, main_title_text, self.max_width)
        
        return text_svg, bounding_box

    def generate_description(self):
        description_text = self.json_data['metadata']['description']
        typography = self.json_data['typography']['description']
        text_svg = self.generate_one_line_text(typography, description_text)
        bounding_box = OCR_boundingbox(text_svg)
        
        # 检查是否超出最大宽度
        if self.max_width > 0 and bounding_box['width'] > self.max_width:
            text_svg, bounding_box = self.generate_multi_line_text(typography, description_text, self.max_width)
            
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

    def generate_multi_line_text(self, typography: Dict, text: str, max_width: int):
        """生成多行文本，确保每行不超过最大宽度"""
        font_family = typography.get('font_family', 'Arial')
        font_size = typography.get('font_size', '16px')
        font_weight = typography.get('font_weight', 'normal')
        
        # 尝试拆分文本
        words = text.split()
        lines = []
        current_line = []
        
        for word in words:
            # 测试添加这个词后的宽度
            test_line = current_line + [word]
            test_text = ' '.join(test_line)
            
            # 确保test_text至少有3个字符
            if len(test_text) < 3:
                current_line.append(word)
                continue
                
            test_svg = self.generate_one_line_text(typography, test_text)
            test_box = OCR_boundingbox(test_svg)
            
            if not current_line or test_box['width'] <= max_width:
                current_line.append(word)
            else:
                # 确保当前行文本至少3个字符
                current_text = ' '.join(current_line)
                if len(current_text) >= 3:
                    lines.append(current_text)
                current_line = [word]
        
        # 添加最后一行
        if current_line:
            lines.append(' '.join(current_line))
        
        # 生成多行SVG
        line_height = int(font_size.replace('px', '')) * 1.0  # 行高约为字体大小的1.2倍
        g_left = '<g>'
        text_content = ""
        
        for i, line in enumerate(lines):
            y = i * line_height
            text_style = f'style="font-family: {font_family}; font-size: {font_size}; font-weight: {font_weight};"'
            text_content += f'<text {text_style} transform="translate(0, {y})">{line}</text>'
        
        g_right = '</g>'
        text_svg = g_left + text_content + g_right
        
        # 计算整体边界框
        bounding_box = OCR_boundingbox(text_svg)
        
        return text_svg, bounding_box
    
    
def process(
    input: str = None,
    output: str = None,
    input_data: Dict = None,
    max_width: int = 500
) -> Union[bool, str]:
    """
    Process function for generating styled title SVG from input data.

    Args:
        input (str, optional): Path to the input JSON file.
        output (str, optional): Path to the output SVG file.
        input_data (Dict, optional): Input data dictionary (alternative to file input).
        max_width (int, optional): Maximum width constraint for the title. Defaults to 500.

    Returns:
        Union[bool, str]:
          - If output is provided, returns True/False indicating success/failure.
          - Otherwise, returns the generated SVG content as a string.
    """
    try:
        # Load the data object
        if input_data is None:
            if input is None:
                return False
            with open(input, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = input_data

        # Generate the title SVG
        title_generator = TitleGenerator(data, max_width=max_width)
        svg_content, bounding_box = title_generator.generate()

        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(svg_content)
            return True

        return svg_content

    except Exception as e:
        print(f"Error in title styling: {str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Generate styled title SVG for a chart')
    parser.add_argument('--input', '-i', type=str, required=True, help='Input JSON file path')
    parser.add_argument('--output', '-o', type=str, help='Output SVG file path')
    parser.add_argument('--max-width', '-w', type=int, default=500, help='Maximum width constraint for the title')
    
    args = parser.parse_args()
    
    success = process(
        input=args.input,
        output=args.output,
        max_width=args.max_width
    )
    
    if success:
        print("Title styling completed successfully.")
    else:
        print("Title styling failed.")


if __name__ == '__main__':
    main()
