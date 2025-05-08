import json
import pandas as pd
import random
import re
import os
from typing import Dict, List, Tuple, Any, Optional, Callable
import logging

logger = logging.getLogger("InstructionGeneration.Template.BaseGenerator")
variation_path = "./variation.json"
variation_data = json.load(open(variation_path, 'r'))

class BaseGenerator:
    def __init__(self, data_path: str):
        self.data_path = data_path
        self.data = None
        self.df = None
        self.columns_info = None
        self.decimal_places = None # 存放 tabular data 中小数位数
        self.image_path = None
        self.svg_path = None
        self.info = None
    
    def load_data(self) -> pd.DataFrame:
        """ 加载和解析数据目录中的文件 """
        try:
            # 判断data_path是目录还是文件
            if os.path.isdir(self.data_path):
                # 如果是目录，加载目录中的数据文件
                data_file = os.path.join(self.data_path, "data.json")
                info_file = os.path.join(self.data_path, "info.json")
                self.image_path = os.path.join(self.data_path, "chart.png") 
                self.svg_path = os.path.join(self.data_path, "chart.svg")
                
                # 加载数据文件
                with open(data_file, 'r') as f:
                    data_content = json.load(f)
                
                # 加载信息文件
                if os.path.exists(info_file):
                    with open(info_file, 'r') as f:
                        self.info = json.load(f)
                self.requirements = variation_data[self.info["chart_variation"]]
                
                original_data_file = self.info["data_source"]
                with open(original_data_file, 'r') as f:
                    original_data = json.load(f)
                self.field_images = original_data["images"]["field"]
                
                # 构建数据结构
                self.data = {
                    'data': data_content
                }
            else:
                # 如果是文件，按原来的方式加载
                with open(self.data_path, 'r') as f:
                    self.data = json.load(f)
            
            # 转换为DataFrame以便处理
            self.df = pd.DataFrame(self.data['data']['data'])
            self.columns_info = {col['name']: col for col in self.data['data']['columns']}

            self.detect_decimal_places()
            
            return self.df
        except Exception as e:
            logger.error(f"加载数据错误: {e}")
            return None
        
    def get_image_path(self) -> str:
        """获取图表图像路径"""
        return self.image_path
        
    def get_svg_path(self) -> str:
        """获取SVG路径"""
        return self.svg_path
    
    def get_field_images(self, field_name: str) -> Dict:
        """获取field_images，并验证SVG中是否使用了该字段对应的base64图像
        
        Args:
            field_name: 字段名称
            
        Returns:
            如果SVG中使用了该字段的base64图像，则返回对应的field_images字典，否则返回None
        """
        field_image = self.field_images.get(field_name, None)
        
        if field_image is None:
            return None
            
        # 获取SVG内容
        svg_path = self.get_svg_path()
        if svg_path and os.path.exists(svg_path):
            try:
                with open(svg_path, 'r', encoding='utf-8') as f:
                    svg_content = f.read()
                    
                # 判断base64是否在SVG内容中使用
                # field_image本身就是base64字符串
                if isinstance(field_image, str) and field_image.startswith('data:image') and svg_content.count(field_image) == 1:
                    return field_image
                
                # 如果没有找到匹配的base64，返回None
                return None
            except Exception as e:
                logger.error(f"读取SVG文件错误: {e}")
                return None
        
        return None
        
    def get_info(self) -> Dict:
        """获取info.json中的信息"""
        return self.info
    
    def get_requirements(self) -> Dict:
        """获取requirements.json中的信息"""
        return self.requirements
    
    def detect_decimal_places(self) -> int:
        """ 检测数据中的小数位数 """
        if self.df is None:
            return 0
            
        max_decimal_places = 0
        y_label = self.get_column_by_role('y')
        
        if y_label and y_label in self.df.columns:
            # 仅分析数值列
            if pd.api.types.is_numeric_dtype(self.df[y_label]):
                # 将列转换为字符串以进行小数位数分析
                str_values = self.df[y_label].astype(str)
                
                # 正则表达式匹配小数部分
                decimal_pattern = re.compile(r'\.(\d+)')
                
                for val in str_values:
                    match = decimal_pattern.search(val)
                    if match:
                        decimal_places = len(match.group(1))
                        max_decimal_places = max(max_decimal_places, decimal_places)
        
        self.decimal_places = max_decimal_places
        return max_decimal_places
    
    def get_decimal_places(self) -> int:
        """ 获取检测到的小数位数 """
        return self.decimal_places if self.decimal_places is not None else 2
    
    def get_column_names(self) -> List[str]:
        """ 获取所有列名 """
        return [col['name'] for col in self.data['data']['columns']]
    
    def get_column_by_role(self, role: str) -> Optional[str]:
        for col in self.data['data']['columns']:
            if col['role'] == role:
                return col['name']
        return None
    
    def get_column_values(self, column_name: str) -> List:
        if column_name in self.df.columns:
            return list(self.df[column_name].unique())
        return []
    
    def replace_placeholders(self, template: str, placeholder_values: Dict[str, str]) -> str:
        """ 替换模板中的占位符 """
        result = template
        for placeholder, value in placeholder_values.items():
            result = result.replace(f"<{placeholder}>", str(value))
        return result
    
    def singularize(self, word: str) -> str:
        """ 单复数转换 """
        if word.endswith('ies'):
            return word[:-3] + 'y'
        elif word.endswith('es'):
            return word[:-2]
        elif word.endswith('s'):
            return word[:-1]
        return word
    
    def get_filtered_data(self, filter_dict: Optional[Dict] = None) -> pd.DataFrame:
        """ 构建过滤条件 """
        if filter_dict:
            filtered_df = self.df.copy()
            for key, value in filter_dict.items():
                filtered_df = filtered_df[filtered_df[key] == value]
            return filtered_df
        return self.df.copy()
    
    def get_sum(self, column_name: str, filter_dict: Optional[Dict] = None) -> float:
        filtered_df = self.get_filtered_data(filter_dict)
        return filtered_df[column_name].sum()
    
    def get_average(self, column_name: str, filter_dict: Optional[Dict] = None) -> float:
        filtered_df = self.get_filtered_data(filter_dict)
        return filtered_df[column_name].mean()
    
    def get_median(self, column_name: str, filter_dict: Optional[Dict] = None) -> float:
        filtered_df = self.get_filtered_data(filter_dict)
        return filtered_df[column_name].median()
    
    def get_max(self, column_name: str, filter_dict: Optional[Dict] = None) -> float:
        filtered_df = self.get_filtered_data(filter_dict)
        return filtered_df[column_name].max()
    
    def get_min(self, column_name: str, filter_dict: Optional[Dict] = None) -> float:
        filtered_df = self.get_filtered_data(filter_dict)
        return filtered_df[column_name].min()
    
    def get_value(self, column_name: str, filter_dict: Dict) -> Any:
        filtered_df = self.get_filtered_data(filter_dict)
        
        if not filtered_df.empty and column_name in filtered_df.columns:
            return filtered_df[column_name].sum()
        return None
    
    def get_difference(self, column_name: str, filter_dict1: Dict, filter_dict2: Dict) -> Optional[float]:
        val1 = self.get_value(column_name, filter_dict1)
        val2 = self.get_value(column_name, filter_dict2)
        
        if val1 is not None and val2 is not None:
            return float(val1) - float(val2)
        return None
    
    def is_temporal_column(self, column_name: str) -> bool:
        """ 判断一个列是否为时间变量 """
        if column_name is None or self.columns_info is None:
            return False
        
        column_info = self.columns_info.get(column_name, {})
        
        data_type = column_info.get('data_type', '').lower()
        return data_type == 'temporal'
    
    def get_common_placeholders(self, use_y_label: bool=True, use_singular_x_label: bool=True, use_plural_x_label: bool=True,
                                legend_num: int=0, tick_num: int=0, use_threshold: bool=False) -> Tuple[Dict[str, str], List[str], List[str]]:
        """ 返回值是三元组，分别是构建的替换 dict, 所有 ticks, 所有 legends """
        placeholders = {}
        
        y_label = self.get_column_by_role('y')
        x_label = self.get_column_by_role('x')
        
        if y_label and use_y_label:
            placeholders["Y label"] = y_label
        
        if x_label:
            placeholders["X label"] = x_label
            if use_singular_x_label:
                placeholders["plural form of X label"] = x_label
            if use_plural_x_label:
                placeholders["singular form of X label"] = self.singularize(x_label)

        selected_legends = []
        if legend_num > 0:
            selected_legends, placeholders_legends = self.get_random_legend_values(legend_num)
            placeholders.update(placeholders_legends)

        selected_ticks = []
        if tick_num > 0:
            selected_ticks, placeholders_ticks = self.get_random_x_ticks(tick_num)
            placeholders.update(placeholders_ticks)

        if use_threshold:
            N = self.calculate_threshold()
            placeholders["N"] = str(N)

        return placeholders, selected_legends, selected_ticks
    
    def get_random_x_ticks(self, count: int = 2) -> Tuple[List[str], Dict[str, str]]:
        """ 获取随机 ticks """
        x_label = self.get_column_by_role('x')
        x_ticks = self.get_column_values(x_label)
        
        if len(x_ticks) < count:
            return [], {}
        
        indices = random.sample(range(len(x_ticks)), count)
        selected_ticks = [x_ticks[i] for i in indices]
        
        placeholders = {}
        for i, tick in enumerate(selected_ticks):
            if i == 0:
                placeholders["ithx tick"] = str(tick)
            elif i == 1:
                placeholders["jthx tick"] = str(tick)
            elif i == 2:
                placeholders["kthx tick"] = str(tick)
            else:
                placeholders[f"{i+1}thx tick"] = str(tick)
        
        return selected_ticks, placeholders
    
    def get_random_legend_values(self, count: int = 1) -> Tuple[List[str], Dict[str, str]]:
        """ 获取随机 legends """
        group_label = self.get_column_by_role('group')
        if not group_label:
            return [], {}
            
        group_values = self.get_column_values(group_label)
        if len(group_values) < count:
            return [], {}
            
        selected_legends = random.sample(group_values, count)
        
        placeholders = {}
        for i, legend in enumerate(selected_legends):
            key = "legend label" if len(selected_legends) == 1 else f"legend label{i+1}"
            placeholders[key] = str(legend)
        
        return selected_legends, placeholders
    
    def get_filter_dict(self, x_tick=None, legend_value=None) -> Dict[str, Any]:
        """ 构建过滤 dict """
        filter_dict = {}
        
        x_label = self.get_column_by_role('x')
        group_label = self.get_column_by_role('group')
        
        if x_tick is not None and x_label:
            filter_dict[x_label] = x_tick
            
        if legend_value is not None and group_label:
            filter_dict[group_label] = legend_value
            
        return filter_dict
    
    def calculate_threshold(self, position: float = 1/3) -> Optional[float]:
        """
        计算一个合理的阈值
        
        Args:
            position: 在最小值和最大值之间的相对位置
        """
        y_label = self.get_column_by_role('y')
        
        if self.df is not None and y_label in self.df.columns:
            y_min = self.get_min(y_label)
            y_max = self.get_max(y_label)
            
            if y_min is not None and y_max is not None:
                threshold = y_min + (y_max - y_min) * position
                return round(threshold, self.get_decimal_places())
                
        return None
        
    def check_condition_for_all_x(self, condition_func: Callable, **kwargs) -> bool:
        """
        检查所有X值是否满足条件
        
        Args:
            condition_func: 接受x_tick和其他参数的条件函数
            **kwargs: 传递给条件函数的其他参数
        """
        x_label = self.get_column_by_role('x')
        x_values = self.get_column_values(x_label)
        
        for x_val in x_values:
            if not condition_func(x_val, **kwargs):
                return False
                
        return True
    
    def get_extreme_value_x(self, extreme_type: str, legend_value=None) -> Optional[str]:
        """
        获取Y值达到极值的X值
        
        Args:
            extreme_type: 'max'或'min'
            legend_value: 图例值（可选）
        """
        y_label = self.get_column_by_role('y')
        x_label = self.get_column_by_role('x')
        
        filter_dict = {}
        group_label = self.get_column_by_role('group')
        if legend_value and group_label:
            filter_dict[group_label] = legend_value
            
        filtered_df = self.get_filtered_data(filter_dict)
        
        if not filtered_df.empty and x_label in filtered_df.columns and y_label in filtered_df.columns:
            if extreme_type == 'max':
                extreme_idx = filtered_df[y_label].idxmax()
            else:  # min
                extreme_idx = filtered_df[y_label].idxmin()
                
            if extreme_idx is not None:
                return str(filtered_df.loc[extreme_idx, x_label])
                
        return None

    def get_nth_highest_value(self, column_name: str, n: int, filter_dict: Optional[Dict] = None) -> Optional[float]:
        """
        获取列的第n高值 (支持自定义过滤)
        
        Args:
            column_name: 列名
            n: 排名 (0为最高, 1为第二高, -1为最低)
            filter_dict: 可选的过滤字典
        """
        filtered_df = self.get_filtered_data(filter_dict)
        
        if not filtered_df.empty and column_name in filtered_df.columns:
            values = sorted(filtered_df[column_name].unique(), reverse=True)
            
            # 特殊情况：-1表示最低值
            if n == -1 and values:
                return values[-1]
                
            if 0 <= n < len(values):
                return values[n]
