from typing import Tuple
import colorsys

def parse_color(c: str) -> Tuple[int, int, int]:
    """将颜色字符串解析为RGB元组"""
    if c.startswith('#'):
        c = c.lstrip('#')
        if len(c) == 3:
            c = ''.join(x + x for x in c)
        return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))
    elif c.startswith('rgb'):
        return tuple(map(int, c.strip('rgb()').split(',')))
    raise ValueError(f"Unsupported color format: {c}")

def rgb_to_hsl(r: int, g: int, b: int) -> Tuple[float, float, float]:
    """RGB颜色转换为HSL颜色空间"""
    r, g, b = r/255.0, g/255.0, b/255.0
    max_val = max(r, g, b)
    min_val = min(r, g, b)
    h, s, l = 0, 0, (max_val + min_val) / 2
    
    if max_val != min_val:
        d = max_val - min_val
        s = d / (2 - max_val - min_val) if l > 0.5 else d / (max_val + min_val)
        if max_val == r:
            h = (g - b) / d + (6 if g < b else 0)
        elif max_val == g:
            h = (b - r) / d + 2
        elif max_val == b:
            h = (r - g) / d + 4
        h /= 6
        
    return h * 360, s * 100, l * 100

def hsl_to_rgb(h: float, s: float, l: float) -> Tuple[int, int, int]:
    """HSL颜色转换为RGB颜色空间"""
    h, s, l = h/360, s/100, l/100
    
    def hue_to_rgb(p: float, q: float, t: float) -> float:
        if t < 0:
            t += 1
        if t > 1:
            t -= 1
        if t < 1/6:
            return p + (q - p) * 6 * t
        if t < 1/2:
            return q
        if t < 2/3:
            return p + (q - p) * (2/3 - t) * 6
        return p
    
    if s == 0:
        r = g = b = l
    else:
        q = l * (1 + s) if l < 0.5 else l + s - l * s
        p = 2 * l - q
        r = hue_to_rgb(p, q, h + 1/3)
        g = hue_to_rgb(p, q, h)
        b = hue_to_rgb(p, q, h - 1/3)
        
    return tuple(round(x * 255) for x in (r, g, b))

def get_contrast_color(hex_color: str) -> str:
    """获取与给定颜色形成对比的颜色"""
    # 移除#号并转换为RGB
    hex_color = hex_color.lstrip('#')
    r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    # 计算亮度
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    # 根据亮度返回黑色或白色
    return '#000000' if luminance > 0.5 else '#ffffff'

def hex_to_rgb(hex_color: str) -> tuple:
    """
    Convert hex color to RGB tuple
    
    Args:
        hex_color: Hex color string (e.g. "#FFFFFF")
        
    Returns:
        tuple: (r, g, b) where each value is between 0 and 1
    """
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    return (r, g, b)

def rgb_to_hex(rgb: tuple) -> str:
    """
    Convert RGB tuple to hex color
    
    Args:
        rgb: (r, g, b) tuple where each value is between 0 and 1
        
    Returns:
        str: Hex color string (e.g. "#FFFFFF")
    """
    r, g, b = [int(x * 255) for x in rgb]
    return f"#{r:02x}{g:02x}{b:02x}"
def lighten_color(hex_color: str, amount: float = 0.2) -> str:
    """
    Lighten a color by converting to HSL, increasing lightness, and converting back
    
    Args:
        hex_color: Hex color string (e.g. "#FFFFFF")
        amount: Amount to lighten (0-1)
        
    Returns:
        str: Lightened hex color
    """
    # Convert hex to RGB
    r, g, b = hex_to_rgb(hex_color)
    
    # Convert RGB to HSL
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    
    # Increase lightness to ensure RGB values are at least 220/255
    # Calculate the minimum lightness needed to get RGB values above 220
    r_new, g_new, b_new = r, g, b
    target_min = 220/255
    
    # Gradually increase lightness until all RGB values are above target
    while min(r_new, g_new, b_new) < target_min and l < 0.99:
        l = min(0.99, l + 0.05)
        r_new, g_new, b_new = colorsys.hls_to_rgb(h, l, s)
    
    # Convert back to hex
    return rgb_to_hex((r_new, g_new, b_new))

def is_dark_color(hex_color: str) -> bool:
    """
    Check if a color is dark by calculating its luminance
    
    Args:
        hex_color: Hex color string (e.g. "#FFFFFF")
        
    Returns:
        bool: True if color is dark, False otherwise
    """
    r, g, b = hex_to_rgb(hex_color)
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return luminance < 0.8