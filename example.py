from src.pipeline import Pipeline
from src.processors.data_processor import JSONDataProcessor
from src.processors.chart_generator import VegaLiteGenerator
from src.processors.svg_processor import SVGOptimizer
import os

data_dir = os.path.join(os.path.dirname(__file__),'src', 'data')
output_dir = os.path.join(os.path.dirname(__file__),'src', 'output')

def main():
    # 创建pipeline
    pipeline = Pipeline(
        data_processor=JSONDataProcessor(),
        chart_generator=VegaLiteGenerator(),
        svg_processor=SVGOptimizer()
    )

    # 执行pipeline
    input_file = os.path.join(data_dir, 'test.json')
    result = pipeline.execute(input_file)
    print(result)

    # 保存结果
    with open(os.path.join(output_dir, 'output.svg'), "w") as f:
        f.write(result)

if __name__ == "__main__":
    main()