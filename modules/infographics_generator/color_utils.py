from typing import Tuple
import colorsys
import random
import math

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


def has_indistinguishable_colors(color_list, threshold=0.85):
    """
    判断颜色列表中是否存在不可区分的颜色
    
    参数:
        color_list: 十六进制颜色代码列表，如 ["#FF5733", "#33FF57"]
        threshold: 相似度阈值，超过此值的两个颜色被视为不可区分
        
    返回:
        如果存在不可区分的颜色，返回True，否则返回False
    """
    import math
    
    def color_similarity(color1, color2):
        # 将十六进制转换为RGB
        color1 = color1.lstrip('#')
        r1, g1, b1 = tuple(int(color1[i:i+2], 16) for i in (0, 2, 4))
        
        color2 = color2.lstrip('#')
        r2, g2, b2 = tuple(int(color2[i:i+2], 16) for i in (0, 2, 4))
        
        # 计算RGB空间中的欧氏距离
        distance = math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)
        
        # 归一化相似度 (最大可能距离是sqrt(3*255^2))
        similarity = 1 - (distance / math.sqrt(3 * 255**2))
        
        return similarity
    
    # 比较每一对颜色
    for i in range(len(color_list)):
        for j in range(i+1, len(color_list)):
            if color_similarity(color_list[i], color_list[j]) > threshold:
                return True
    
    return False

def generate_distinct_palette(main_color, num_colors=5):
    """
    根据主颜色生成一组美观且可区分的颜色调色板
    
    参数:
        main_color: 主颜色，十六进制格式，如 "#FF5733"
        num_colors: 需要生成的颜色数量，包括主颜色
        
    返回:
        一个包含十六进制颜色代码的列表
    """
    # 将十六进制颜色转换为RGB
    main_color = main_color.lstrip('#')
    r, g, b = tuple(int(main_color[i:i+2], 16) for i in (0, 2, 4))
    
    # 转换RGB为HSL
    h, s, l = colorsys.rgb_to_hls(r/255, g/255, b/255)
    h = h * 360  # 转换到0-360度
    s = s * 100  # 转换到0-100%
    l = l * 100  # 转换到0-100%
    
    palette = ["#" + main_color]  # 添加主颜色到调色板
    
    # 选择生成策略
    strategy = random.choice(["complementary", "analogous", "triadic", "golden_ratio"])
    
    # 根据不同策略生成颜色
    if strategy == "complementary" and num_colors >= 2:
        # 互补色方案，最容易区分
        for i in range(1, num_colors):
            # 互补色基础上增加变化
            new_h = (h + 180 + (i-1) * 30) % 360
            
            # 限制饱和度和亮度范围
            new_s = max(30, min(90, s + random.uniform(-20, 20)))
            new_l = max(35, min(75, l + random.uniform(-15, 15)))
            
            # 转回RGB并添加到调色板
            r, g, b = colorsys.hls_to_rgb(new_h/360, new_l/100, new_s/100)
            hex_color = "#{:02x}{:02x}{:02x}".format(int(r*255), int(g*255), int(b*255))
            palette.append(hex_color)
    
    elif strategy == "analogous":
        # 类似色方案但确保足够区分
        for i in range(1, num_colors):
            # 在主色左右30-60度范围内分布
            new_h = (h + (i % 2 * 2 - 1) * random.uniform(30, 60)) % 360
            
            # 限制饱和度和亮度范围
            new_s = max(30, min(90, s + random.uniform(-15, 15)))
            new_l = max(35, min(75, l + random.uniform(-10, 10)))
            
            r, g, b = colorsys.hls_to_rgb(new_h/360, new_l/100, new_s/100)
            hex_color = "#{:02x}{:02x}{:02x}".format(int(r*255), int(g*255), int(b*255))
            palette.append(hex_color)
    
    elif strategy == "triadic":
        # 三等分色环方案
        for i in range(1, num_colors):
            # 在色环上120度间隔分布
            new_h = (h + (i % 3) * 120) % 360
            
            # 限制饱和度和亮度范围
            new_s = max(30, min(90, s + random.uniform(-10, 10)))
            new_l = max(35, min(75, l + random.uniform(-10, 10)))
            
            r, g, b = colorsys.hls_to_rgb(new_h/360, new_l/100, new_s/100)
            hex_color = "#{:02x}{:02x}{:02x}".format(int(r*255), int(g*255), int(b*255))
            palette.append(hex_color)
    
    else:  # golden_ratio
        # 黄金比例方法
        golden_ratio = 0.618033988749895 * 360  # 转换到角度
        for i in range(1, num_colors):
            new_h = (h + golden_ratio * i) % 360
            
            # 限制饱和度和亮度范围
            new_s = max(30, min(90, 60 + random.uniform(-20, 20)))  # 基准饱和度60%
            new_l = max(35, min(75, 55 + random.uniform(-15, 15)))  # 基准亮度55%
            
            r, g, b = colorsys.hls_to_rgb(new_h/360, new_l/100, new_s/100)
            hex_color = "#{:02x}{:02x}{:02x}".format(int(r*255), int(g*255), int(b*255))
            palette.append(hex_color)
    
    # 检查颜色区分度，如果颜色太相似，则调整
    final_palette = [palette[0]]  # 始终保留主颜色
    for color in palette[1:]:
        if len(final_palette) >= num_colors:
            break
            
        # 检查与已有颜色的区分度
        is_distinct = True
        for existing_color in final_palette:
            if color_similarity(color, existing_color) > 0.85:  # 相似度阈值
                is_distinct = False
                break
                
        if is_distinct:
            final_palette.append(color)
        else:
            # 生成一个替代颜色
            new_h = random.uniform(0, 360)
            new_s = random.uniform(30, 90)  # 限制饱和度范围
            new_l = random.uniform(35, 75)  # 限制亮度范围
            
            r, g, b = colorsys.hls_to_rgb(new_h/360, new_l/100, new_s/100)
            hex_color = "#{:02x}{:02x}{:02x}".format(int(r*255), int(g*255), int(b*255))
            final_palette.append(hex_color)
    
    # 如果颜色不足，继续补充
    while len(final_palette) < num_colors:
        new_h = random.uniform(0, 360)
        new_s = random.uniform(30, 90)  # 限制饱和度范围
        new_l = random.uniform(35, 75)  # 限制亮度范围
        
        r, g, b = colorsys.hls_to_rgb(new_h/360, new_l/100, new_s/100)
        hex_color = "#{:02x}{:02x}{:02x}".format(int(r*255), int(g*255), int(b*255))
        
        # 检查与已有颜色的区分度
        is_distinct = True
        for existing_color in final_palette:
            if color_similarity(hex_color, existing_color) > 0.85:
                is_distinct = False
                break
                
        if is_distinct:
            final_palette.append(hex_color)
    
    return final_palette

def color_similarity(color1, color2):
    """
    计算两个颜色的相似度（0-1之间，1表示完全相同）
    """
    # 将十六进制转换为RGB
    color1 = color1.lstrip('#')
    r1, g1, b1 = tuple(int(color1[i:i+2], 16) for i in (0, 2, 4))
    
    color2 = color2.lstrip('#')
    r2, g2, b2 = tuple(int(color2[i:i+2], 16) for i in (0, 2, 4))
    
    # 计算RGB空间中的欧氏距离
    distance = math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)
    
    # 归一化相似度 (最大可能距离是sqrt(3*255^2))
    similarity = 1 - (distance / math.sqrt(3 * 255**2))
    
    return similarity