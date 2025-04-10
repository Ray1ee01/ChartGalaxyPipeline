from modules.chart_engine.template.vegalite_py.bar.horizontal_bar_chart import HorizontalBarChart
from typing import Dict
from modules.chart_engine.template.vegalite_py.utils.element_tool.elements import *
from modules.chart_engine.template.vegalite_py.utils.element_tool.variation import AxisLabelMark
from modules.chart_engine.template.vegalite_py.utils.element_tool.data_binder import get_content_from_axis_label, bind_data_to_element
"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_chart_0",
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

class HorizontalStackedBarChart0(HorizontalBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        return mark_spec
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        x_encoding_spec['axis']['domainOpacity'] = 0
        x_encoding_spec['axis']['tickOpacity'] = 0
        x_encoding_spec['axis']['labels'] = True
        y_encoding_spec['axis']['labels'] = True
        y_encoding_spec['axis']['tickOpacity'] = 0
        y_encoding_spec['axis']['domainOpacity'] = 1
        x_encoding_spec['axis']['grid'] = True
        x_encoding_spec['stack'] = "normalize"
        return x_encoding_spec, y_encoding_spec
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        group_column = None
        data_columns = json_data['data']['columns']
        for data_column in data_columns:
            if data_column['role'] == 'group':
                group_column = data_column['name']
                break
        ranges = []
        domains = []
        for value, color in json_data['colors']['field'].items():
            ranges.append(color)
            domains.append(value)
        color_spec = {
            "field": group_column,
            "scale": {
                "domain": domains,
                "range": ranges
            }
        }
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
            "font": annotation_typography['font_family'],
            "fontSize": annotation_typography['font_size'].replace('px', ''),
            "fontWeight": annotation_typography['font_weight'],
            "color": "#ffffff"
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
            "x": {
                "field": y_column['name'],
                "type": "quantitative",
                "sort": None,
                "stack": "normalize",
                "bandPosition": 0.5
            },
            "y": {
                "field": x_column['name'],
                "type": "nominal",
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