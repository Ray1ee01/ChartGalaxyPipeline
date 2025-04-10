
from .vertical_group_bar_chart_2 import VerticalGroupBarChart2
from typing import Dict
from modules.chart_engine.utils.element_tool.elements import BoundingBox
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_3",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_other_colors": [],
    "supported_effects": [],
    "required_data_points": [5, 100],
    "required_image": [],
    "width": [500, 1000],
    "height": [500, 800],
    "x_range": [2, 20]
}
REQUIREMENTS_END
"""

class VerticalGroupBarChart3(VerticalGroupBarChart2):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        x_encoding_spec['axis']['grid'] = False
        x_encoding_spec['axis']['tickOpacity'] = 0
        x_encoding_spec['axis']['domainOpacity'] = 0
        y_encoding_spec['axis']['grid'] = False
        y_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['domainOpacity'] = 0
        y_encoding_spec['axis']['labels'] = False
        return x_encoding_spec, y_encoding_spec
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = super().make_color_specification(json_data)
        return color_spec

    def make_annotation_specification(self, json_data: Dict) -> Dict:
        annotation_encoding_spec = super().make_annotation_specification(json_data)
        print(annotation_encoding_spec)
        annotation_encoding_spec['mark']['dx'] = 10
        return annotation_encoding_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        return specification
    
    def adjust_legend_position(self):
        super().adjust_legend_position()