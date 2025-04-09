from typing import Optional
from lxml import etree

def extract_svg_content(svg_str: str) -> Optional[str]:
    """
    从SVG字符串中提取内部内容
    
    Args:
        svg_str: SVG字符串内容
        
    Returns:
        Optional[str]: 提取的内容，如果提取失败则返回None
    """
    try:
        root = etree.fromstring(svg_str)
        inner_content = ''.join(etree.tostring(child, encoding='unicode') for child in root)
        return inner_content
    except (etree.ParseError, ValueError, TypeError) as e:
        return None 