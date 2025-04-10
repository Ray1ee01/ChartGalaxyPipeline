from modules.chart_engine.template.vegalite_py.template import VegaLiteTemplate
from modules.chart_engine.template.vegalite_py.bar.vertical_bar_chart import VerticalBarChart
from typing import Dict

"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart",
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

class VerticalGroupBarChart(VerticalBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        group_column = None 
        for column in json_data['data']['columns']:
            if column['role'] == 'group':
                group_column = column['name']
                break
        field_color_map = json_data['colors']['field']
        domains = []
        ranges = []
        for key, value in field_color_map.items():
            domains.append(key)
            ranges.append(value)
        if len(domains) > 0:
            color_spec = {
                "field": group_column,
                "scale": {
                    "domain": domains,
                    "range": ranges
                }
            }
        else:
            color_spec = {
                "field": group_column
            }
        return color_spec
        
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        encoding = specification['encoding']
        data_columns = json_data['data']['columns']
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