from src.pipeline import Pipeline
from src.processors.data_processor import JSONDataProcessor
from src.processors.chart_generator import VegaLiteGenerator
from src.processors.svg_processor import SVGOptimizer
import os
from src.utils.dataset import VizNET
from src.processors.data_processor import VizNetDataProcessor

# data_dir = os.path.join(os.path.dirname(__file__),'src', 'data')
output_dir = os.path.join(os.path.dirname(__file__),'src', 'output')
os.environ["TOKENIZERS_PARALLELISM"] = "false"

def main():
    import argparse
    
    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(description='生成图表')
    parser.add_argument('-d', '--dataset_idx', type=int, default=0, help='数据集索引')
    parser.add_argument('-c', '--chart_idx', type=int, default=1, help='图表索引')
    args = parser.parse_args()

    # 创建pipeline
    pipeline = Pipeline(
        data_processor=VizNetDataProcessor(),
        chart_generator=VegaLiteGenerator(),
        svg_processor=SVGOptimizer()
    )

    dataset = VizNET()
    input_data = dataset.get_object(args.dataset_idx, args.chart_idx)
    result = pipeline.execute(input_data)

    # 保存结果,文件名包含索引信息
    output_filename = f'output_d{args.dataset_idx}_c{args.chart_idx}.svg'
    with open(os.path.join(output_dir, output_filename), "w") as f:
        f.write(result)

if __name__ == "__main__":
    main()