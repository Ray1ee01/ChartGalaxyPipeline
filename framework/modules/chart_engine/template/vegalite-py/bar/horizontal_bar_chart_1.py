from .horizontal_bar_chart import HorizontalBarChart
from typing import Dict
from ..components.color_encoding.color_encoding import x_gradient_to_half
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_1",
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

class HorizontalBarChart1(HorizontalBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)
    
    def make_mark_specification(self, json_data: Dict) -> Dict:
        # return super().make_mark_specification(json_data)
        mark_spec = super().make_mark_specification(json_data)
        mark_spec["height"] = {
            "band": 0.65
        }
        return mark_spec
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        x_encoding_spec['axis']['domainOpacity'] = 0
        y_encoding_spec['axis']['domainOpacity'] = 1
        x_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['tickOpacity'] = 0
        x_encoding_spec['axis']['labelLimit'] = 1000
        y_encoding_spec['axis']['labelLimit'] = 1000
        x_encoding_spec['axis']['labels'] = False
        return x_encoding_spec, y_encoding_spec

    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = x_gradient_to_half(json_data, "#ffffff")
        return color_spec
    
    def make_annotation_specification(self, json_data: Dict) -> Dict:
        text_color = json_data['colors']['text_color']
        annotation_typography = json_data['typography']['annotation']
        annotation_mark_spec = {
            "type": "text",
            "align": "center",
            "baseline": "middle",
            "dx": 20,
            "dy": 0,
            "font": annotation_typography['font_family'],
            "fontSize": annotation_typography['font_size'].replace('px', ''),
            "fontWeight": annotation_typography['font_weight'],
            "color": text_color
        }
        data_columns = json_data['data']['columns']
        x_column = None
        y_column = None
        for column in data_columns:
            if column['role'] == 'x':
                x_column = column
            if column['role'] == 'y':
                y_column = column
        annotation_encoding_spec = {
            "text": {
                "field": y_column['name'],
                "type": "quantitative",
            },
            "y": {
                "field": x_column['name'],
                "type": "ordinal",
                "sort": None
            },
            "x": {
                "field": y_column['name'],
                "type": "quantitative",
            },
        }
        annotation_spec = {
            "mark": annotation_mark_spec,
            "encoding": annotation_encoding_spec
        }
        return annotation_spec
    
    def adjust_legend_position(self):
        pass
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        annotation_encoding_spec = self.make_annotation_specification(json_data)

        old_encoding = specification['encoding']
        old_mark = specification['mark']
        specification["layer"] = [
            {
                "mark": old_mark,
                "encoding": old_encoding
            },
            annotation_encoding_spec
        ]
        # 从specification中删除encoding和mark
        del specification['encoding']
        del specification['mark']
        return specification