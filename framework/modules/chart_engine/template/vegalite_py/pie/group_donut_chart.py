from modules.chart_engine.template.vegalite_py.pie.donut_chart import DonutChart
from typing import Dict


class GroupDonutChart(DonutChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)
        
    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        return super().make_color_specification(json_data)
    
    def make_specification(self, json_data: Dict) -> Dict:
        return super().make_specification(json_data)
    