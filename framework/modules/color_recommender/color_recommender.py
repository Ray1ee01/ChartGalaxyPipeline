import json
from typing import Dict, List, Optional, Union
import pandas as pd
import random
import argparse
import os
from copy import deepcopy
from logging import getLogger
from modules.color_recommender.color_index_builder import ColorIndexBuilder

def rgb_to_hex(r, g, b):
    r = max(0, min(int(r), 255))
    g = max(0, min(int(g), 255))  
    b = max(0, min(int(b), 255))
    return '#{:02x}{:02x}{:02x}'.format(r, g, b)

import colorsys

# 复用之前的函数
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
    
    hsl_str = f"hsl({int(h*360)}°, {int(s*100)}%, {int(l*100)}%)"
    hex_str = hsl_to_hex(h, s, l)
    
    return hex_str
def adapt_color_for_light_background(color, brightness_reduction=15, saturation_adjustment=5, 
                                    preserve_grays=True, min_brightness=25, max_brightness=90,  # Increased max_brightness
                                    contrast_enhancement=10):
    """
    将颜色优化为适用于浅色背景的颜色
    
    参数:
        color (str): 颜色值，支持十六进制格式(#RGB 或 #RRGGBB)
        brightness_reduction (int): 亮度降低百分比 (0-100)
        saturation_adjustment (int): 饱和度调整百分比 (-100 到 100)
        preserve_grays (bool): 是否保持灰色调的特殊处理
        min_brightness (int): 最小亮度阈值 (0-100)
        max_brightness (int): 最大亮度阈值 (0-100)
        contrast_enhancement (int): 对比度增强系数 (0-100)
        
    返回:
        tuple: 转换后的HSL颜色字符串和十六进制颜色字符串的元组
    """
    # 将十六进制颜色转换为RGB
    rgb = hex_to_rgb(color)
    h, s, l = rgb_to_hsl(*rgb)
    perceived_brightness = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2])

    if preserve_grays and s < 0.1:
        # 灰色调在浅色背景上需要足够深，但不要太黑
        l = max(min_brightness/100, min(0.6, l - 0.1))  # Adjusted to make it lighter
        s = min(0.05, s)  # 保持低饱和度
    else:
        if l > 0.7:
            dynamic_brightness_reduction = brightness_reduction * (perceived_brightness)
            l = max(min_brightness/100, l - dynamic_brightness_reduction/100)
        
        if l < 0.3:
            l = min(0.5, l + 0.1)  # Adjusted to make it lighter

        if s < 0.4 and l > 0.5:
            s = min(0.6, s + saturation_adjustment/100 * 2)
        elif s > 0.8 and l < 0.4:
            s = max(0.6, s - saturation_adjustment/100)
    
    if l > 0.65:
        contrast_factor = contrast_enhancement / 200
        l = max(min_brightness/100, l - contrast_factor * (l - 0.5))
    elif l < 0.45:
        contrast_factor = contrast_enhancement / 300
        l = min(0.6, l + contrast_factor * (0.5 - l))  # Adjusted to make it lighter
    
    l = max(min_brightness/100, l)
    l = min(max_brightness/100, l)
    
    hsl_str = f"hsl({int(h*360)}°, {int(s*100)}%, {int(l*100)}%)"
    hex_str = hsl_to_hex(h, s, l)
    
    return hex_str

def convert_palette_for_light_background(palette, **kwargs):
    """
    转换整个调色板以适应浅色背景
    
    参数:
        palette (list): 颜色列表，每个颜色为十六进制格式
        **kwargs: 传递给adapt_color_for_light_background的选项
        
    返回:
        list: 转换后的颜色列表，每个元素为(hsl, hex)的元组
    """
    converted_palette = []
    
    for color in palette:
        converted = adapt_color_for_light_background(color, **kwargs)
        converted_palette.append(converted)
    
    return converted_palette

def enhance_palette_accessibility(palette, background_is_dark=True, **kwargs):
    """
    根据背景色增强调色板的可访问性
    
    参数:
        palette (list): 颜色列表，每个颜色为十六进制格式
        background_is_dark (bool): 背景是否为深色
        **kwargs: 配置选项
        
    返回:
        list: 转换后的颜色列表，每个元素为(hsl, hex)的元组
    """
    if background_is_dark:
        return convert_palette_for_dark_background(palette, **kwargs)
    else:
        return convert_palette_for_light_background(palette, **kwargs)

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

def convert_palette_for_dark_background(palette, **kwargs):
    """
    转换整个调色板以适应深色背景
    
    参数:
        palette (list): 颜色列表，每个颜色为十六进制格式
        **kwargs: 传递给adapt_color_for_dark_background的选项
        
    返回:
        list: 转换后的颜色列表，每个元素为(hsl, hex)的元组
    """
    converted_palette = []
    
    for color in palette:
        converted = adapt_color_for_dark_background(color, **kwargs)
        converted_palette.append(converted)
    
    return converted_palette


fixed_color_palette = [
    ["#4269d0","#efb118","#ff725c","#6cc5b0","#3ca951","#ff8ab7","#a463f2","#97bbf5","#9c6b4e","#9498a0"],
    ["#4e79a7","#f28e2c","#e15759","#76b7b2","#59a14f","#edc949","#af7aa1","#ff9da7","#9c755f","#bab0ab"],
    ["#66c2a5","#fc8d62","#8da0cb","#e78ac3","#a6d854","#ffd92f","#e5c494","#b3b3b3"],
]

dark_background_colors = [
    "#1e2130", "#1a1a2e", "#191919", "#162447", 
    "#2d3142", "#1f2b44", "#2b2b3d", "#282828", "#243447", 
    "#373e57", "#343434", "#203a43", "#1c2541", "#2c2c34", 
    "#2e2e2e", "#254362", "#352f44", "#204051", "#303030"
]

class ColorRecommender:
    def __init__(self, embed_model_path: str = "all-MiniLM-L6-v2", data_path: str = None, index_path: str = None):
        self.color_schemes = {}
        self.index_builder = ColorIndexBuilder(embed_model_path=embed_model_path, data_path=data_path, index_path=index_path)
        self.index_builder.load_index()
        black = (21, 21, 21)
        white = (240, 240, 240)
        gray1 = (75, 75, 75)
        gray2 = (150, 150, 150)
        gray3 = (200, 200, 200)
        self.basic_colors = [black, white, gray1, gray2, gray3]
        self.basic_colors_hex = [rgb_to_hex(*color) for color in self.basic_colors]

    def create_query_text(self, input_data: Dict) -> str:
        """Create a text query from input data for finding similar color palettes."""
        data_dict = input_data.get("data", {})
        columns = data_dict.get("columns", [])
        metadata = input_data.get("metadata", {})
        
        text_parts = []
        
        # Add column information
        column_texts = []
        for col in columns:
            col_text = f"{col['name']} ({col['data_type']})"
            if 'description' in col:
                col_text += f": {col['description']}"
            column_texts.append(col_text)
        text_parts.append(" ".join(column_texts))
        
        # Add metadata
        if 'title' in metadata:
            text_parts.append(metadata['title'])
        if 'description' in metadata:
            text_parts.append(metadata['description'])
        if 'main_insight' in metadata:
            text_parts.append(metadata['main_insight'])
            
        return " ".join(text_parts)

    def determine_by_group(self, columns: List[Dict], combination: str) -> Optional[str]:
        """
        Determine which column to use for grouping based on the combination type.
        
        Args:
            columns: List of column dictionaries containing name and data_type
            combination: Type of combination (e.g., "categorical + numerical")
            
        Returns:
            The column name to use for grouping, or None if no grouping should be used
        """
        column_names = [col["name"] for col in columns]
        if combination == "categorical + numerical" or combination == "categorical + numerical + numerical":
            return column_names[0]
        elif combination == "categorical + numerical + categorical":
            return column_names[2]
        elif combination == "temporal + numerical + categorical":
            return column_names[2]
        elif combination == "temporal + numerical":
            return column_names[0]
        elif combination == "categorical + numerical + temporal":
            return column_names[0]
        else:
            ret = None
            for col in columns:
                if col["data_type"] == "categorical" or col["data_type"] == "temporal":
                    ret = col["name"]
            return ret

    def should_color_by_group(self, by_group: str, data: pd.DataFrame, columns: List[Dict]) -> bool:
        """
        Determine whether to use color grouping based on the column's unique values and type.
        
        Args:
            by_group: Column name to check
            data: DataFrame containing the data
            columns: List of column dictionaries containing name and data_type
            
        Returns:
            True if color grouping should be used, False otherwise
        """
        if by_group is None:
            return False
            
        unique_values = data[by_group].nunique()
        column_type = next((col["data_type"] for col in columns if col["name"] == by_group), "")
        
        if column_type == "temporal" and unique_values >= 5:
            return False
        elif column_type == "categorical" and unique_values >= 8:
            return False
            
        return True

    def get_required_color_num(self, by_group: Optional[str], data: pd.DataFrame) -> int:
        """
        Calculate the number of colors required based on grouping.
        
        Args:
            by_group: Column name used for grouping
            data: DataFrame containing the data
            
        Returns:
            Number of colors required
        """
        if by_group is None:
            return 1
        return data[by_group].nunique()

    def select_suitable_palette(self, similar_palettes: List[Dict], required_color_num: int) -> Dict:
        """
        Select a suitable palette from similar palettes based on color count requirements.
        
        Args:
            similar_palettes: List of similar palettes with their distances
            required_color_num: Number of colors required
            
        Returns:
            Selected palette dictionary
        """
        # Filter palettes that have enough colors
        suitable_palettes = [
            p for p in similar_palettes 
            if 'main_color' in p['palette'] and len(p['palette']['main_color']) >= required_color_num + 1 and len(p['palette']['main_color']) <= required_color_num + 3
        ]
        
        if len(suitable_palettes) == 0:
            # If no palette has enough colors, use the most similar one
            return random.choice(similar_palettes[:3])['palette']
            
        # TODO: Implement custom selection logic based on requirements
        return random.choice(suitable_palettes[:3])['palette']

    def recommend_colors(self, input_data: Dict) -> Dict:
        """
        Recommend colors based on the input data.
        
        Args:
            input_data: Dictionary containing the input data
            
        Returns:
            Dictionary containing the recommended color scheme
        """
        # Extract necessary information from input_data
        data_dict = input_data.get("data", {})
        data = pd.DataFrame(data_dict.get("data", []))
        columns = data_dict.get("columns", [])
        combination = data_dict.get("type_combination", "")
        
        # Step 1: Determine by_group
        by_group = self.determine_by_group(columns, combination)
        
        # Step 2: Check if we should color by group
        should_group = self.should_color_by_group(by_group, data, columns)
        if not should_group:
            by_group = None
            
        # Step 3: Get required number of colors
        required_color_num = self.get_required_color_num(by_group, data)
        
        # Step 4: Find similar color palettes
        query_text = self.create_query_text(input_data)
        similar_palettes = self.index_builder.find_similar_palettes(query_text, k=25)
        # Step 5: Select a suitable palette
        selected_palette = self.select_suitable_palette(similar_palettes, required_color_num)

        if not selected_palette or len(selected_palette["main_color"]) <= required_color_num:
            scheme = fixed_color_palette[random.randint(0, len(fixed_color_palette) - 1)]
            new_selected_palette = {
                "mode": "monochrome",
                "color_list": scheme,
                "main_color": scheme,
                "num_of_colors": len(scheme),
                "bcg": selected_palette["bcg"],
                "context_colors": selected_palette["context_colors"],
                "similar_to_bcg": selected_palette["similar_to_bcg"],
            }
            selected_palette = new_selected_palette
        # Step 6: Create the color scheme
        color_scheme = {
            "field": {},
            "other": {
                "primary": None,
            },
            "available_colors": [],
            "background_color": selected_palette["bcg"],
            "text_color": self.basic_colors_hex[0]
        }
        
        colors = selected_palette["main_color"] + selected_palette["context_colors"]
        if by_group:
            unique_values = data[by_group].unique()
            first_numerical_value = None
            for col in columns:
                if col["data_type"] == "numerical":
                    first_numerical_value = col["name"]
                    break
            unique_values = [(value, data[first_numerical_value][data[by_group] == value].mean()) for value in unique_values]
            unique_values.sort(key=lambda x: -x[1])
            unique_values = [value[0] for value in unique_values]
            color_scheme["other"]["primary"] = selected_palette["main_color"][0]
            for i, value in enumerate(unique_values):
                color_scheme["field"][str(value)] = selected_palette["main_color"][i]
            if required_color_num < len(colors):
                color_scheme["other"]["secondary"] = colors[required_color_num]
                for i in range(required_color_num + 1, len(colors)):
                    color_scheme["available_colors"].append(colors[i])
        else:
            required_color_num = 1
            color_scheme["other"]["primary"] = selected_palette["main_color"][0]
            if required_color_num < len(colors):
                color_scheme["other"]["secondary"] = colors[required_color_num]
                for i in range(required_color_num + 1, len(colors)):
                    color_scheme["available_colors"].append(colors[i])
        
        return color_scheme

def process(input: str, output: str, embed_model_path: str = "all-MiniLM-L6-v2", base_url: str = None, api_key: str = None, data_path: str = None, index_path: str = None) -> bool:
    """
    Pipeline入口函数，处理单个文件的颜色推荐
    
    Args:
        input_path: 输入JSON文件路径
        output_path: 输出JSON文件路径
        embed_model_path: 嵌入模型路径
    """
    print(f"Processing {input} to {output}")
    try:
        # 读取输入文件
        with open(input, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # 预处理数据，确保类型正确
        processed_data = preprocess_data(data)
        
        # 生成颜色推荐
        recommender = ColorRecommender(embed_model_path=embed_model_path, data_path=data_path, index_path=index_path)
        color_result = recommender.recommend_colors(processed_data)
        
        lighter_color_result = deepcopy(color_result)
        for k, v in lighter_color_result.items():
            if isinstance(v, list):
                lighter_color_result[k] = convert_palette_for_light_background(v)
            elif isinstance(v, dict):
                for k2, v2 in v.items():
                    lighter_color_result[k][k2] = convert_palette_for_light_background([v2])[0]
            elif isinstance(v, str) and k != "background_color":
                lighter_color_result[k] = convert_palette_for_light_background([v])[0]


        darker_color_result = deepcopy(color_result)
        for k, v in darker_color_result.items():
            if isinstance(v, list):
                darker_color_result[k] = convert_palette_for_dark_background(v)
            elif isinstance(v, dict):
                for k2, v2 in v.items():
                    darker_color_result[k][k2] = convert_palette_for_dark_background([v2])[0]
            elif isinstance(v, str) and k != "background_color":
                darker_color_result[k] = convert_palette_for_dark_background([v])[0]
            elif k == "background_color":
                darker_color_result[k] = random.choice(dark_background_colors)
        
        # 添加颜色方案到数据中
        processed_data["colors"] = lighter_color_result
        processed_data["colors_dark"] = darker_color_result
        
        # 保存结果
        with open(output, "w", encoding="utf-8") as f:
            json.dump(processed_data, f, indent=2, ensure_ascii=False)
            
        return True
            
    except Exception as e:
        print(f"Processing {input} failed: {str(e)}")
        return False

def preprocess_data(data: Dict) -> Dict:
    """
    预处理数据，处理类型转换问题
    """
    try:
        # 深拷贝避免修改原始数据
        processed = data.copy()
        
        # 确保data字段存在且格式正确
        if "data" in processed and isinstance(processed["data"], dict):
            # 处理数据部分
            if "data" in processed["data"]:
                rows = processed["data"]["data"]
                if isinstance(rows, list):
                    # 处理每一行数据
                    for i, row in enumerate(rows):
                        if isinstance(row, dict):
                            # 尝试将数值字符串转换为数值类型
                            for key, value in row.items():
                                if isinstance(value, str):
                                    try:
                                        # 尝试转换为数值
                                        if '.' in value:
                                            row[key] = float(value)
                                        else:
                                            row[key] = int(value)
                                    except (ValueError, TypeError):
                                        # 如果转换失败，保持原始值
                                        pass
                                elif value is None:
                                    # 将None替换为0或其他适当的默认值
                                    row[key] = 0
        
        return processed
        
    except Exception as e:
        logger.error(f"数据预处理失败: {str(e)}")
        raise

def main():
    parser = argparse.ArgumentParser(description="Color Recommender")
    parser.add_argument("--input", type=str, required=True, help="Input JSON file path")
    parser.add_argument("--output", type=str, required=True, help="Output JSON file path")
    parser.add_argument("--embed_model_path", type=str, default="all-MiniLM-L6-v2", 
                        help="Path to the embedding model")
    args = parser.parse_args()

    success = process(input=args.input, output=args.output, 
                     embed_model_path=args.embed_model_path)

    if success:
        print("Processing json successed.")
    else:
        print("Processing json failed.")

if __name__ == "__main__":
    main() 