from .vertical_bar_chart import VerticalBarChart
from typing import Dict


class HorizontalBarChart(VerticalBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)
    
    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        mark_styles = json_data['variables']
        if mark_styles['has_spacing']:
            mark_spec['height'] = {"band": 0.6}
        else:
            mark_spec['height'] = {"band": 0.8}
        return mark_spec

    def make_axis_specification(self, json_data: Dict) -> Dict:
        x_encoding_spec, y_encoding_spec = super().make_axis_specification(json_data)
        return y_encoding_spec, x_encoding_spec

    def make_color_specification(self, json_data: Dict) -> Dict:
        color_spec = super().make_color_specification(json_data)
        return color_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        return specification