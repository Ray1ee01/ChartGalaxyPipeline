from .horizontal_bar_chart_1 import HorizontalBarChart1
from typing import Dict
from utils.element_tool.elements import *
from utils.element_tool.variation import AxisLabelMark
from utils.element_tool.data_binder import get_content_from_axis_label, bind_data_to_element
from components.color_encoding.color_encoding import gridient_primary_secondary_y
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_3",
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

class HorizontalBarChart3(HorizontalBarChart1):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)
    
    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        return x_encoding_spec, y_encoding_spec

    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = gridient_primary_secondary_y(json_data)
        return color_spec
    
    def make_annotation_specification(self, json_data: Dict) -> Dict:
        return super().make_annotation_specification(json_data)
    
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
    
    def make_number_specification(self, json_data: Dict) -> Dict:
        y_column = None
        x_column = None
        for data_column in json_data['data_columns']:
            if data_column['role'] == 'y':
                y_column = data_column['name']
            if data_column['role'] == 'x':
                x_column = data_column['name']
        number_spec = {
            "mark": {
                "type": "text",
                "align": "right",
                "baseline": "middle",
                # hardcode warning
                "dx": -175,
                "dy": 8,
                "font": "Arial",
                "fontSize": "16",
                "fontWeight": 400,
                "color": "#aaaaaa"
            },
            "encoding": {
                "text": {
                    "field": "Rank",
                    "type": "ordinal"
                },
                "y": {
                    "field": x_column,
                    "type": "nominal",
                    "sort": None
                },
                "x": {
                    "value": 0
                }
            }
        }
        return number_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        data = specification['data']
        for idx, item in enumerate(data['values']):
            item['Rank'] = idx + 1
        number_spec = self.make_number_specification(json_data)
        specification['layer'].append(number_spec)
        return specification
    
    def apply_axis_label_side(self, json_data: Dict):
        print("apply_icon_mark_overlay")
        data_columns = json_data['data_columns']
        x_column = None
        for data_column in data_columns:
            if data_column['role'] == 'x':
                x_column = data_column 
        for axis_label in self.axis_labels:
            if axis_label.axis_type == "y":
                data_dict = {
                    x_column['name']: get_content_from_axis_label(axis_label),
                }
                bind_data_to_element(axis_label, data_dict)
        images = json_data['images']
        field_image_map = images['field']
        x_column = None
        for data_column in data_columns:
            if data_column['role'] == 'x':
                x_column = data_column
        print("self.axis_labels: ", self.axis_labels)
        for axis_label in self.axis_labels:
            print("axis_label: ", axis_label.data_attributes)
            if axis_label.data_attributes.get(x_column['name'], None) is not None:
                axis_label_config = {
                    "type": "side",
                    "direction": "right",
                    "side": "outside",
                    "padding": 5,
                    "size_ratio": 1.0
                }
                base64_image = Image._getImageAsBase64(field_image_map[axis_label.data_attributes[x_column['name']]])
                pictogram = UseImage(base64_image)
                pictogram_mark = AxisLabelMark(axis_label, pictogram)
                new_mark = pictogram_mark.process(axis_label_config)
                axis_label.children = new_mark.children