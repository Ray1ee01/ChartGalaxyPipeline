
from .vertical_group_bar_chart_0 import VerticalGroupBarChart0
from typing import Dict
from modules.chart_engine.utils.element_tool.elements import BoundingBox
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_1",
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

class VerticalGroupBarChart1(VerticalGroupBarChart0):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = super().make_color_specification(json_data)
        color_spec['legend'] = {
            'orient': 'top',
            'direction': 'horizontal',
            'labelFontSize': 16,
            'symbolSize': 200,
            'title': None
        }
        return color_spec

    def make_annotation_specification(self, json_data: Dict) -> Dict:
        text_color = json_data['colors']['text_color']
        annotation_typography = json_data['typography']['annotation']
        annotation_mark_spec = {
            "type": "text",
            "align": "center",
            "baseline": "middle",
            "font": annotation_typography['font_family'],
            "fontSize": 16,
            "fontWeight": annotation_typography['font_weight'],
            "color": "#ffffff",
            "angle": -90,
            "dy": 10,
            "dx": -10,
            "baseline": "middle",
            "align": "right"
        }
        data_columns = json_data['data']['columns']
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
                "type": "nominal",
                "sort": None,
            },
            "y": {
                "field": y_column['name'],
                "type": "quantitative",
            },
            "xOffset": {
                "field": group_column['name'],
                "type": "nominal",
                "sort": None,
            }
        }
        annotation_spec = {
            "mark": annotation_mark_spec,
            "encoding": annotation_encoding_spec
        }
        return annotation_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        annotation_encoding_spec = self.make_annotation_specification(json_data)
        # 为了添加annotation，需要修改specification
        print("make_annotation_specification")
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