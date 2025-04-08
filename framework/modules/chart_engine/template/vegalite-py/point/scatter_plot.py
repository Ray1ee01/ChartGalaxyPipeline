from ..template import VegaLiteTemplate
from typing import Dict


"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Scatter Plot",
    "chart_name": "scatter_plot_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal","numerical"], ["temporal","numerical"]],
    "supported_effects": [],
    "required_data_points": [5, 100],
    "required_image": [],
    "width": [500, 1000],
    "height": [500, 800],
    "x_range": [2, 20]
}
REQUIREMENTS_END
"""

class ScatterPlot(VegaLiteTemplate):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_styles = json_data['variables']['mark']
        mark_spec = {
            "type": "circle",
            "size": 100
        }
        if mark_styles['has_gradient']:
            print("Vega-lite does not support gradient")
        if mark_styles['has_rounded_corners']:
            mark_spec['cornerRadius'] = 10
        if mark_styles['has_shadow']:
            print("Vega-lite does not support shadow")
        if mark_styles['has_spacing']:
            print("scatter plot does not support spacing")
        if mark_styles['has_stroke']:
            stroke_color = json_data['variables']['color'].get('stroke_color', "#000000")
            stroke_width = json_data['variables']['color'].get('stroke_width', 2)
            mark_spec['stroke'] = stroke_color
            mark_spec['strokeWidth'] = stroke_width
        return mark_spec

    def make_axis_specification(self, json_data: Dict) -> Dict:
        variables = json_data['variables']
        constants = json_data['constants']
        label_color = variables['color'].get('label_color', "#000000")
        label_typography = json_data['typography']['label']
        if constants['has_x_axis']:
            x_axis_config = variables['x_axis']
            x_encoding_spec = {
                "field": x_axis_config['field'],
                # 暂时用quantitative来处理，等数据type完善之后可以搞
                "type": "quantitative"
            }
            x_axis_spec = {}
            x_axis_spec['domain'] = True
            if x_axis_config['has_domain'] is True:
                x_axis_spec['domainOpacity'] = 1
            else:
                x_axis_spec['domainOpacity'] = 0

            x_axis_spec['ticks'] = True
            if x_axis_config['has_tick'] is True:
                x_axis_spec['tickOpacity'] = 1
            else:
                x_axis_spec['tickOpacity'] = 0
            # 默认没有title
            x_axis_spec['title'] = None
            # 默认没有grid
            x_axis_spec['grid'] = False
            # 默认没有label
            x_axis_spec['labelColor'] = label_color
            x_axis_spec['labelFont'] = label_typography['font_family']
            x_axis_spec['labelFontSize'] = label_typography['font_size'].replace('px', '')
            x_axis_spec['labelFontWeight'] = label_typography['font_weight']
            x_axis_spec['labelLineHeight'] = label_typography['line_height']
            x_axis_spec['labelAngle'] = 0
            # letter_spacing 不支持
            print("Vega-lite does not support letter_spacing")
            # 结束axis样式配置
            x_encoding_spec['axis'] = x_axis_spec
            x_encoding_spec['scale'] = {
                "zero": False
            }
        if constants['has_y_axis']:
            y_axis_config = variables['y_axis'] 
            y_encoding_spec = {
                "field": y_axis_config['field'],
                "type": "quantitative"
            }
            y_axis_spec = {}
            y_axis_spec['domain'] = True
            if y_axis_config['has_domain'] is True:
                y_axis_spec['domainOpacity'] = 1
            else:
                y_axis_spec['domainOpacity'] = 0
                
            y_axis_spec['ticks'] = True
            if y_axis_config['has_tick'] is True:
                y_axis_spec['tickOpacity'] = 1
            else:
                y_axis_spec['tickOpacity'] = 0
            y_axis_spec['title'] = None
            # 默认没有grid
            y_axis_spec['grid'] = False
            y_axis_spec['labelColor'] = label_color
            y_axis_spec['labelFont'] = label_typography['font_family']  
            y_axis_spec['labelFontSize'] = label_typography['font_size'].replace('px', '')
            y_axis_spec['labelFontWeight'] = label_typography['font_weight']
            y_axis_spec['labelLineHeight'] = label_typography['line_height']
            y_axis_spec['labelAngle'] = 0
            # letter_spacing 不支持
            print("Vega-lite does not support letter_spacing")
            # 结束axis样式配置
            y_encoding_spec['axis'] = y_axis_spec
            y_encoding_spec['scale'] = {
                "zero": False
            }
        return x_encoding_spec, y_encoding_spec
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
        x_encoding_specification, y_encoding_specification = self.make_axis_specification(json_data)
        color_specification = self.make_color_specification(json_data)
        specification['mark'] = mark_specification
        encoding = {
            "x": x_encoding_specification,
            "y": y_encoding_specification,
            "color": color_specification
        }
        specification['encoding'] = encoding
        return specification