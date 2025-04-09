from .horizontal_bar_chart_1 import HorizontalBarChart1
from typing import Dict
from modules.chart_engine.template.vegalite-py.components.color_encoding.color_encoding import x_one_lighter
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_2",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "supported_effects": [],
    "required_data_points": [5, 100],
    "required_image": [],
    "width": [500, 1000],
    "height": [500, 800],
    "x_range": [2, 20]
}
REQUIREMENTS_END
"""

class HorizontalBarChart2(HorizontalBarChart1):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)
    
    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        mark_spec["height"] = {
            "band": 0.75
        }
        return mark_spec
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        return x_encoding_spec, y_encoding_spec

    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = x_one_lighter(json_data)
        return color_spec
    
    def make_annotation_specification(self, json_data: Dict) -> Dict:
        return super().make_annotation_specification(json_data)
    
    def adjust_legend_position(self):
        pass
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        return specification
    
    