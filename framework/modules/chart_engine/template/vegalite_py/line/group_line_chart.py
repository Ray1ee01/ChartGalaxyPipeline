from modules.chart_engine.template.vegalite_py.line.line_chart import LineChart
from typing import Dict

"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Group Line Chart",
    "chart_name": "group_line_chart_base",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal","numerical"], ["numerical"], ["categorical"]],
    "supported_effects": [],
    "required_other_colors": [],
    "required_data_points": [5, 100],
    "required_image": [],
    "width": [500, 1000],
    "height": [500, 800],
    "x_range": [2, 20]
}
REQUIREMENTS_END
"""

class GroupLineChart(LineChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        data_columns = json_data['data']['columns']
        group_column = None
        for column in data_columns:
            if column['role'] == 'group':
                group_column = column
        domains = []
        ranges = []
        for value, color in json_data['colors']['field'].items():
            ranges.append(color)
            domains.append(value)
        color_spec = {
            "field": group_column['name'],
            "scale": {
                "domain": domains,
                "range": ranges
            }
        }
        return color_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        return super().make_specification(json_data)
    