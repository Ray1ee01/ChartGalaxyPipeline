from modules.chart_engine.template.vegalite_py.template import VegaLiteTemplate
from typing import Dict


class AreaChart(VegaLiteTemplate):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_styles = json_data['variables']
        mark_spec = {
            "type": "area",
        }
        return mark_spec
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        variables = json_data['variables']
        # axes_config = json_data['variation']['axes']
        axes_config = {"x_axis": "yes", "y_axis": "yes"}
        label_typography = json_data['typography']['label']
        label_color = json_data['colors']['text_color']

        data_columns = json_data['data']['columns']
        x_axis_config = None
        y_axis_config = None
        for data_column in data_columns:
            if data_column['role'] == 'x':
                x_axis_config = data_column
            if data_column['role'] == 'y':
                y_axis_config = data_column
        if axes_config['x_axis'] == 'no':
            x_axis_config['has_tick'] = False
            x_axis_config['has_domain'] = False
            x_axis_config['has_label'] = False
        else:
            x_axis_config['has_tick'] = True
            x_axis_config['has_domain'] = True
            x_axis_config['has_label'] = True
            
        if axes_config['y_axis'] == 'no':
            y_axis_config['has_tick'] = False
            y_axis_config['has_domain'] = False
            y_axis_config['has_label'] = False
        else:
            y_axis_config['has_tick'] = True
            y_axis_config['has_domain'] = True
            y_axis_config['has_label'] = True
            
        x_encoding_spec = {
            "field": x_axis_config['name'],
            "type": "ordinal",
            "sort": None,
            # "scale": {
            #     "padding": 0
            # }
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
        if x_axis_config['has_label'] is True:
            x_axis_spec['labelColor'] = label_color
            x_axis_spec['labelFont'] = label_typography['font_family']
            x_axis_spec['labelFontSize'] = label_typography['font_size'].replace('px', '')
            x_axis_spec['labelFontWeight'] = label_typography['font_weight']
            x_axis_spec['labelAngle'] = 0
        else:
            x_axis_spec['labels'] = False
        # letter_spacing 不支持
        print("Vega-lite does not support letter_spacing")
        # 结束axis样式配置
        x_encoding_spec['axis'] = x_axis_spec
            
        y_encoding_spec = {
            "field": y_axis_config['name'],
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
        if y_axis_config['has_label'] is True:
            y_axis_spec['labelColor'] = label_color
            y_axis_spec['labelFont'] = label_typography['font_family']  
            y_axis_spec['labelFontSize'] = label_typography['font_size'].replace('px', '')
            y_axis_spec['labelFontWeight'] = label_typography['font_weight']
            y_axis_spec['labelAngle'] = 0
        else:
            y_axis_spec['labels'] = False
            # y_axis_spec['labelColor'] = None
            # y_axis_spec['labelFont'] = None
            # y_axis_spec['labelFontSize'] = None
            # y_axis_spec['labelFontWeight'] = None
            # y_axis_spec['labelAngle'] = None
        # 结束axis样式配置
        y_encoding_spec['axis'] = y_axis_spec
        
        return x_encoding_spec, y_encoding_spec
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        variables = json_data['variables']
        # color_config = variables['color']['mark_color']
        color = json_data['colors']['available_colors'][0]
        color_spec = color
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