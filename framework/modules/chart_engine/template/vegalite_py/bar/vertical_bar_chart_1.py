from modules.chart_engine.template.vegalite_py.bar.vertical_bar_chart import VerticalBarChart
from typing import Dict
from modules.chart_engine.template.vegalite_py.components.color_encoding.color_encoding import color_by_sign
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_1",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
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

class VerticalBarChart1(VerticalBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    def make_axis_specification(self, json_data: Dict) -> Dict:
        y_column = None
        for data_column in json_data['data']['columns']:
            if data_column['role'] == 'y':
                y_column = data_column
        x_encoding_specification, y_encoding_specification = super().make_axis_specification(json_data)
        y_encoding_specification['axis']['domainOpacity'] = 0
        y_encoding_specification['axis']['tickOpacity'] = 0
        x_encoding_specification['axis']['domainOpacity'] = 0
        
        y_encoding_specification['axis']['grid'] = True
        
        y_encoding_specification['axis']['gridColor'] = "black"
        y_encoding_specification['axis']['gridWidth'] = {
            "condition": {"test": f"(datum['{y_column['name']}'] - 0.0) < 0.00001", "value": 3},
            "value": 1
        }
        y_encoding_specification['axis']['gridDash'] = {
            "condition": {"test": f"(datum['{y_column['name']}'] - 0.0) < 0.00001", "value": None},
            "value": [1, 2]
        }
        return x_encoding_specification, y_encoding_specification
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        return color_by_sign(json_data)

    def make_annotation_specification(self, json_data: Dict) -> Dict:
        pass

    def adjust_legend_position(self):
        pass
    
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

    # def apply_icon_mark_side(self, json_data: Dict):
    #     data_columns = json_data['data']['columns']
    #     images = json_data['images']
    #     field_image_map = images['field']
    #     x_column = None
    #     for data_column in data_columns:
    #         if data_column['name'] == 'x':
    #             x_column = data_column
    #     x_image_map = field_image_map['x']
    #     for mark in self.marks:
            