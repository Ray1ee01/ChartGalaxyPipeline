from .vertical_bar_chart import VerticalBarChart
from typing import Dict
from modules.chart_engine.utils.color_tool.base import interpolate_color2
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_0",
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

class VerticalBarChart0(VerticalBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)

    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        x_encoding_spec['axis']['domainOpacity'] = 0
        y_encoding_spec['axis']['domainOpacity'] = 0
        x_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['labels'] = False
        return x_encoding_spec, y_encoding_spec
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        main_color = json_data['colors']['available_colors'][0]
        darker_color = interpolate_color2(main_color, "#000000", 5)[1]
        darker_color = "#e2632c"
        x_column = None
        data_columns = json_data['data']['columns']
        for data_column in data_columns:
            if data_column['role'] == 'x':
                x_column = data_column['name']
                break
        x_values = []
        for item in json_data['data']['data']:
            x_values.append(item[x_column])
        x_values = list(dict.fromkeys(x_values))
        # 只有第一个颜色使用darker_color，其他使用main_color
        color_list = [darker_color] + [main_color] * (len(x_values) - 1)
        color_spec = {
            "field": x_column,
            "type": "nominal",
            "scale": {"domain": x_values, "range": color_list},
            "legend": None
        }
        return color_spec
    def make_annotation_specification(self, json_data: Dict) -> Dict:
        text_color = json_data['colors']['text_color']
        annotation_typography = json_data['typography']['annotation']
        annotation_mark_spec = {
            "type": "text",
            "align": "center",
            "baseline": "middle",
            "dx": 0,
            "dy": -10,
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
                "field": y_column['name'],
                "type": "quantitative",
                "sort": None
            },
            "x": {
                "field": x_column['name'],
                "type": "ordinal",
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
            