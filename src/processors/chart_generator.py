from typing import Dict, List
from ..interfaces.base import ChartGenerator
from ..utils.node_bridge import NodeBridge
import os

class VegaLiteGenerator(ChartGenerator):
    def __init__(self):
        self.script_path = os.path.join(
            os.path.dirname(__file__),
            'chart_generator_modules/vega-lite/vega_spec.js'
        )

    def generate(self, data: List[Dict]) -> str:
        return NodeBridge.execute_node_script(self.script_path, data)