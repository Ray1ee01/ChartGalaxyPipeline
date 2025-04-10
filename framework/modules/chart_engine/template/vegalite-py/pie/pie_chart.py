from ..template import VegaLiteTemplate
from typing import Dict


class PieChart(VegaLiteTemplate):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_styles = json_data["variables"]
        mark_spec = {
            "type": "arc",
            "innerRadius": 0,
            "outerRadius": 300
        }
        if mark_styles['has_gradient']:
            print("Vega-lite does not support gradient")
        if mark_styles['has_rounded_corners']:
            mark_spec['cornerRadius'] = 10
        if mark_styles['has_shadow']:
            print("Vega-lite does not support shadow")
        if mark_styles['has_spacing']:
            mark_spec['padAngle'] = 0.05
        return mark_spec

    def make_axis_specification(self, json_data: Dict) -> Dict:
        data_columns = json_data['data']['columns']
        y_column = None
        for column in data_columns:
            if column['role'] == 'y':
                y_column = column['name']
                break
        if y_column is None:
            raise ValueError("No numerical column found in data_columns")
        theta = {
            "field": y_column,
            "type": "quantitative",
            "sort": None,
            "stack": True
        }
        return theta
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        # color_config = variables['color']['mark_color']
        color = json_data['colors']['available_colors'][0]
        color_spec = color
        return color_spec
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        mark_specification = self.make_mark_specification(json_data)
        theta = self.make_axis_specification(json_data)
        color_specification = self.make_color_specification(json_data)
        specification['mark'] = mark_specification
        encoding = {
            "theta": theta,
            "color": color_specification
        }
        specification['encoding'] = encoding
        return specification