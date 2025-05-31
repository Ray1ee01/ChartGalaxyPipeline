import argparse
import os
import json
from logging import getLogger
logger = getLogger(__name__)
from typing import Union, Dict

from modules.datafact_generator.util import DataFact
from modules.datafact_generator.value_fact import ValueFact, ValueFactGenerator
from modules.datafact_generator.trend_fact import TrendFact, TrendFactGenerator
from modules.datafact_generator.proportion_fact import ProportionFact, ProportionFactGenerator
from modules.datafact_generator.difference_fact import DifferenceFact, DifferenceFactGenerator
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
        try:
            value_fact_generator = ValueFactGenerator(self.data)
            self.value_facts = value_fact_generator.extract_value_facts()
        except Exception as e:
            logger.error(f"生成value facts失败: {str(e)}")
            self.value_facts = []

        try:
            trend_fact_generator = TrendFactGenerator(self.data)
            self.trend_facts = trend_fact_generator.extract_trend_facts()
        except Exception as e:
            logger.error(f"生成trend facts失败: {str(e)}")
            self.trend_facts = []

        try:
            proportion_fact_generator = ProportionFactGenerator(self.data, self.value_facts)
            self.proportion_facts = proportion_fact_generator.extract_proportion_facts()
        except Exception as e:
            logger.error(f"生成proportion facts失败: {str(e)}")
            self.proportion_facts = []

        try:
            difference_fact_generator = DifferenceFactGenerator(self.data, self.value_facts)
            self.difference_facts = difference_fact_generator.extract_difference_facts()
        except Exception as e:
            logger.error(f"生成difference facts失败: {str(e)}")
            self.difference_facts = []

        try:
            correlation_fact_generator = CorrelationFactGenerator(self.data)
            self.correlation_facts = correlation_fact_generator.extract_correlation_facts()
        except Exception as e:
            logger.error(f"生成correlation facts失败: {str(e)}")
            self.correlation_facts = []

        self.datafacts = self.value_facts + self.trend_facts + self.proportion_facts + \
            self.difference_facts + self.correlation_facts

        self.datafacts = sorted(self.datafacts, key=lambda x: x.score, reverse=True)[:min(topk, len(self.datafacts))]

        return self.datafacts

def process(input: str, output: str) -> None:
    """
    Pipeline入口函数，处理单个文件的数据洞察生成
    
    Args:
        input (str): 输入JSON文件路径
        output (str): 输出JSON文件路径
    """
    try:
        # 读取输入文件
        with open(input, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # 预处理数据，确保类型正确
        processed_data = preprocess_data(data)
        
        # 调用原有的处理逻辑
        result = generate_datafacts(input_data=processed_data, input_path=None)
        
        if result:  # 确保有结果才写入
            # 保存结果
            with open(output, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        else:
            logger.warning(f"跳过文件 {input}: 无有效结果")
            
    except Exception as e:
        logger.error(f"数据洞察生成失败: {str(e)}")
        raise

def preprocess_data(data):
    """
    预处理数据，处理类型转换问题
    """
    try:
        # 深拷贝避免修改原始数据
        processed = data.copy()
        
        # 确保data字段存在且格式正确
        if "data" in processed and isinstance(processed["data"], dict):
            # 处理数据部分
            if "data" in processed["data"]:
                rows = processed["data"]["data"]
                if isinstance(rows, list):
                    # 处理每一行数据
                    for i, row in enumerate(rows):
                        if isinstance(row, dict):
                            # 尝试将数值字符串转换为数值类型
                            for key, value in row.items():
                                if isinstance(value, str):
                                    try:
                                        # 尝试转换为数值
                                        if '.' in value:
                                            row[key] = float(value)
                                        else:
                                            row[key] = int(value)
                                    except (ValueError, TypeError):
                                        # 如果转换失败，保持原始值
                                        pass
                                elif value is None:
                                    # 将None替换为0或其他适当的默认值
                                    row[key] = 0
        
        return processed
        
    except Exception as e:
        logger.error(f"数据预处理失败: {str(e)}")
        raise

def generate_datafacts(input_data=None, input_path=None):
    """
    原有的数据洞察生成逻辑
    
    Args:
        input_data: 直接传入的数据对象
        input_path: 输入文件路径
    """
    try:
        if input_data is not None:
            data = input_data
            assert(input_path is None)
        else:
            assert(input_path and os.path.exists(input_path))
            try:
                with open(input_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                logger.error(f"Failed to read input file: {e}")
                return None
        
        datafact_generator = DatafactGenerator(data)
        datafacts = datafact_generator.generate_datafacts()

        data["datafacts"] = [datafact.get_json() for datafact in datafacts if datafact.score > 0]

        return data
        
    except Exception as e:
        logger.error(f"生成数据洞察失败: {str(e)}")
        return None

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