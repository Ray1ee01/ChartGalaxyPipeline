from typing import Dict, List

class VegaLiteTemplate:
    def __init__(self):
        pass

    def make_specification(self, json_data: Dict) -> Dict:
        specification = {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "config": {
                "view": {"stroke": None}
            },
            "data": {
                "values": json_data['data']
            }
        }
        variables = json_data['variables']
        if variables.get('height',0) != 0:
            specification['height'] = variables['height']
        if variables.get('width',0) != 0:
            specification['width'] = variables['width']
        return specification

