from typing import Optional
from lxml import etree

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