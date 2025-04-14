from typing import Optional
from lxml import etree
import xml.etree.ElementTree as ET
from svgpathtools import parse_path
import re

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
