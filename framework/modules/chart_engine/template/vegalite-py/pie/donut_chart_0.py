from .donut_chart import DonutChart
from typing import Dict
from modules.chart_engine.utils.color_tool.base import interpolate_color2
from modules.chart_engine.utils.element_tool.variation import ImageChart
from modules.chart_engine.utils.element_tool.elements import *


"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Donut Chart",
    "chart_name": "donut_chart_0",
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

class DonutChart0(DonutChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        return mark_spec

    def make_order_specification(self, json_data: Dict) -> Dict:
        x_column = None
        data_columns = json_data['data']['columns']
        for data_column in data_columns:
            if data_column['role'] == 'x':
                x_column = data_column['name']
                break
        x_values = []
        for item in json_data['data']['data']:
            x_values.append(item[x_column])
        x_values = list(dict.fromkeys(x_values))
        
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    def make_color_specification(self, json_data: Dict) -> Dict:
        # 将颜色转换为RGB值            
        x_column = None
        data_columns = json_data['data']['columns']
        for data_column in data_columns:
            if data_column['role'] == 'x':
                x_column = data_column['name']
                break
        x_values = []
        for item in json_data['data']['data']:
            x_values.append(item[x_column])
        x_values = list(dict.fromkeys(x_values))

        n_colors = len(x_values)
        color = json_data['colors']['other']['primary']
        # 取color和#000000的中间值
        # color_list = interpolate_color2(color, "#c6eae9", n_colors)
        color_list = ['#15302d','#2a4742','#32685f','#41877d','#5abcaf','#99ddd7','#c6eae9','#8cafad','#c1d3d4']
        if len(color_list) < n_colors:
            color_list = color_list * (n_colors // len(color_list)) + color_list[:n_colors % len(color_list)]
        else:
            color_list = color_list[:n_colors]
        color_spec = {
            "field": x_column,
            "type": "nominal",
            "scale": {
                "domain": x_values,
                "range": color_list
            },
            "legend": None
        }
        return color_spec
    
    def adjust_legend_position(self):
        pass
    
    def make_specification(self, json_data: Dict) -> Dict:
        spec =  super().make_specification(json_data)
        y_column = None
        x_column = None
        y_values = []
        y_max = -1000000
        y_min = 1000000
        for column in json_data['data']['columns']:
            if column['role'] == 'y':
                y_column = column['name']
            if column['role'] == 'x':
                x_column = column['name']
        for item in json_data['data']['data']:
            y_value = item[y_column]
            y_values.append(y_value)
        y_median = sorted(y_values)[len(y_values) // 2]
        transform = [
            {
                "calculate": f"datum['{x_column}'] + ' ' + datum['{y_column}']",
                "as": "full_name"
            }
        ]
        text_spec = {
            "mark": {"type": "text", "radius": 250, "fontSize": 28},
            "encoding": {
                "text": {"field": y_column, "type": "quantitative"},
                "theta": {"field": y_column, "type": "quantitative", "sort": None, "stack": True},
                "order": {"field": y_column, "sort": "descending"},
                "color": {
                    "condition": {
                        "test": f"datum['{y_column}'] > {y_median}",
                        "value": "#ffffff"
                    },
                    "value": "#000000"
                }
            }
        }
        text2_spec = {
            "mark": {"type": "text", "radius": 370, "fontSize": 25},
            "encoding": {
                "text": {"field": x_column, "type": "nominal"},
                "theta": {"field": y_column, "type": "quantitative", "sort": None, "stack": True},
                "order": {"field": y_column, "sort": "descending"}
            }
        }
        
        spec['encoding']['order'] = {
            "field": y_column,
            "sort": "descending"
        }
        spec['transform'] = transform
        old_encoding = spec['encoding']
        old_marks = spec['mark']
        spec['layer'] =[
            {
                "mark": old_marks,
                "encoding": old_encoding
            },
            text_spec,
            text2_spec
        ]
        del spec['encoding']
        del spec['mark']
        return spec
    
    def image_chart_center(self, json_data: Dict):
        images = json_data['images']
        primary_image = images['other']['primary']
        base64_image = Image._getImageAsBase64(primary_image)
        pictogram = UseImage(base64_image)
        image_chart_config = {
            "type":"side",
            "direction":"center"
        }
        image_chart = ImageChart(self.chart, pictogram)
        [chart, image] = image_chart.process(image_chart_config)
        print("chart: ", chart)
        print("image: ", image)
        print("self.elements_tree: ", self.elements_tree)
        self.elements_tree = GroupElement()
        self.elements_tree.children = [chart, image]
        
        
    def apply_variation(self, json_data: Dict):
        super().apply_variation(json_data)
        self.image_chart_center(json_data)