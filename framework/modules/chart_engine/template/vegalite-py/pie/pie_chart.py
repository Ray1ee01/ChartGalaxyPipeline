from ..template import VegaLiteTemplate
from typing import Dict

"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Pie Chart",
    "chart_name": "pie_chart_01",
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

class PieChart(VegaLiteTemplate):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_styles = json_data['variables']['mark']
        mark_spec = {
            "type": "arc",
            "innerRadius": 0
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
        variables = json_data['variables']
        constants = json_data['constants']
        data_columns = json_data['data_columns']
        y_column = None
        for column in data_columns:
            if column['role'] == 'y':
                y_column = column['name']
                break
        if y_column is None:
            raise ValueError("No numerical column found in data_columns")
        theta = {
            "field": y_column,
            "type": "quantitative"
        }
        return theta
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        variables = json_data['variables']
        color_config = variables['color']['mark_color']
        color_spec = {
            "field": color_config['field'],
            "domain": color_config['domain'],
            "range": color_config['range']
        }
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