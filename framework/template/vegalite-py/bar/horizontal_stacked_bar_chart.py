from .horizontal_bar_chart import HorizontalBarChart
from typing import Dict

"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "supported_effects": [],
    "required_data_points": [5, 100],
    "required_image": [],
    "width": [500, 1000],
    "height": [500, 800],
    "x_range": [2, 20]
}
REQUIREMENTS_END
"""

class HorizontalStackedBarChart(HorizontalBarChart):
    def __init__(self):
        super().__init__()

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        return mark_spec
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        return super().make_color_specification(json_data)
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        encoding = specification['encoding']
        data_columns = json_data['data_columns']
        group_column = None
        for column in data_columns:
            if column['role'] == 'group':
                group_column = column['name']
                break
        if group_column is not None:
            encoding['xOffset'] = {'field': group_column}
        else:
            raise ValueError("Group column not found in data columns")
        return specification
