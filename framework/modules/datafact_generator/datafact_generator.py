import argparse
import os
import json
from typing import Union, Dict

from .util import DataFact
from .value_fact import ValueFact, ValueFactGenerator
from .trend_fact import TrendFact, TrendFactGenerator
from .proportion_fact import ProportionFact, ProportionFactGenerator
from .difference_fact import DifferenceFact, DifferenceFactGenerator
from .correlation_fact import CorrelationFact, CorrelationFactGenerator

class DatafactGenerator:
    def __init__(self, data: dict, topk: int=5):
        self.data = data
        self.topk = topk

        self.value_facts: list[ValueFact] = []
        self.trend_facts: list[TrendFact] = []
        self.proportion_facts: list[ProportionFact] = []
        self.difference_facts: list[DifferenceFact] = []
        self.correlation_facts: list[CorrelationFact] = []

        self.datafacts: list[DataFact] = []
    
    def generate_datafacts(self, topk=5):
        """ 生成 datafacts """
        value_fact_generator = ValueFactGenerator(self.data)
        self.value_facts = value_fact_generator.extract_value_facts()

        trend_fact_generator = TrendFactGenerator(self.data)
        self.trend_facts = trend_fact_generator.extract_trend_facts()

        proportion_fact_generator = ProportionFactGenerator(self.data, self.value_facts)
        self.proportion_facts = proportion_fact_generator.extract_proportion_facts()

        difference_fact_generator = DifferenceFactGenerator(self.data, self.value_facts)
        self.difference_facts = difference_fact_generator.extract_difference_facts()

        correlation_fact_generator = CorrelationFactGenerator(self.data)
        self.correlation_facts = correlation_fact_generator.extract_correlation_facts()

        self.datafacts = self.value_facts + self.trend_facts + self.proportion_facts + \
            self.difference_facts + self.correlation_facts

        self.datafacts = sorted(self.datafacts, key=lambda x: x.score, reverse=True)[:min(topk, len(self.datafacts))]

        return self.datafacts

def process(
        input_path: str=None,
        output_path: str=None,
        input_data: dict=None,
        topk: int=5
        ) -> Union[bool, Dict]:
    if input_data is not None: # 代码调用
        data = input_data
        assert(input_path is None) # 二选一
    else: # 命令行调用
        assert(input_path and os.path.exists(input_path))
        try:
            with open(input_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Failed to read input file: {e}")
            return False
        
    datafact_generator = DatafactGenerator(data)
    datafacts = datafact_generator.generate_datafacts(topk)

    data["datafacts"] = [datafact.get_json() for datafact in datafacts if datafact.score > 0]

    # 写入文件（命令行调用）
    if output_path is not None:
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Failed to write output file: {e}")
            return False
        return True

    return True

def main():
    parser = argparse.ArgumentParser(description="Datafact Generator")
    parser.add_argument("--input", type=str, required=True, help="Input JSON file path")
    parser.add_argument("--output", type=str, required=True, help="Output JSON file path")
    parser.add_argument("--topk", type=int, default=5, help="Max number of facts to include")
    args = parser.parse_args()

    success = process(input_path=args.input, output_path=args.output, topk=args.topk)

    if success:
        print("Processing json successed.")
    else:
        print("Processing json successed.")

if __name__ == "__main__":
    main()