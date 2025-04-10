from .pie_chart import PieChart
from typing import Dict



class DonutChart(PieChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        mark_spec = super().make_mark_specification(json_data)
        # TODO adaptive
        mark_spec['innerRadius'] = 200
        return mark_spec

    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    def make_color_specification(self, json_data: Dict) -> Dict:
        return super().make_color_specification(json_data)
    
    def make_specification(self, json_data: Dict) -> Dict:
        return super().make_specification(json_data)