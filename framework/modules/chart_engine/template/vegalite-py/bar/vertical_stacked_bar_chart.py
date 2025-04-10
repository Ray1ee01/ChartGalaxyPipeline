from .vertical_bar_chart import VerticalBarChart
from typing import Dict
from modules.chart_engine.utils.element_tool.elements import *
from modules.chart_engine.utils.element_tool.variation import *
from PIL import Image as PILImage

class VerticalStackedBarChart(VerticalBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        return mark_spec
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        # return super().make_color_specification(json_data)
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
        if len(domains) > 0:
            color_spec = {
                "field": group_column,
                "scale": {
                    "domain": domains,
                    "range": ranges
                }
            }
        else:
            group_values = []
            for item in json_data['data']['data']:
                group_values.append(item[group_column])
            group_values = list(set(group_values))
            color_spec = {
                "field": group_column,
                "scale": {
                    "domain": group_values,
                }
            }
        return color_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        encoding = specification['encoding']
        data_columns = json_data['data']['columns']
        group_column = None
        for column in data_columns:
            if column['role'] == 'group':
                group_column = column['name']
                break
        if group_column is not None:
            encoding['yOffset'] = {'field': group_column}
        else:
            raise ValueError("Group column not found in data columns")
        return specification

    def apply_icon_mark_side(self, json_data: Dict):
        data_columns = json_data['data']['columns']
        images = json_data['images']
        field_image_map = images['field']
        group_column = None
        for data_column in data_columns:
            if data_column['name'] == 'group':
                group_column = data_column
        for mark in self.marks:
            print("mark: ", mark.data_attributes)
            if mark.data_attributes.get(group_column['name'], None) is not None:
                print("get")
                # base64_image = Image._getImageAsBase64(field_image_map[mark.data_attributes[group_column['name']]])
                # pictogram = UseImage(base64_image)
                # pictogram_mark = PictogramMark(mark, pictogram)
                # new_mark = pictogram_mark.process(pictogram_mark_config)
                # mark.children = new_mark.children

    def apply_icon_mark_overlay(self, json_data: Dict):
        print("apply_icon_mark_overlay")
        data_columns = json_data['data']['columns']
        images = json_data['variables']['images']
        field_image_map = images['field']
        group_column = None
        print("data_columns: ", data_columns)
        for data_column in data_columns:
            if data_column['role'] == 'group':
                group_column = data_column
        for mark in self.marks:
            print("mark: ", mark.data_attributes)
            print("group_column: ", group_column)
            if mark.data_attributes.get(group_column['name'], None) is not None:
                pictogram_mark_config = {
                    "type": "overlay",
                }
                base64_image = Image._getImageAsBase64(field_image_map[mark.data_attributes[group_column['name']]])
                pictogram = UseImage(base64_image)
                pictogram_mark = PictogramMark(mark, pictogram)
                new_mark = pictogram_mark.process(pictogram_mark_config)
                mark.children = new_mark.children


