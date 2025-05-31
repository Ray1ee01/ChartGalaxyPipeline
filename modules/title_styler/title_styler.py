from typing import Dict, Union
import json
from PIL import Image, ImageDraw, ImageFont
import argparse

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

def measure_text_bounds(text, font_family, font_size, font_weight="normal"):
    """测量文本的边界框尺寸"""
    # 创建临时图像用于测量文本
    img = Image.new('RGB', (1, 1), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # 获取字体
    font = get_font(font_family, font_size, font_weight)
    
    # 获取文本尺寸
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    width = right - left
    height = bottom - top
    
    result = {
        'width': width,
        'height': height,
        'min_x': left,
        'min_y': top,
        'max_x': right,
        'max_y': bottom
    }
    
    return result

def get_font(font_family, font_size, font_weight="normal"):
    """获取字体对象，处理各种字体格式和降级情况"""
    # 处理特殊字体名称
    if font_family and font_family.lower() == 'comics':
        font_family = 'Comic Sans MS, cursive'
    
    # 从字体大小中提取数字部分
    if isinstance(font_size, str):
        font_size = int(font_size.replace('px', ''))
    
    try:
        # 首先尝试加载系统字体
        if font_weight == "bold":
            font = ImageFont.truetype(font_family, size=font_size, weight="bold")
        else:
            font = ImageFont.truetype(font_family, size=font_size)
    except (OSError, IOError):
        try:
            # 如果直接加载失败，尝试一些常见的系统字体
            system_fonts = {
                'Arial': '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
                'Times': '/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf',
                'Courier': '/usr/share/fonts/truetype/msttcorefonts/Courier_New.ttf',
                'Verdana': '/usr/share/fonts/truetype/msttcorefonts/Verdana.ttf',
                'Comic': '/usr/share/fonts/truetype/msttcorefonts/Comic_Sans_MS.ttf',
                'Default': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
            }
            
            # 尝试匹配字体名称
            for name, path in system_fonts.items():
                if name.lower() in font_family.lower():
                    font = ImageFont.truetype(path, size=font_size)
                    return font
            
            # 如果没有匹配，使用默认字体
            font = ImageFont.truetype(system_fonts['Default'], size=font_size)
        except (OSError, IOError):
            # 如果所有尝试都失败，使用PIL的默认字体并尝试调整大小
            default_font = ImageFont.load_default()
            
            # PIL的默认字体不支持调整大小，所以我们必须警告用户
            print(f"警告: 无法加载指定字体和大小 '{font_family}', {font_size}px。使用默认字体。")
            font = default_font
    
    return font

def split_text_into_lines(text, max_width, font_family="Arial", font_size=16, font_weight="normal"):
    """将文本按照给定的宽度限制拆分成多行"""
    # 创建临时图像用于测量文本宽度
    img = Image.new('RGB', (1, 1), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # 获取字体
    font = get_font(font_family, font_size, font_weight)
    
    lines = []
    
    # 检测是否包含中文字符
    has_chinese = any('\u4e00' <= char <= '\u9fff' for char in text)
    
    if has_chinese:
        # 中文文本按字符切分
        current_line = ("", 0)
        for char in text:
            test_line = current_line[0] + char
            # 获取文本宽度
            text_width = draw.textlength(test_line, font=font)
            
            if text_width <= max_width:
                current_line = (test_line, text_width)
            else:
                lines.append(current_line)
                current_line = (char, draw.textlength(char, font=font))
        
        # 添加最后一行
        if current_line:
            lines.append(current_line)
    else:
        # 英文文本按单词切分
        words = text.split()
        current_line = ("", 0)
        
        for word in words:
            # 测试添加这个单词后是否超出宽度
            test_line = current_line[0] + (" " if current_line[0] else "") + word
            text_width = draw.textlength(test_line, font=font)
            if text_width <= max_width:
                current_line = (test_line, text_width)
            else:
                if current_line:
                    lines.append(current_line)
                current_line = (word, draw.textlength(word, font=font))
                
                # 检查单个单词是否超过最大宽度
                if draw.textlength(word, font=font) > max_width:
                    # 如果单个单词就超过宽度，则需要逐字分割
                    word_line = ""
                    for char in word:
                        test_word_line = word_line + char
                        if draw.textlength(test_word_line, font=font) <= max_width:
                            word_line = test_word_line
                        else:
                            word_line = word_line + "-"
                            lines.append((word_line, draw.textlength(word_line, font=font)))
                            word_line = char
                    
                    if word_line:
                        current_line = (word_line, draw.textlength(word_line, font=font))
                        if current_line not in lines:
                            lines.append(current_line)
                            current_line = ("", 0)
        
        # 添加最后一行
        if current_line:
            lines.append(current_line)
    
    # 确保至少有一行
    if not lines:
        lines = [(text, draw.textlength(text, font=font))]
            
    return lines

class TitleGenerator:
    def __init__(self, json_data: Dict, max_width = 0, text_align = "left", show_embellishment = True, show_sub_title = True, font_family = None):
        self.json_data = json_data
        self.max_width = max_width
        self.text_align = text_align  # 保留接口，但内部只实现左对齐
        self.show_embellishment = show_embellishment
        self.show_sub_title = show_sub_title
        self.font_family = font_family

    def generate(self):
        self.main_title_svg, self.main_title_bounding_box = self.generate_main_title()
        if self.show_sub_title:
            self.description_svg, self.description_bounding_box = self.generate_description()
        else:
            self.description_svg = ""
            self.description_bounding_box = {
                'width': 0, 'height': 0,
                'min_x': 0, 'min_y': 0,
                'max_x': 0, 'max_y': 0
            }
        primary_color = self.json_data['colors']['other']['primary']
        
        if self.show_embellishment:
            self.embellishment_svg, self.embellishment_bounding_box = self.generate_embellishment(primary_color)
        else:
            # 创建空的装饰块，不会显示在最终结果中
            self.embellishment_svg = ""
            self.embellishment_bounding_box = {
                'width': 0, 'height': 0,
                'min_x': 0, 'min_y': 0,
                'max_x': 0, 'max_y': 0
            }
            
        return self.composite()

    def composite(self):
        if self.show_sub_title:
            description_shift_y = self.main_title_bounding_box['max_y'] + 15 - self.main_title_bounding_box['min_y']
            description_shift_x = self.description_bounding_box['min_x'] - self.main_title_bounding_box['min_x']

            if self.text_align == "right":
                title_width = self.main_title_bounding_box['max_x'] - self.main_title_bounding_box['min_x']
                description_width = self.description_bounding_box['max_x'] - self.description_bounding_box['min_x']
                description_shift_x = title_width - description_width
            
            description_transform = f'translate({0}, {description_shift_y})'
            self.description_svg = self.description_svg.replace('transform="', f'transform="{description_transform} ')
            self.description_bounding_box['min_x'] += 0
            self.description_bounding_box['min_y'] += description_shift_y
            self.description_bounding_box['max_x'] += 0
            self.description_bounding_box['max_y'] += description_shift_y
        
        # 如果显示装饰块，调整其位置和大小
        if self.show_embellishment:
            new_height = self.description_bounding_box['max_y'] - self.main_title_bounding_box['min_y']
            old_height = self.embellishment_bounding_box['height']
            old_width = self.embellishment_bounding_box['width']
            scale = new_height / old_height
            new_width = old_width * scale
            
            # 装饰块在左边
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
           
            # 通过修改width和height，调整embellishment_svg的大小
            self.embellishment_svg = self.embellishment_svg.replace(old_width_text, new_width_text)
            self.embellishment_svg = self.embellishment_svg.replace(old_height_text, new_height_text)
            
            # Update embellishment bounding box with new dimensions after scaling
            self.embellishment_bounding_box['width'] = float(new_width_text)
            self.embellishment_bounding_box['height'] = float(new_height_text)
            self.embellishment_bounding_box['max_x'] = self.embellishment_bounding_box['min_x'] + float(new_width_text)
            self.embellishment_bounding_box['max_y'] = self.embellishment_bounding_box['min_y'] + float(new_height_text)
        
        # 计算整体边界框
        min_x = min(
            self.main_title_bounding_box['min_x'], 
            self.description_bounding_box['min_x'] if self.show_sub_title else float('inf'),
            self.embellishment_bounding_box['min_x'] if self.show_embellishment else float('inf')
        )
        min_y = min(
            self.main_title_bounding_box['min_y'], 
            self.description_bounding_box['min_y'] if self.show_sub_title else float('inf'),
            self.embellishment_bounding_box['min_y'] if self.show_embellishment else float('inf')
        )
        max_x = max(
            self.main_title_bounding_box['max_x'], 
            self.description_bounding_box['max_x'] if self.show_sub_title else float('-inf'),
            self.embellishment_bounding_box['max_x'] if self.show_embellishment else float('-inf')
        )
        max_y = max(
            self.main_title_bounding_box['max_y'], 
            self.description_bounding_box['max_y'] if self.show_sub_title else float('-inf'),
            self.embellishment_bounding_box['max_y'] if self.show_embellishment else float('-inf')
        )
        
        group_left = f'<g class="title" transform="translate({-min_x}, {-min_y})">'
        group_right = '</g>'
        svg_left = f'<svg xmlns="http://www.w3.org/2000/svg" width="{max_x - min_x}" height="{max_y - min_y}" viewBox="0 0 {max_x - min_x} {max_y - min_y}">'
        svg_right = '</svg>'
        svg_content = svg_left + group_left + self.embellishment_svg + self.main_title_svg + self.description_svg + group_right + svg_right 
            
        final_bounding_box = {
            'width': max_x - min_x,
            'height': max_y - min_y,
            'min_x': 0,
            'min_y': 0,
            'max_x': max_x - min_x,
            'max_y': max_y - min_y
        }
        
        return svg_content, final_bounding_box

    def generate_text_element(self, text: str, typography: Dict, max_width: int = 0, text_align: str = "left"):
        """生成文本元素，包括SVG和边界框"""
        text_svg = self.generate_one_line_text(typography, text, max_width, text_align)
        
        # 使用PIL直接测量文本尺寸
        font_family = typography.get('font_family', 'Arial')
        if self.font_family:  # 如果全局字体被设置，优先使用全局字体
            font_family = self.font_family
        # 如果字体是comics，自动转换为Comic Sans MS, cursive
        if font_family and font_family.lower() == 'comics':
            font_family = 'Comic Sans MS, cursive'
        font_size = typography.get('font_size', '16px')
        font_weight = typography.get('font_weight', 'normal')
        
        bounding_box = measure_text_bounds(text, font_family, font_size, font_weight)
        
        # 检查是否超出最大宽度，并且生成多行文本
        if max_width > 0 and bounding_box['width'] > max_width:
            text_svg, bounding_box = self.generate_multi_line_text(typography, text, max_width, text_align)
        
        return text_svg, bounding_box

    def generate_main_title(self):
        """生成主标题"""
        main_title_text = self.json_data['titles']['main_title']
        typography = self.json_data['typography']['title']
        return self.generate_text_element(main_title_text, typography, self.max_width, self.text_align)

    def generate_description(self):
        """生成描述文本"""
        description_text = self.json_data['titles']['sub_title']
        typography = self.json_data['typography']['description']
        return self.generate_text_element(description_text, typography, self.max_width, self.text_align)

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

    def generate_one_line_text(self, typography: Dict, text: str, max_width: int = 0, text_align: str = "left"):
        font_family = typography.get('font_family', 'Arial')
        if self.font_family:  # 如果全局字体被设置，优先使用全局字体
            font_family = self.font_family
        # 如果字体是comics，自动转换为Comic Sans MS, cursive
        if font_family and font_family.lower() == 'comics':
            font_family = 'Comic Sans MS, cursive'
        font_size = typography.get('font_size', '16px')
        font_weight = typography.get('font_weight', 'normal')
        
        text_anchor = "start"
        x = 0
        if text_align == "center":
            text_anchor = "middle"
            x = max_width / 2
        elif text_align == "right":
            text_anchor = "end"
            x = max_width
        text_left = f'<text dominant-baseline="hanging" text-anchor="{text_anchor}" style="font-family: {font_family}; font-size: {font_size}; font-weight: {font_weight};" \
            transform="translate({x}, 0)">'
        text_right = '</text>'
        return text_left + text + text_right

    def generate_multi_line_text(self, typography: Dict, text: str, max_width: int, text_align: str = "left"):
        """生成多行文本，确保每行不超过最大宽度"""
        font_family = typography.get('font_family', 'Arial')
        if self.font_family:  # 如果全局字体被设置，优先使用全局字体
            font_family = self.font_family
        # 如果字体是comics，自动转换为Comic Sans MS, cursive
        if font_family and font_family.lower() == 'comics':
            font_family = 'Comic Sans MS, cursive'
        font_size = typography.get('font_size', '16px')
        font_weight = typography.get('font_weight', 'normal')
        
        # 使用拆分文本函数获取多行
        lines = split_text_into_lines(text, max_width, font_family, font_size, font_weight)
        
        # 生成多行SVG
        if isinstance(font_size, str):
            font_size_px = int(font_size.replace('px', ''))
        else:
            font_size_px = font_size
            
        line_height = font_size_px * 1.2  # 行高约为字体大小的1.2倍
        g_left = '<g>'
        text_content = ""

        text_anchor = "start"
        if text_align == "center":
            text_anchor = "middle"
        elif text_align == "right":
            text_anchor = "end"
        
        for i, (line, line_width) in enumerate(lines):
            y = i * line_height
            x = 0
            if text_align == "right":
                x = max_width
            elif text_align == "center":
                x = max_width / 2
            text_style = f'style="font-family: {font_family}; font-size: {font_size}; font-weight: {font_weight};"'
            text_content += f'<text dominant-baseline="hanging" text-anchor="{text_anchor}" {text_style} transform="translate({x}, {y})">{line}</text>'
        
        g_right = '</g>'
        text_svg = g_left + text_content + g_right
        
        # 计算整体边界框
        if len(lines) == 1:
            bounding_box = measure_text_bounds(lines[0][0], font_family, font_size, font_weight)
        else:
            # 对于多行文本，计算整体边界框
            max_line_width = 0
            for (line, line_width) in lines:
                max_line_width = max(max_line_width, line_width)
                
            total_height = line_height * (len(lines) - 1) + font_size_px
            
            bounding_box = {
                'width': max_line_width,
                'height': total_height,
                'min_x': 0,
                'min_y': 0,
                'max_x': max_line_width,
                'max_y': total_height
            }
        
        return text_svg, bounding_box
    
    
def process(
    input: str = None,
    output: str = None,
    input_data: Dict = None,
    max_width: int = 500,
    text_align: str = "left",
    show_embellishment: bool = True,
    show_sub_title: bool = True,
    font_family: str = None
) -> Union[bool, str]:
    """
    Process function for generating styled title SVG from input data.

    Args:
        input (str, optional): Path to the input JSON file.
        output (str, optional): Path to the output SVG file.
        input_data (Dict, optional): Input data dictionary (alternative to file input).
        max_width (int, optional): Maximum width constraint for the title. Defaults to 500.
        text_align (str, optional): Text alignment. Options: "left", "center", "right". Defaults to "left".
        show_embellishment (bool, optional): Whether to show the decoration element. Defaults to True.
        show_sub_title (bool, optional): Whether to show the subtitle. Defaults to True.
        font_family (str, optional): Font family to use for all text. Defaults to None (use from typography).

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
        title_generator = TitleGenerator(data, max_width=max_width, 
                                         text_align=text_align, 
                                         show_embellishment=show_embellishment,
                                         show_sub_title=show_sub_title,
                                         font_family=font_family)
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
    parser.add_argument('--text-align', '-a', type=str, default='left', choices=['left', 'center', 'right'],
                        help='Text alignment: left, center, or right')
    parser.add_argument('--no-embellishment', action='store_true', help='Hide the decoration element')
    parser.add_argument('--no-subtitle', action='store_true', help='Hide the subtitle')
    parser.add_argument('--font', type=str, help='Font family to use for all text (e.g. Arial, Comic, Times)')
    
    args = parser.parse_args()
    
    # 处理font参数中的comics
    if args.font and args.font.lower() == 'comics':
        args.font = 'Comic Sans MS, cursive'
        
    success = process(
        input=args.input,
        output=args.output,
        max_width=args.max_width,
        text_align=args.text_align,
        show_embellishment=not args.no_embellishment,
        show_sub_title=not args.no_subtitle,
        font_family=args.font
    )
    
    if success:
        print("Title styling completed successfully.")
    else:
        print("Title styling failed.")


if __name__ == '__main__':
    main()
