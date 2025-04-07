from .scatter_plot import ScatterPlot
from typing import Dict


"""
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Bubble Chart",
    "chart_name": "bubble_chart_01",
    "required_fields": ["x", "y", "size"],
    "required_fields_type": [["temporal","numerical"], ["temporal","numerical"], ["numerical"]],
    "supported_effects": [],
    "required_data_points": [5, 100],
    "required_image": [],
    "width": [500, 1000],
    "height": [500, 800],
    "x_range": [2, 20]
}
REQUIREMENTS_END
"""

class BubbleChart(ScatterPlot):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    
    def make_size_specification(self, json_data: Dict) -> Dict:
        data_columns = json_data['data']['columns']
        size_column = None
        for column in data_columns:
            if column['name'] == 'size':
                size_column = column
                break
        if size_column is None:
            raise ValueError("Size column not found")
        size_spec = {
            "field": size_column['name'],
            "type": "quantitative"
        }
        return size_spec
        
    def make_color_specification(self, json_data: Dict) -> Dict:
        return super().make_color_specification(json_data)
    
    def make_specification(self, json_data: Dict) -> Dict:
        specification = super().make_specification(json_data)
        encoding = specification['encoding']
        encoding['size'] = self.make_size_specification(json_data)
        specification['encoding'] = encoding
        return specification