from .horizontal_bar_chart_1 import HorizontalBarChart1
from typing import Dict
from modules.chart_engine.template.vegalite-py.components.color_encoding.color_encoding import x_gradient_primary_secondary
from modules.chart_engine.utils.element_tool.elements import *
from modules.chart_engine.utils.element_tool.variation import AxisLabelMark
from modules.chart_engine.utils.element_tool.data_binder import get_content_from_axis_label, bind_data_to_element
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Horizontal Bar Chart",
    "chart_name": "horizontal_bar_chart_4",
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

class HorizontalBarChart4(HorizontalBarChart1):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)
    
    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        return x_encoding_spec, y_encoding_spec

    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = x_gradient_primary_secondary(json_data)
        return color_spec
    
    def make_annotation_specification(self, json_data: Dict) -> Dict:
        annotation_spec = super().make_annotation_specification(json_data)
        annotation_spec['mark']['color'] = "#ffffff"
        annotation_spec['mark']['align'] = "right"
        annotation_spec['mark']['dx'] = -5
        return annotation_spec
    
    def adjust_legend_position(self):
        pass
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        return specification
    
    def apply_axis_label_side(self, json_data: Dict):
        print("apply_icon_mark_overlay")
        data_columns = json_data['data']['columns']
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