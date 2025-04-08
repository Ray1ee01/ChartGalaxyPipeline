
from .vertical_group_bar_chart_3 import VerticalGroupBarChart3
from typing import Dict
from utils.element_tool.elements import *
from utils.element_tool.data_binder import get_content_from_axis_label, bind_data_to_element
from utils.element_tool.variation import AxisLabelMark
from utils.element_tool.image_processor import ImageProcessor
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_4",
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

class VerticalGroupBarChart4(VerticalGroupBarChart3):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        x_encoding_spec['axis']['labelOffset'] = 3
        return x_encoding_spec, y_encoding_spec
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = super().make_color_specification(json_data)
        color_spec['legend']['columns'] = 1
        color_spec['legend']['labelLimit'] = 1000
        return color_spec

    def make_annotation_specification(self, json_data: Dict) -> Dict:
        annotation_encoding_spec = super().make_annotation_specification(json_data)
        annotation_encoding_spec['mark']['dx'] = 3
        return annotation_encoding_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        return specification
    
    def adjust_legend_position(self):
        super().adjust_legend_position()
        
    def apply_axis_label_side(self, json_data: Dict):
        data_columns = json_data['data']['columns']
        x_column = None
        for data_column in data_columns:
            if data_column['role'] == 'x':
                x_column = data_column 
        for axis_label in self.axis_labels:
            if axis_label.axis_type == "x":
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
        for axis_label in self.axis_labels:
            if axis_label.data_attributes.get(x_column['name'], None) is not None:
                axis_label_config = {
                    "type": "side",
                    "direction": "top",
                    "side": "outside",
                    "padding": 5,
                    "size_ratio": 1.0,
                    "adjust": False,
                    "add_circle": True
                }
                base64_image = Image._getImageAsBase64(field_image_map[axis_label.data_attributes[x_column['name']]])
                base64 = base64_image.split('base64,')[1]
                base64 = ImageProcessor().crop_by_circle(base64)
                base64_image = f"data:image/png;base64,{base64}"
                pictogram = UseImage(base64_image)
                pictogram._bounding_box = pictogram.get_bounding_box()
                pictogram_mark = AxisLabelMark(axis_label, pictogram)
                new_mark = pictogram_mark.process(axis_label_config)
                axis_label.children = new_mark.children