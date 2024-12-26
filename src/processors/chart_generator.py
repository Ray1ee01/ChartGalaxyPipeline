from typing import Dict, List
from ..interfaces.base import ChartGenerator
from ..utils.node_bridge import NodeBridge
import os
from typing import Tuple
class VegaLiteGenerator(ChartGenerator):
    def __init__(self):
        self.script_path = os.path.join(
            os.path.dirname(__file__),
            'chart_generator_modules/vega-lite/vega_spec.js'
        )

    def generate(self, data: List[Dict]) -> Tuple[str, Dict, Dict]:
        result = NodeBridge.execute_node_script(self.script_path, data)
        return result, data.get('options', {})