from .vertical_stacked_bar_chart_1 import VerticalStackedBarChart1
from typing import Dict
from utils.element_tool.elements import *
from utils.element_tool.variation import *
from PIL import Image as PILImage
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Vertical Stacked Bar Chart",
    "chart_name": "vertical_stacked_bar_chart_3",
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

class VerticalStackedBarChart3(VerticalStackedBarChart1):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        return mark_spec
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        x_encoding_spec['axis']['domainOpacity'] = 1
        x_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['grid'] = True
        y_encoding_spec['axis']['gridDash'] = [1,2]
        y_encoding_spec['axis']['domainOpacity'] = 0
        y_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['labels'] = True
        return x_encoding_spec, y_encoding_spec
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = super().make_color_specification(json_data)
        color_spec['legend']['title'] = None
        return color_spec
    
    def make_annotation_specification(self, json_data: Dict) -> Dict:
        text_color = json_data['colors']['text_color']
        annotation_typography = json_data['typography']['annotation']
        annotation_mark_spec = {
            "type": "text",
            "align": "center",
            "baseline": "top",
            "dy": 10,
            "dx": 0,
            "font": annotation_typography['font_family'],
            "fontSize": annotation_typography['font_size'].replace('px', ''),
            "fontWeight": annotation_typography['font_weight'],
            "color": "#ffffff"
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
            },
            "x": {
                "field": x_column['name'],
                "type": "ordinal",
                "sort": None
            },
            "y": {
                "field": "y1",
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
        return specification
    
    def adjust_legend_position(self):
        def merge_boundingboxes(boundingboxes):
            minx = min([boundingbox.minx for boundingbox in boundingboxes])
            miny = min([boundingbox.miny for boundingbox in boundingboxes])
            maxx = max([boundingbox.maxx for boundingbox in boundingboxes])
            maxy = max([boundingbox.maxy for boundingbox in boundingboxes])
            width = maxx - minx
            height = maxy - miny
            return BoundingBox(width, height, minx, maxx, miny, maxy)
        
        # boundingbox
        legend_group = self.legend_group
        marks = self.marks
        axes = self.axes
        marks_boundingboxes = [mark.get_bounding_box() for mark in marks]
        axes_boundingboxes = [axis.get_bounding_box() for axis in axes]
        # merge boundingboxes
        boundingboxes = marks_boundingboxes + axes_boundingboxes
        boundingbox_merged = merge_boundingboxes(boundingboxes)
        legend_boundingbox = legend_group.get_bounding_box()
        chart_boundingbox = boundingbox_merged
        
        legend_mid_x = legend_boundingbox.minx + legend_boundingbox.width / 2
        legend_mid_y = legend_boundingbox.miny + legend_boundingbox.height / 2
        boundingbox_merged_mid_x = boundingbox_merged.minx + boundingbox_merged.width / 2
        boundingbox_merged_mid_y = boundingbox_merged.miny + boundingbox_merged.height / 2
        legend_offset_x = boundingbox_merged_mid_x - legend_mid_x
        old_transform = legend_group.attributes.get('transform',"")
        new_transform = f"translate({legend_offset_x}, 0) {old_transform}"
        legend_group.attributes['transform'] = new_transform


