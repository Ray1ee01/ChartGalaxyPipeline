from .vertical_stacked_bar_chart import VerticalStackedBarChart
from typing import Dict
from utils.element_tool.elements import *
from utils.element_tool.variation import *
from PIL import Image as PILImage
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Vertical Stacked Bar Chart_0",
    "chart_name": "vertical_stacked_bar_chart_0",
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

class VerticalStackedBarChart0(VerticalStackedBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        return mark_spec
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        x_encoding_spec['axis']['domainOpacity'] = 0
        x_encoding_spec['axis']['tickOpacity'] = 0
        return x_encoding_spec, y_encoding_spec
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = super().make_color_specification(json_data)
        width = json_data['variables']['width']
        label_typography = json_data['typography']['label']
        color_spec['legend'] = {
            "orient": "top",
            "title": None,
            "labelFont": label_typography['font_family'],
            "labelFontSize": label_typography['font_size'].replace('px', ''),
            "labelFontWeight": label_typography['font_weight'],
            "padding": width/2,
            "offset": -width/2 + 10
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
            "dy": 0,
            "font": annotation_typography['font_family'],
            "fontSize": annotation_typography['font_size'].replace('px', ''),
            "fontWeight": annotation_typography['font_weight'],
            "color": '#ffffff'
        }
        data_columns = json_data['data_columns']
        x_column = None
        y_column = None
        group_column = None
        for column in data_columns:
            if column['role'] == 'x':
                x_column = column
            if column['role'] == 'y':
                y_column = column
            if column['role'] == 'group':
                group_column = column
        annotation_encoding_spec = {
            "text": {
                "field": y_column['name'],
                "type": "quantitative",
            },
            "x": {
                "field": x_column['name'],
                "type": "ordinal",
                "sort": None
            },
            "y": {
                "field": "y_mid",
                "type": "quantitative",
            },
        }
        annotation_spec = {
            "mark": annotation_mark_spec,
            "encoding": annotation_encoding_spec
        }
        return annotation_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        annotation_encoding_spec = self.make_annotation_specification(json_data)
        # 添加transform
        x_column = None 
        y_column = None
        group_column = None
        for column in json_data['data_columns']:
            if column['role'] == 'y':
                y_column = column
            if column['role'] == 'group':
                group_column = column
            if column['role'] == 'x':
                x_column = column
        transform_spec = [
            {
                "stack": y_column['name'],
                "groupby": [x_column['name']],
                "as": ["y0", "y1"],
                "sort": [{"field": group_column['name']}]
            },
            {
                "calculate": "(datum.y1 + datum.y0) / 2",
                "as": "y_mid"
            }
        ]
        specification['transform'] = transform_spec
        # 为了添加annotation，需要修改specification
        print("make_annotation_specification")
        old_encoding = specification['encoding']
        # 把old_encoding中的"y"中的"field"修改为"y0"
        old_encoding['y']['field'] = "y0"
        old_encoding['y2'] = {
            "field": "y1"
        }
        
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
    
    def adjust_legend_position(self):
        # boundingbox
        legend_group = self.legend_group
        chart = self.chart
        legend_boundingbox = legend_group.get_bounding_box()
        chart_boundingbox = chart.get_bounding_box()
        
        legend_mid_x = legend_boundingbox.minx + legend_boundingbox.width / 2
        legend_mid_y = legend_boundingbox.miny + legend_boundingbox.height / 2
        chart_mid_x = chart_boundingbox.minx + chart_boundingbox.width / 2
        chart_mid_y = chart_boundingbox.miny + chart_boundingbox.height / 2
        legend_offset_x = chart_mid_x - legend_mid_x
        old_transform = legend_group.attributes.get('transform',"")
        new_transform = f"translate({legend_offset_x}, 0) {old_transform}"
        legend_group.attributes['transform'] = new_transform
        


