from .area_chart import AreaChart
from typing import Dict
from ..components.color_encoding.color_encoding import color_by_sign
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Area Chart",
    "chart_name": "area_chart_0",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal","numerical"], ["numerical"]],
    "supported_effects": [],
    "required_data_points": [5, 100],
    "required_image": [],
    "width": [500, 1000],
    "height": [500, 800],
    "x_range": [2, 20]
}
REQUIREMENTS_END
"""

class AreaChart0(AreaChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        return mark_spec
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        x_encoding_spec['axis']['domainOpacity'] = 0
        x_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['domainOpacity'] = 0
        y_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['grid'] = True
        return x_encoding_spec, y_encoding_spec
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        return color_by_sign(json_data)
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        y_column = None
        for data_column in json_data['data']['columns']:
            if data_column['role'] == 'y':
                y_column = data_column
        transfrom = [
            {
                "calculate": f"datum['{y_column['name']}']<0 ? 'positive' : 'negative'",
                "as": "sign"
            }
        ]
        specification['transform'] = transfrom
        return specification
    
    def adjust_legend_position(self):
        pass