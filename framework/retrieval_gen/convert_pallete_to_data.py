import json
import colorsys
import random
from copy import deepcopy
from typing import Dict, List, Any, Union

# 深色背景颜色选项
dark_background_colors = [
    "#1e2130", "#1a1a2e", "#191919", "#162447", 
    "#2d3142", "#1f2b44", "#2b2b3d", "#282828", "#243447", 
    "#373e57", "#343434", "#203a43", "#1c2541", "#2c2c34", 
    "#2e2e2e", "#254362", "#352f44", "#204051", "#303030"
]

# 固定调色板备选方案
fixed_color_palette = [
    ["#4269d0","#efb118","#ff725c","#6cc5b0","#3ca951","#ff8ab7","#a463f2","#97bbf5","#9c6b4e","#9498a0"],
    ["#4e79a7","#f28e2c","#e15759","#76b7b2","#59a14f","#edc949","#af7aa1","#ff9da7","#9c755f","#bab0ab"],
    ["#66c2a5","#fc8d62","#8da0cb","#e78ac3","#a6d854","#ffd92f","#e5c494","#b3b3b3"],
]

def rgb_to_hex(r, g, b):
    """将RGB颜色转换为十六进制格式"""
    r = max(0, min(int(r), 255))
    g = max(0, min(int(g), 255))  
    b = max(0, min(int(b), 255))
    return '#{:02x}{:02x}{:02x}'.format(r, g, b)

def hex_to_rgb(hex_color):
    """将十六进制颜色转换为RGB"""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join([c + c for c in hex_color])

    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    
    return (r, g, b)

def rgb_to_hsl(r, g, b):
    """将RGB转换为HSL"""
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return (h, s, l)

def hsl_to_hex(h, s, l):
    """将HSL转换为十六进制颜色"""
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    
    r = int(r * 255)
    g = int(g * 255)
    b = int(b * 255)
    
    return f"#{r:02x}{g:02x}{b:02x}"

def adapt_color_for_dark_background(color, brightness_adjustment=25, saturation_adjustment=15, 
                                    preserve_grays=True, min_brightness=60, max_brightness=85,
                                    contrast_enhancement=10):
    """将适用于浅色背景的颜色转换为适用于深色背景的颜色"""
    rgb = hex_to_rgb(color)
    h, s, l = rgb_to_hsl(*rgb)
    
    perceived_brightness = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2])
    if preserve_grays and s < 0.1:
        s = min(0.15, s + 0.1)  # 增加一些饱和度，但不超过15%
        l = max(min_brightness/100, l + brightness_adjustment/100)  # 显著提高亮度
    else:
        # 动态调整饱和度 - 根据原始亮度调整
        dynamic_sat_adjustment = saturation_adjustment * (1 - perceived_brightness) * 1.5
        
        s = max(0, min(1, s + dynamic_sat_adjustment/100))
        dynamic_brightness_adjustment = brightness_adjustment * (1 - perceived_brightness) * 1.5
        l = max(0, min(1, l + dynamic_brightness_adjustment/100))
        
        # 增强对比度
        if l < 0.5:
            contrast_factor = contrast_enhancement / 200  
            l = max(0, l - contrast_factor * (0.5 - l))
        else:
            contrast_factor = contrast_enhancement / 200
            l = min(1, l + contrast_factor * (l - 0.5))
    
    l = max(min_brightness/100, l)
    l = min(max_brightness/100, l)
    
    hex_str = hsl_to_hex(h, s, l)
    
    return hex_str

def adapt_color_for_light_background(color, brightness_reduction=15, saturation_adjustment=5, 
                                    preserve_grays=True, min_brightness=25, max_brightness=90,
                                    contrast_enhancement=10):
    """将颜色优化为适用于浅色背景的颜色"""
    # 将十六进制颜色转换为RGB
    rgb = hex_to_rgb(color)
    h, s, l = rgb_to_hsl(*rgb)
    perceived_brightness = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2])

    if preserve_grays and s < 0.1:
        # 灰色调在浅色背景上需要足够深，但不要太黑
        l = max(min_brightness/100, min(0.6, l - 0.1))
        s = min(0.05, s)  # 保持低饱和度
    else:
        if l > 0.7:
            dynamic_brightness_reduction = brightness_reduction * (perceived_brightness)
            l = max(min_brightness/100, l - dynamic_brightness_reduction/100)
        
        if l < 0.3:
            l = min(0.5, l + 0.1)

        if s < 0.4 and l > 0.5:
            s = min(0.6, s + saturation_adjustment/100 * 2)
        elif s > 0.8 and l < 0.4:
            s = max(0.6, s - saturation_adjustment/100)
    
    if l > 0.65:
        contrast_factor = contrast_enhancement / 200
        l = max(min_brightness/100, l - contrast_factor * (l - 0.5))
    elif l < 0.45:
        contrast_factor = contrast_enhancement / 300
        l = min(0.6, l + contrast_factor * (0.5 - l))
    
    l = max(min_brightness/100, l)
    l = min(max_brightness/100, l)
    
    hex_str = hsl_to_hex(h, s, l)
    
    return hex_str

def convert_palette_for_light_background(palette, **kwargs):
    """转换整个调色板以适应浅色背景"""
    converted_palette = []
    
    for color in palette:
        converted = adapt_color_for_light_background(color, **kwargs)
        converted_palette.append(converted)
    
    return converted_palette

def convert_palette_for_dark_background(palette, **kwargs):
    """转换整个调色板以适应深色背景"""
    converted_palette = []
    
    for color in palette:
        converted = adapt_color_for_dark_background(color, **kwargs)
        converted_palette.append(converted)
    
    return converted_palette

def determine_by_group(columns: List[Dict], combination: str):
    """确定用于分组的列"""
    if not columns or len(columns) == 0:
        return None
        
    column_names = [col["name"] for col in columns]
    if not column_names:
        return None
        
    if combination == "categorical + numerical" or combination == "categorical + numerical + numerical":
        return column_names[0] if len(column_names) > 0 else None
    elif combination == "categorical + numerical + categorical":
        return column_names[2] if len(column_names) > 2 else None
    elif combination == "temporal + numerical + categorical":
        return column_names[2] if len(column_names) > 2 else None
    elif combination == "temporal + numerical":
        return column_names[0] if len(column_names) > 0 else None
    elif combination == "categorical + numerical + temporal":
        return column_names[0] if len(column_names) > 0 else None
    else:
        ret = None
        for col in columns:
            if col["data_type"] == "categorical" or col["data_type"] == "temporal":
                ret = col["name"]
        return ret

def should_color_by_group(by_group, data, columns):
    """确定是否应该按组着色"""
    if by_group is None:
        return False
            
    unique_values = len(set(row[by_group] for row in data if by_group in row))
    column_type = next((col["data_type"] for col in columns if col["name"] == by_group), "")
    
    if column_type == "temporal" and unique_values >= 5:
        return False
    elif column_type == "categorical" and unique_values >= 8:
        return False
            
    return True

def get_required_color_num(by_group, data):
    """计算所需的颜色数量"""
    if by_group is None:
        return 1
    return len(set(row[by_group] for row in data if by_group in row))

def convert_palette_to_data(data: Dict, palette: Union[List[str], Dict]) -> Dict:
    """
    将调色板应用到数据中
    
    参数:
        data: 包含数据和元数据的字典
        palette: 调色板，可以是颜色列表或包含调色板信息的字典
        
    返回:
        更新后的数据字典，包含颜色方案
    """
    # 深拷贝数据，避免修改原始数据
    processed_data = deepcopy(data)
    
    # 提取必要的信息
    data_dict = processed_data.get("data", {})
    data_rows = data_dict.get("data", [])
    columns = data_dict.get("columns", [])
    combination = data_dict.get("type_combination", "")
    
    # 基本颜色
    black = "#151515"
    white = "#f0f0f0"
    gray1 = "#4b4b4b"
    gray2 = "#969696"
    gray3 = "#c8c8c8"
    basic_colors_hex = [black, white, gray1, gray2, gray3]
    
    # 确定分组列
    by_group = determine_by_group(columns, combination)
    
    # 检查是否应该按组着色
    should_group = should_color_by_group(by_group, data_rows, columns)
    if not should_group:
        by_group = None
    
    # 获取所需的颜色数量
    required_color_num = get_required_color_num(by_group, data_rows)
    
    # 处理调色板
    colors_to_use = []
    background_color = "#ffffff"  # 默认白色背景
    
    # 根据调色板类型提取颜色
    if isinstance(palette, list):
        # 如果是简单的颜色列表
        colors_to_use = palette
    elif isinstance(palette, dict):
        # 如果是调色板字典
        if "main_color" in palette:
            colors_to_use = palette["main_color"]
            if "context_colors" in palette and isinstance(palette["context_colors"], list):
                colors_to_use.extend(palette["context_colors"])
        elif "color_list" in palette:
            colors_to_use = palette["color_list"]
        
        # 获取背景色
        if "bcg" in palette:
            background_color = palette["bcg"]
    
    # 如果没有足够的颜色或调色板为空，使用固定调色板
    # if not colors_to_use or len(colors_to_use) <= required_color_num:
    #     scheme = fixed_color_palette[random.randint(0, len(fixed_color_palette) - 1)]
    #     colors_to_use = scheme
    
    # 确保调色板有足够的颜色
    if len(colors_to_use) < required_color_num:
        # 如果颜色不够，循环使用
        extended_palette = colors_to_use.copy()
        while len(extended_palette) < required_color_num:
            extended_palette.extend(colors_to_use)
        colors_to_use = extended_palette[:required_color_num + 3]  # 多取几个备用
    
    # 创建颜色方案
    color_scheme = {
        "field": {},
        "other": {
            "primary": None,
        },
        "available_colors": [],
        "background_color": background_color,
        "text_color": basic_colors_hex[0]  # 默认黑色文本
    }
    
    # 分配颜色
    if by_group:
        # 获取唯一值并排序
        unique_values = set(row[by_group] for row in data_rows if by_group in row)
        
        # 找到第一个数值列
        first_numerical_value = None
        for col in columns:
            if col["data_type"] == "numerical":
                first_numerical_value = col["name"]
                break
        
        # 如果有数值列，按数值大小排序
        if first_numerical_value:
            # 计算每个分组的平均值
            group_means = {}
            for value in unique_values:
                values = [float(row[first_numerical_value]) for row in data_rows 
                         if by_group in row and row[by_group] == value and first_numerical_value in row]
                if values:
                    group_means[value] = sum(values) / len(values)
                else:
                    group_means[value] = 0
            
            # 按平均值降序排序
            sorted_values = sorted(unique_values, key=lambda x: -group_means.get(x, 0))
        else:
            # 否则按字母顺序排序
            sorted_values = sorted(unique_values)
        
        # 分配颜色
        color_scheme["other"]["primary"] = colors_to_use[0]
        for i, value in enumerate(sorted_values):
            color_scheme["field"][str(value)] = colors_to_use[i]
        
        # 添加额外的颜色
        if required_color_num < len(colors_to_use):
            color_scheme["other"]["secondary"] = colors_to_use[required_color_num]
            for i in range(required_color_num + 1, len(colors_to_use)):
                color_scheme["available_colors"].append(colors_to_use[i])
    else:
        # 如果不按组着色，只使用主色
        color_scheme["other"]["primary"] = colors_to_use[0]
        if len(colors_to_use) > 1:
            color_scheme["other"]["secondary"] = colors_to_use[1]
            for i in range(2, len(colors_to_use)):
                color_scheme["available_colors"].append(colors_to_use[i])
    
    # 创建深色版本
    darker_color_scheme = deepcopy(color_scheme)
    for k, v in darker_color_scheme.items():
        if isinstance(v, list):
            darker_color_scheme[k] = convert_palette_for_dark_background(v)
        elif isinstance(v, dict):
            for k2, v2 in v.items():
                darker_color_scheme[k][k2] = convert_palette_for_dark_background([v2])[0]
        elif isinstance(v, str) and k != "background_color":
            darker_color_scheme[k] = convert_palette_for_dark_background([v])[0]
        elif k == "background_color":
            darker_color_scheme[k] = random.choice(dark_background_colors)
    
    # 添加颜色方案到数据中
    print(f"color_scheme: {color_scheme}")
    processed_data["colors"] = color_scheme
    processed_data["colors_dark"] = darker_color_scheme
    
    return processed_data

def main():
    """测试函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="将调色板转换为数据")
    parser.add_argument("--input", type=str, required=True, help="输入JSON文件路径")
    parser.add_argument("--output", type=str, required=True, help="输出JSON文件路径")
    parser.add_argument("--palette_file", type=str, help="调色板JSON文件路径")
    parser.add_argument("--palette", type=str, nargs='+', 
                        default=["#4269d0", "#efb118", "#ff725c", "#6cc5b0", "#3ca951", "#ff8ab7", "#a463f2", "#97bbf5"], 
                        help="调色板颜色列表，以空格分隔的十六进制颜色")
    
    args = parser.parse_args()
    
    # 读取输入文件
    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # 读取调色板
    palette = args.palette
    if args.palette_file:
        try:
            with open(args.palette_file, "r", encoding="utf-8") as f:
                palette = json.load(f)
        except Exception as e:
            print(f"读取调色板文件失败: {e}，使用默认调色板")
    
    # 转换调色板
    result = convert_palette_to_data(data, palette)
    
    # 保存结果
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"处理完成，结果已保存到 {args.output}")

if __name__ == "__main__":
    main()
