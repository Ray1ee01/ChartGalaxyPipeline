from modules.chart_engine.template.vegalite_py.bar.horizontal_bar_chart import HorizontalBarChart
from typing import Dict


class HorizontalGroupBarChart(HorizontalBarChart):
    def __init__(self, json_data: Dict):
        super().__init__(json_data)

    def make_mark_specification(self, json_data: Dict) -> Dict:
        return super().make_mark_specification(json_data)
    
    def make_axis_specification(self, json_data: Dict) -> Dict:
        return super().make_axis_specification(json_data)
    
    def make_color_specification(self, json_data: Dict) -> Dict:
        return super().make_color_specification(json_data)

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
            encoding['yOffset'] = {'field': group_column}
        else:
            raise ValueError("Group column not found in data columns")
        return specification