import json
from typing import Dict, List, Optional, Union
import pandas as pd
import random
import argparse
import os
from logging import getLogger
logger = getLogger(__name__)
from .color_index_builder import ColorIndexBuilder

def rgb_to_hex(r, g, b):
    r = max(0, min(int(r), 255))
    g = max(0, min(int(g), 255))  
    b = max(0, min(int(b), 255))
    return '#{:02x}{:02x}{:02x}'.format(r, g, b)

class ColorRecommender:
    def __init__(self, embed_model_path: str = "all-MiniLM-L6-v2", data_path: str = None, index_path: str = None):
        self.color_schemes = {
            "colors": {
                "field": {
                    "US": "blue",
                    "China": "red",
                    "Russia": "green",
                    "Germany": "yellow",
                    "Brazil": "purple"
                },
                "other": {
                    "primary": "#E63946",
                    "secondary": "#457B9D"
                },
                "available_colors": ["#A9D700", "#FFD700", "#008080", "#4B0082"],
                "background_color": "#FFFFFF",
                "text_color": "#1D3557"
            }
        }
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
            return None

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
            if 'main_color' in p['palette'] and len(p['palette']['main_color']) >= required_color_num + 1
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

        if len(selected_palette["main_color"]) <= required_color_num:
            by_group = None
        
        '''
         {
            "mode": "monochrome",
            "color_list": [
                "#A34C40"
            ],
            "main_color": [
                "#A34C40"
            ],
            "bcg": "#E2F1F6",
            "context_colors": [
                "#868686",
                "#1C2220",
                "#B5B5B5",
                "#374A5C",
                "#E2B0B6"
            ],
            "similar_to_bcg": [
                "#E7E7E7"
            ],
            "other_colors": [],
            "num_of_colors": 1,
            "text": "Despite Covid, Vaccines Account for Minor Share of Pharma Sales Estimated global vaccine revenue as a share of total pharmaceuticals revenue",
            "fact": "While vaccine revenue increased significantly in 2021, it still represented a relatively small portion of overall pharmaceutical sales compared to other drugs.",
            "columns": [
                "Year",
                "Vaccines",
                "Total Pharmaceutical Revenue",
                "Other Drugs"
            ]
        }
        '''
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
    try:
        # 读取输入文件
        with open(input, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # 预处理数据，确保类型正确
        processed_data = preprocess_data(data)
        
        # 生成颜色推荐
        recommender = ColorRecommender(embed_model_path=embed_model_path, data_path=data_path, index_path=index_path)
        color_result = recommender.recommend_colors(processed_data)
        
        # 添加颜色方案到数据中
        processed_data["colors"] = color_result
        
        # 保存结果
        with open(output, "w", encoding="utf-8") as f:
            json.dump(processed_data, f, indent=2, ensure_ascii=False)
            
        return True
            
    except Exception as e:
        logger.error(f"颜色推荐失败: {str(e)}")
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