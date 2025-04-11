from modules.chart_engine.template.vegalite_py.template import VegaLiteTemplate
from modules.chart_engine.template.vegalite_py.bar.vertical_bar_chart import VerticalBarChart
from typing import Dict

class VerticalGroupBarChart(VerticalBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        group_column = None 
        for column in json_data['data']['columns']:
            if column['role'] == 'group':
                group_column = column['name']
                break
        field_color_map = json_data['colors']['field']
        domains = []
        ranges = []
        for key, value in field_color_map.items():
            domains.append(key)
            ranges.append(value)
        if len(domains) > 0:
            color_spec = {
                "field": group_column,
                "scale": {
                    "domain": domains,
                    "range": ranges
                }
            }
        else:
            color_spec = {
                "field": group_column
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
            encoding['xOffset'] = {'field': group_column}
        else:
            raise ValueError("Group column not found in data columns")
        return specification