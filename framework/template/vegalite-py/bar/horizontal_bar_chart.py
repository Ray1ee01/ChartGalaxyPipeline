from .vertical_bar_chart import VerticalBarChart
from typing import Dict
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_01",
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

class HorizontalBarChart(VerticalBarChart):
    def __init__(self):
        super().__init__()
    
    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        mark_styles = json_data['variables']['mark']
        if mark_styles['has_spacing']:
            mark_spec['height'] = {"band": 0.6}
        else:
            mark_spec['height'] = {"band": 0.8}
        return mark_spec

    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        return y_encoding_spec, x_encoding_spec

    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = super().make_color_specification(json_data)
        return color_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        return specification