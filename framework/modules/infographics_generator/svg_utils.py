from typing import Optional
from lxml import etree
import xml.etree.ElementTree as ET
from svgpathtools import parse_path
import re
import numpy as np
from PIL import Image
import subprocess
import tempfile
import os
import re
import colorsys

def add_gradient_to_rect(rect_svg):
    """
    将普通填充的矩形SVG转换为带有渐变效果的矩形
    
    参数:
        rect_svg (str): 普通填充的矩形SVG，例如 <rect x="0" y="0" width="781" height="707" fill="#E2F1F6" />
        
    返回:
        str: 带有渐变效果的矩形SVG
    """
    # 提取矩形属性
    x_match = re.search(r'x="([^"]*)"', rect_svg)
    y_match = re.search(r'y="([^"]*)"', rect_svg)
    width_match = re.search(r'width="([^"]*)"', rect_svg)
    height_match = re.search(r'height="([^"]*)"', rect_svg)
    fill_match = re.search(r'fill="([^"]*)"', rect_svg)
    
    # 默认值
    x = x_match.group(1) if x_match else "0"
    y = y_match.group(1) if y_match else "0"
    width = width_match.group(1) if width_match else "100"
    height = height_match.group(1) if height_match else "100"
    fill = fill_match.group(1) if fill_match else "#000000"
    
    # 创建渐变ID
    gradient_id = f"gradient_{hash(rect_svg) % 10000}"
    
    # 计算渐变的第二个颜色（稍微暗一点或者亮一点）
    # 移除#前缀并解析十六进制颜色
    hex_color = fill.lstrip('#')
    # 转换十六进制为RGB
    r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    # 转换RGB为HSL
    h, l, s = colorsys.rgb_to_hls(r/255, g/255, b/255)
    
    # 创建稍微暗一点的颜色
    l_darker = max(0, l - 0.1)  # 降低亮度，但不低于0
    r_darker, g_darker, b_darker = colorsys.hls_to_rgb(h, l_darker, s)
    
    # 转换回十六进制
    end_color = "#{:02x}{:02x}{:02x}".format(
        int(r_darker * 255), 
        int(g_darker * 255), 
        int(b_darker * 255)
    )
    
    # 创建带有渐变的SVG
    gradient_svg = f"""<defs>
    <!-- 背景渐变 -->
    <linearGradient id="{gradient_id}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="{fill}" />
        <stop offset="100%" stop-color="{end_color}" />
    </linearGradient>
</defs>

<!-- 背景矩形 -->
<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="10" ry="10" fill="url(#{gradient_id})" />"""
    
    return gradient_svg

def extract_svg_content(svg_content: str) -> Optional[str]:
    """从SVG内容中提取内部元素"""
    try:
        svg_tree = etree.fromstring(svg_content.encode())
        # 获取所有子元素
        children = svg_tree.getchildren()
        if not children:
            return None
            
        # 将子元素转换为字符串
        content = ""
        for child in children:
            content += etree.tostring(child, encoding='unicode')
        return content
    except Exception as e:
        return None

def remove_large_rects(svg_content: str) -> str:
    """移除SVG中的大型矩形元素"""
    try:
        svg_tree = etree.fromstring(svg_content.encode())
        for rect in svg_tree.xpath("//rect"):
            width = float(rect.get("width", 0))
            height = float(rect.get("height", 0))
            if width * height > 500 * 500:
                rect.getparent().remove(rect)
        return etree.tostring(svg_tree, encoding='unicode')
    except Exception as e:
        return svg_content 

def parse_translate(transform_str):
    """Parse translate(x, y) from the transform attribute."""
    match = re.search(r'translate\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)', transform_str)
    if match:
        tx = float(match.group(1))
        ty = float(match.group(2)) if match.group(2) else 0.0
        return tx, ty
    return 0.0, 0.0


def adjust_and_get_bbox(svg_content, background_color = "#FFFFFF"):
    """Adjust SVG and get precise bounding box."""
    # Create temporary files for SVG and PNG
    with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as temp_svg, \
         tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_png:
        temp_svg_path = temp_svg.name
        temp_png_path = temp_png.name

    svg_container = f"<svg \
        width='1000' \
        height='1000' \
        xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> \
        {svg_content}</svg>"
    
    with open(temp_svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_container)

    bbox = get_svg_actual_bbox(temp_svg_path)
    padding = 150
    new_width = bbox['width'] + padding * 2
    new_height = bbox['height'] + padding * 2
    svg_container = f"<svg \
        width='{new_width}' \
        height='{new_height}' \
        xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> \
        <rect width='{new_width}' height='{new_height}' fill='{background_color}' /> \
        <g transform='translate({padding - bbox['min_x']}, {padding - bbox['min_y']})'> \
            {svg_content} \
        </g> \
        </svg>"
    
    with open(temp_svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_container)

    svg_to_png(temp_svg_path, temp_png_path, background_color)
    x_min, y_min, x_max, y_max = get_precise_bbox(temp_png_path, background_color)
    width = x_max - x_min + 1
    height = y_max - y_min + 1
    offset_x = padding - bbox['min_x'] - x_min
    offset_y = padding - bbox['min_y'] - y_min
    svg_container = f"<g transform='translate({offset_x}, {offset_y})'> \
        {svg_content} \
    </g>"

    os.unlink(temp_svg_path)
    os.unlink(temp_png_path)
    
    return svg_container, width, height, offset_x, offset_y
    

def svg_to_png(svg_path, png_path, background_color = "#FFFFFF"):
    """Convert SVG to PNG using rsvg-convert with a white background."""
    # Add --background-color=#FFFFFF to set white background
    cmd = ['rsvg-convert', '--background-color=' + background_color, svg_path, '-o', png_path]
    subprocess.run(cmd, check=True)

def get_precise_bbox(png_path, background_color = "#FFFFFF"):
    """Get precise bounding box by detecting the exact non-transparent pixels."""
    img = Image.open(png_path).convert("RGBA")
    width, height = img.size
    
    # Convert image to numpy array for efficient processing
    img_array = np.array(img)
    
    # Get alpha channel and RGB values
    alpha = img_array[:, :, 3]
    rgb = img_array[:, :, :3]
    
    # Consider pixels close to the background color as transparent too
    bg_rgb = np.array([int(background_color[i:i+2], 16) for i in (1, 3, 5)])  # Convert hex to RGB
    threshold = 15  # Define a threshold for color similarity
    is_background = np.all(np.abs(rgb - bg_rgb) < threshold, axis=2)
    
    # Find non-transparent and non-background pixels
    non_transparent = (alpha > 0) & (~is_background)
    
    # If there are no non-transparent pixels, return the full image dimensions
    if not np.any(non_transparent):
        return 0, 0, width, height
    
    # Find the bounds of non-transparent pixels
    rows = np.any(non_transparent, axis=1)
    cols = np.any(non_transparent, axis=0)
    
    # Get the boundaries
    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]
    # Get full image dimensions
    return x_min, y_min, x_max + 1, y_max + 1

def get_svg_actual_bbox(svg_path):
    # 使用lxml而不是xml.etree.ElementTree
    tree = etree.parse(svg_path)
    root = tree.getroot()

    # 获取SVG的原始宽度和高度
    svg_width = float(root.get('width', '0').replace('px', ''))
    svg_height = float(root.get('height', '0').replace('px', ''))

    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')

    def update_bounds(x_vals, y_vals):
        nonlocal min_x, min_y, max_x, max_y
        min_x = min(min_x, min(x_vals))
        max_x = max(max_x, max(x_vals))
        min_y = min(min_y, min(y_vals))
        max_y = max(max_y, max(y_vals))

    def get_accumulated_transform(elem):
        # 获取从根元素到当前元素的所有transform累加
        total_dx, total_dy = 0.0, 0.0
        current = elem
        while current is not None:
            transform = current.get("transform")
            if transform:
                dx, dy = parse_translate(transform)
                total_dx += dx
                total_dy += dy
            parent = current.getparent()
            if current == root:
                break
            current = parent
        return total_dx, total_dy

    def parse_percentage(value, base):
        """解析百分比值，返回实际数值"""
        if isinstance(value, str) and '%' in value:
            percentage = float(value.replace('%', '')) / 100
            return base * percentage
        return float(value)

    def parse_points(points_str):
        """解析points属性中的点坐标"""
        points = []
        for point in points_str.strip().split():
            x, y = point.split(',')
            points.append((float(x), float(y)))
        return points

    for elem in root.iter():
        tag = elem.tag.split('}')[-1]
        dx, dy = get_accumulated_transform(elem)

        if tag == 'rect':
            # 检查是否应该忽略此矩形（fill="none"且没有stroke属性）
            fill = elem.get('fill', '').lower()
            has_stroke = elem.get('stroke') is not None
            if fill == 'none' and not has_stroke:
                continue  # 忽略这个矩形
                
            x = parse_percentage(elem.get('x', '0'), svg_width) + dx
            y = parse_percentage(elem.get('y', '0'), svg_height) + dy
            w = parse_percentage(elem.get('width', '0'), svg_width)
            h = parse_percentage(elem.get('height', '0'), svg_height)
            update_bounds([x, x + w], [y, y + h])
        elif tag == 'circle':
            cx = parse_percentage(elem.get('cx', '0'), svg_width) + dx
            cy = parse_percentage(elem.get('cy', '0'), svg_height) + dy
            r = parse_percentage(elem.get('r', '0'), svg_width)
            update_bounds([cx - r, cx + r], [cy - r, cy + r])
        elif tag == 'ellipse':
            cx = parse_percentage(elem.get('cx', '0'), svg_width) + dx
            cy = parse_percentage(elem.get('cy', '0'), svg_height) + dy
            rx = parse_percentage(elem.get('rx', '0'), svg_width)
            ry = parse_percentage(elem.get('ry', '0'), svg_height)
            update_bounds([cx - rx, cx + rx], [cy - ry, cy + ry])
        elif tag == 'line':
            x1 = parse_percentage(elem.get('x1', '0'), svg_width) + dx
            y1 = parse_percentage(elem.get('y1', '0'), svg_height) + dy
            x2 = parse_percentage(elem.get('x2', '0'), svg_width) + dx
            y2 = parse_percentage(elem.get('y2', '0'), svg_height) + dy
            update_bounds([x1, x2], [y1, y2])
        elif tag == 'polygon':
            points_str = elem.get('points', '')
            if points_str:
                points = parse_points(points_str)
                x_vals = [x + dx for x, _ in points]
                y_vals = [y + dy for _, y in points]
                update_bounds(x_vals, y_vals)
        elif tag == 'path':
            d = elem.get('d')
            if d:
                try:
                    path = parse_path(d)
                    for segment in path:
                        box = segment.bbox()
                        update_bounds(
                            [box[0] + dx, box[1] + dx],
                            [box[2] + dy, box[3] + dy]
                        )
                except Exception as e:
                    # 处理无效路径
                    print(f"Error parsing path: {e}")
        elif tag == 'text':
            x = parse_percentage(elem.get('x', '0'), svg_width) + dx
            y = parse_percentage(elem.get('y', '0'), svg_height) + dy
            font_size_str = elem.get('font-size', '16')
            font_size = float(font_size_str.replace('px', '')) if 'px' in font_size_str else float(font_size_str)
            text_len = len(elem.text or "")
            text_width = font_size * 0.6 * text_len
            text_height = font_size
            
            # 处理文本对齐方式
            text_anchor = elem.get('text-anchor', 'start')
            if text_anchor == 'start':
                text_left = x
                text_right = x + text_width
            elif text_anchor == 'middle':
                text_left = x - text_width / 2
                text_right = x + text_width / 2
            elif text_anchor == 'end':
                text_left = x - text_width
                text_right = x
            else:  # 默认为start
                text_left = x
                text_right = x + text_width
            
            update_bounds(
                [text_left, text_right],
                [y - 0.8 * text_height, y + 0.2 * text_height]
            )

    if min_x == float('inf'):
        return None  # 没有有效图形

    return {
        'min_x': min_x,
        'min_y': min_y,
        'max_x': max_x,
        'max_y': max_y,
        'width': max_x - min_x,
        'height': max_y - min_y
    }
