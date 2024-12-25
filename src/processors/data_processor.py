from typing import Any, Dict, List
from ..interfaces.base import DataProcessor
import pandas as pd

class CSVDataProcessor(DataProcessor):
    def process(self, raw_data: str) -> List[Dict]:
        # 示例：处理CSV数据
        df = pd.read_csv(raw_data)
        return df.to_dict('records')

class JSONDataProcessor(DataProcessor):
    def process(self, raw_data: str) -> List[Dict]:
        # 示例：处理JSON数据
        import json
        with open(raw_data, 'r') as f:
            data = json.load(f)
        return data
